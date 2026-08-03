import { Agent, type HandleMessageInput, type HandleMessageResult } from './agent.js';
import { retrieveContext, type RetrievedContext } from './contextRetriever.js';
import { enqueueExtraction } from './memoryExtractor.js';
import type { Conversation } from './types.js';
import {
  formatSlashMenuText,
  resolveSlashCommand,
  resolveMenuChoice,
  type ResolvedTarget,
} from './slashMenu.js';
import { findAgentById } from '../data/agentRepo.js';
import { delegateToAgent, recordDelegation, type DelegationResult } from './agentDelegation.js';

export const NEW_COMMAND = '/new';
export const NEW_COMMAND_RESPONSE = '好的，讓我們重新開始。有什麼可以幫您？';

export interface PipelineOptions {
  agent?: Agent;
  enableRetrieval?: boolean;
  enableExtraction?: boolean;
  contextTopK?: number;
}

export interface PipelineResult extends HandleMessageResult {
  reset: boolean;
  slashMenuShown?: boolean;
  slashTarget?: ResolvedTarget;
  retrieved?: RetrievedContext;
  resetConversation?: Partial<Conversation>;
}

export class PolarisPipeline {
  private readonly agent: Agent;
  private readonly enableRetrieval: boolean;
  private readonly enableExtraction: boolean;

  constructor(options: PipelineOptions = {}) {
    this.agent = options.agent ?? new Agent();
    this.enableRetrieval = options.enableRetrieval ?? true;
    this.enableExtraction = options.enableExtraction ?? true;
  }

  async handleMessage(input: HandleMessageInput): Promise<PipelineResult> {
    const text = (input.text ?? '').trim();

    if (input.media) {
      const result = await this.agent.handleMessage(input);
      return { ...result, reset: false };
    }

    if (text === NEW_COMMAND) {
      return await this.handleReset(input);
    }

    if (text === '/') {
      const menuText = await formatSlashMenuText(input.channelId);
      return {
        text: menuText,
        intent: { type: 'menu_show' },
        conversationId: input.conversationId ?? input.userId,
        state: 'idle',
        reset: false,
        slashMenuShown: true,
      };
    }

    if (text.startsWith('/')) {
      return await this.handleSlash(input, text);
    }

    // 純數字 = 動態 menu 的選擇（統一吃 slashMenu，避免與靜態 menu_choice 錯位）
    if (/^\d+$/.test(text)) {
      const choice = await resolveMenuChoice(text, input.channelId);
      if (choice) {
        return await this.handleSlash(input, `/${choice.name} ${choice.remainingArgs}`.trim());
      }
    }

    const retrieved = this.enableRetrieval
      ? await retrieveContext(input.userId, input.channelId, text).catch((e) => {
          console.warn('[pipeline] retrieval failed:', e);
          return undefined;
        })
      : undefined;

    const intentHint = this.classifyPolarisIntent(text);
    if (intentHint === 'sirius') {
      return await this.handleDelegation(input, text, retrieved, 'sirius');
    }
    if (intentHint === 'deneb') {
      return await this.handleDelegation(input, text, retrieved, 'deneb');
    }

    const enrichedInput: HandleMessageInput = {
      ...input,
      systemContext: retrieved ? formatRetrievedContext(retrieved) : input.systemContext,
    };

    const result = await this.agent.handleMessage(enrichedInput);

    if (result.intent?.type === 'unknown') {
      return {
        ...result,
        text: this.formatClarifyMessage(text),
        intent: result.intent,
        reset: false,
      };
    }

    if (this.enableExtraction) {
      enqueueExtraction({
        customerId: input.userId,
        channelId: input.channelId,
        messages: [
          { role: 'user', content: text, at: Date.now() },
          { role: 'agent', content: result.text ?? '', at: Date.now() },
        ],
      });
    }

    return {
      ...result,
      reset: false,
      retrieved,
    };
  }

  private async handleSlash(input: HandleMessageInput, text: string): Promise<PipelineResult> {
    let target = await resolveSlashCommand(text, input.channelId);
    if (!target) {
      target = await resolveMenuChoice(text, input.channelId);
    }

    if (!target) {
      const head = text.slice(1).split(/\s+/)[0];
      const menuText = await formatSlashMenuText(input.channelId);
      return {
        text: `找不到指令「${head}」。\n\n${menuText}`,
        intent: { type: 'unknown', confidence: 0 },
        conversationId: input.conversationId ?? input.userId,
        state: 'idle',
        reset: false,
      };
    }

    if (target.type === 'skill') {
      const retrieved = this.enableRetrieval
        ? await retrieveContext(input.userId, input.channelId, target.remainingArgs || target.id).catch(() => undefined)
        : undefined;
      const enrichedInput: HandleMessageInput = {
        ...input,
        text: target.remainingArgs ? `/${target.id} ${target.remainingArgs}` : `/${target.id}`,
        conversationId: input.conversationId,
        systemContext: retrieved ? formatRetrievedContext(retrieved) : undefined,
      };
      const result = await this.agent.handleMessage(enrichedInput);
      return { ...result, reset: false, slashTarget: target };
    }

    const agentConfig = await findAgentById(target.id);
    const personaContext = agentConfig
      ? this.formatAgentPersonaContext(agentConfig)
      : `你是 ${target.name}。`;

    const enrichedInput: HandleMessageInput = {
      ...input,
      text: target.remainingArgs || text,
      systemContext: personaContext,
    };

    const result = await this.agent.handleMessage(enrichedInput);

    if (this.enableExtraction) {
      enqueueExtraction({
        customerId: input.userId,
        channelId: input.channelId,
        messages: [
          { role: 'user', content: text, at: Date.now() },
          { role: 'agent', content: result.text ?? '', at: Date.now() },
        ],
      });
    }

    return { ...result, reset: false, slashTarget: target };
  }

  private formatAgentPersonaContext(agent: any): string {
    const p = agent.persona ?? {};
    const lines: string[] = [];
    lines.push(`你是 ${agent.name}（${agent.template ?? agent.persona?.role ?? ''}）— ${agent.description ?? ''}`);
    if (p.traits?.length) lines.push(`\n特質：${p.traits.join('、')}`);
    if (agent.systemPrompt) lines.push(`\n${agent.systemPrompt}`);
    return lines.join('\n');
  }

  private async handleReset(input: HandleMessageInput): Promise<PipelineResult> {
    const now = Date.now();
    const conversation: Partial<Conversation> = {
      id: input.conversationId ?? input.userId,
      userId: input.userId,
      channelId: input.channelId,
      state: 'idle',
      history: [],
      context: {},
      createdAt: now,
      updatedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
    };
    return {
      text: NEW_COMMAND_RESPONSE,
      intent: { type: 'chitchat' },
      conversationId: input.conversationId ?? input.userId,
      state: 'idle',
      reset: true,
      resetConversation: conversation as Conversation,
    };
  }

  private classifyPolarisIntent(text: string): 'sirius' | 'deneb' | null {
    const lower = text.toLowerCase();
    const siriusKeywords = ['研究', '報告', '比較', '分析', '列出', '步驟', '流程', '規劃', '設計', '整理', '摘要', '怎麼做', 'how to', 'research', 'report'];
    const denebKeywords = ['哲學', '人生', '意義', '為什麼活著', '怎麼辦', '推薦', '建議', '看法', 'philosophy', 'meaning'];
    if (siriusKeywords.some((k) => lower.includes(k))) return 'sirius';
    if (denebKeywords.some((k) => lower.includes(k))) return 'deneb';
    return null;
  }

  private async handleDelegation(
    input: HandleMessageInput,
    text: string,
    retrieved: RetrievedContext | undefined,
    agentName: string
  ): Promise<PipelineResult> {
    try {
      const result: DelegationResult = await delegateToAgent({
        agentName,
        userMessage: text,
        depth: 0,
        history: [agentName],
        customerId: input.userId,
        channelId: input.channelId,
        systemContext: retrieved ? formatRetrievedContext(retrieved) : undefined,
      });
      recordDelegation(agentName);

      if (this.enableExtraction) {
        enqueueExtraction({
          customerId: input.userId,
          channelId: input.channelId,
          messages: [
            { role: 'user', content: text, at: Date.now() },
            { role: 'agent', content: result.text, at: Date.now() },
          ],
        });
      }

      return {
        text: result.text,
        intent: { type: 'chitchat' },
        conversationId: input.conversationId ?? input.userId,
        state: 'idle',
        reset: false,
        slashTarget: { type: 'main_agent', id: agentName, name: agentName, remainingArgs: text },
      };
    } catch (e) {
      console.warn('[pipeline] delegation failed', e);
      const enrichedInput: HandleMessageInput = {
        ...input,
        systemContext: retrieved ? formatRetrievedContext(retrieved) : undefined,
      };
      const result = await this.agent.handleMessage(enrichedInput);
      return { ...result, reset: false, retrieved };
    }
  }

  private formatClarifyMessage(text: string): string {
    return `我不太確定您的意思。請換個方式說明，或用 / 看可用指令。`;
  }
}

export function formatRetrievedContext(ctx: RetrievedContext): string {
  const sections: string[] = [];

  if (ctx.memories.length > 0) {
    sections.push('## 關於這個客戶的記憶');
    sections.push(
      ctx.memories
        .map((m) => `- [${m.category}] ${m.content}（${m.freshness}, 信心 ${Math.round(m.confidence * 100)}%）`)
        .join('\n')
    );
  }

  if (ctx.businessDocs.length > 0) {
    sections.push('\n## 相關業務知識');
    sections.push(
      ctx.businessDocs
        .map((k) => `- [${k.type}] ${k.title}：${k.content}`)
        .join('\n')
    );
  }

  return sections.join('\n');
}

let _pipeline: PolarisPipeline | null = null;

export function getPolarisPipeline(options?: PipelineOptions): PolarisPipeline {
  if (!_pipeline) {
    _pipeline = new PolarisPipeline(options);
  }
  return _pipeline;
}

export function resetPolarisPipeline(): void {
  _pipeline = null;
}