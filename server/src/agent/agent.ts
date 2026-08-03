// sam LINE Agent — Agent Core (state machine)
//
// 處理一則 LINE 訊息的完整流程：
//   IDLE → UNDERSTANDING → (EXECUTING | RESPONDING | AWAITING_FOLLOWUP) → IDLE
//
// stateless 設計：所有 state 存在 Redis。Agent class 只負責 orchestration。

import { randomUUID } from 'node:crypto';
import {
  type AgentState,
  type Conversation,
  type ConversationMessage,
  type Intent,
  DefaultConversationConfig,
} from './types.js';
import { canTransition } from './types.js';
import { AgentError, isAgentError, toAgentError } from './errors.js';
import { getConversationStore, ConversationStore } from './stateStore.js';
import { classifyIntent } from './intentClassifier.js';
import { getSkillRegistry, SkillRegistry } from './skillRegistry.js';
import { getSkillExecutor, SkillRunner } from './skillExecutor.js';
import { formatResponse } from './responseFormatter.js';
import { logger } from './logger.js';
import { chatCompletion, type ChatMessage } from './llmClient.js';

export interface HandleMessageInput {
  userId: string;
  channelId: string;
  text: string;
  replyToken?: string;
  systemContext?: string;
  conversationId?: string;
  media?: {
    mediaType: 'image' | 'video' | 'audio' | 'file' | 'sticker';
    messageId: string;
    fileName?: string;
    fileSize?: number;
    durationMs?: number;
    storageKey?: string;
    receivedAt?: number;
  };
}

export interface HandleMessageResult {
  text: string;
  conversationId: string;
  intent?: Intent;
  state: AgentState;
  artifacts?: Record<string, unknown>;
}

export interface AgentOptions {
  store?: ConversationStore;
  registry?: SkillRegistry;
  executor?: SkillRunner;
  classifyTimeoutMs?: number;
  enableSlashCommandFallback?: boolean;
}

const HISTORY_LIMIT = DefaultConversationConfig.historyLimit;
const TTL_SECONDS = DefaultConversationConfig.ttlSeconds;

interface SlashCommandMenuItem {
  command: string;
  label: string;
  description: string;
  argHint: string;
}

const SLASH_COMMAND_MENU: SlashCommandMenuItem[] = [
  { command: 'search', label: '搜尋', description: '搜尋網路資料並整理成摘要', argHint: '關鍵字' },
  { command: 'analysis', label: '深度分析', description: '資料收集 + 深度分析', argHint: '主題' },
  { command: 'write', label: '完整寫作', description: '收集 → 分析 → 大綱 → 撰寫 → 檢查 → 組裝', argHint: '主題' },
  { command: 'help', label: '說明', description: '顯示所有可用指令', argHint: '' },
];

function buildMenuText(): string {
  const lines = ['可用指令：'];
  SLASH_COMMAND_MENU.forEach((item, idx) => {
    const n = idx + 1;
    const hint = item.argHint ? ` <${item.argHint}>` : '';
    lines.push(`${n}. /${item.command}${hint}    ${item.label}（${item.description}）`);
  });
  lines.push('');
  lines.push('回覆數字選擇，或直接輸入 /指令 內容。');
  return lines.join('\n');
}

function findMenuItem(number: number): SlashCommandMenuItem | null {
  return SLASH_COMMAND_MENU[number - 1] ?? null;
}

export class Agent {
  private readonly store: ConversationStore;
  private readonly registry: SkillRegistry;
  private readonly executor: SkillRunner;
  private readonly classifyTimeoutMs: number;
  private readonly enableSlashCommandFallback: boolean;

  constructor(options: AgentOptions = {}) {
    this.store = options.store ?? getConversationStore();
    this.registry = options.registry ?? (undefined as unknown as SkillRegistry);
    this.executor = options.executor ?? getSkillExecutor();
    this.classifyTimeoutMs = options.classifyTimeoutMs ?? 15_000;
    this.enableSlashCommandFallback = options.enableSlashCommandFallback ?? true;
  }

  private async ensureRegistry(): Promise<SkillRegistry> {
    if (this.registry) return this.registry;
    (this as any).registry = await getSkillRegistry();
    return this.registry;
  }

  async handleMessage(input: HandleMessageInput): Promise<HandleMessageResult> {
    if (!input.channelId || input.channelId.trim() === '') {
      throw new AgentError(
        'STATE_INVALID_TRANSITION',
        'channelId is required for handleMessage',
        { context: { userId: input.userId } },
      );
    }

    // 多媒體訊息走獨立分支（不進文字意圖分類）
    if (input.media) {
      return this.handleMedia(input);
    }

    const now = Date.now();
    const conversation = await this.getOrCreateConversation(input.userId, input.channelId, now);

    if (conversation.channelId !== input.channelId) {
      logger.error('agent.cross_channel_anomaly', {
        userId: input.userId,
        requestedChannel: input.channelId,
        storedChannel: conversation.channelId,
        conversationId: conversation.id,
      });
      throw new AgentError(
        'STATE_CONVERSATION_NOT_FOUND',
        'conversation channelId mismatch',
        { context: { requested: input.channelId, stored: conversation.channelId } },
      );
    }

    await this.appendHistory(conversation, {
      role: 'user',
      content: input.text,
      timestamp: now,
    });

    let current: Conversation = await this.transition(conversation, 'understanding');

    // 若上一輪 menu_choice 留下 pendingCommand，將本次輸入當成該指令的參數
    const pendingCmd = current.context.pendingCommand as string | undefined;
    let effectiveText = input.text;
    if (pendingCmd && !effectiveText.trim().startsWith('/')) {
      effectiveText = `/${pendingCmd} ${effectiveText}`;
      current = await this.store.update(current.id, current.channelId, {
        context: { ...current.context, pendingCommand: undefined },
      });
    }

    let intent: Intent | undefined;
    let intentError: AgentError | undefined;

    try {
      const result = await classifyIntent(effectiveText, {
        history: current.history.slice(0, -1).map((m) => ({
          role: m.role === 'system' ? 'agent' : m.role,
          content: m.content,
        })),
        availableSkills: (await this.ensureRegistry()).list().map((s) => s.id),
        timeoutMs: this.classifyTimeoutMs,
      });
      intent = result.intent;
      current = await this.store.update(conversation.id, conversation.channelId, {
        intent,
        state: current.state,
      });
    } catch (e: unknown) {
      intentError = toAgentError(e, 'INTENT_CLASSIFICATION_FAILED');
    }

    let responseText = '';
    let artifacts: Record<string, unknown> | undefined;

    try {
      if (intentError) {
        current = await this.transition(current, 'responding');
        responseText = intentError.userMessage;
      } else if (intent) {
        const handled = await this.routeIntent(intent, current, input.systemContext);
        responseText = handled.text;
        artifacts = handled.artifacts;
        current = await this.transition(current, handled.nextState);
      } else {
        current = await this.transition(current, 'responding');
        responseText = '抱歉，我沒理解你的意思。';
      }
    } catch (e: unknown) {
      const err = toAgentError(e, 'INTERNAL_ERROR');
      current = await this.transition(current, 'error');
      responseText = err.userMessage;
    }

    await this.appendHistory(current, {
      role: 'agent',
      content: responseText,
      timestamp: Date.now(),
      metadata: artifacts,
    });

    const finalConv = await this.store.touch(current.id, current.channelId);
    current = finalConv;
    current = await this.transition(current, 'idle');

    return {
      text: responseText,
      conversationId: current.id,
      intent,
      state: current.state,
      artifacts,
    };
  }

  private async routeIntent(
    intent: Intent,
    conv: Conversation,
    systemContext?: string,
  ): Promise<{ text: string; nextState: AgentState; artifacts?: Record<string, unknown> }> {
    if (intent.type === 'slash_command') {
      return this.routeSlashCommand(intent.command, intent.arg, conv, systemContext);
    }

    if (intent.type === 'menu_show') {
      await this.store.update(conv.id, conv.channelId, {
        context: { ...conv.context, pendingCommand: undefined },
      });
      return {
        text: buildMenuText(),
        nextState: 'awaiting_followup',
      };
    }

    if (intent.type === 'menu_choice') {
      const item = findMenuItem(intent.number);
      if (!item) {
        return {
          text: `無此選項（${intent.number}）。請輸入 / 重新查看選單。`,
          nextState: 'responding',
        };
      }
      if (item.command === 'help') {
        return {
          text: '可用指令：\n1. /search <關鍵字>\n2. /analysis <主題>\n3. /write <主題>\n4. /help',
          nextState: 'responding',
        };
      }
      await this.store.update(conv.id, conv.channelId, {
        context: { ...conv.context, pendingCommand: item.command },
      });
      const hint = item.argHint ? `<${item.argHint}>` : '';
      return {
        text: `請問你要 ${item.label} 什麼？\n（例如：${item.command} ${hint}）\n或輸入 / 重新查看選單。`,
        nextState: 'awaiting_followup',
      };
    }

    const registry = await this.ensureRegistry();
    const match = registry.match(intent);

    if (!match) {
      if (intent.type === 'question' || intent.type === 'follow_up' || intent.type === 'chitchat') {
        return this.fallbackForIntent(intent, conv, systemContext);
      }
      return {
        text: '我目前還沒學會這件事，但可以幫你問問看 🙏',
        nextState: 'responding',
      };
    }

    const args = this.buildArgs(intent, conv);
    if (systemContext) args.systemContext = systemContext;
    if (!args.recentHistory) args.recentHistory = conv.history.slice(-6);
    const result = await this.executor.execute(match.skill, args, conv);

    return {
      text: formatResponse(result.output, conv),
      nextState: 'responding',
      artifacts: result.artifacts,
    };
  }

  private async routeSlashCommand(
    command: string,
    arg: string,
    conv: Conversation,
    systemContext?: string,
  ): Promise<{ text: string; nextState: AgentState; artifacts?: Record<string, unknown> }> {
    if (command === 'help' || command === '') {
      const skill = (await this.ensureRegistry()).get('slash-command');
      if (!skill) throw new AgentError('SKILL_NOT_FOUND', 'slash-command skill missing');
      const r = await this.executor.execute(skill, { command, arg }, conv);
      return { text: formatResponse(r.output, conv), nextState: 'responding' };
    }

    if (!arg && command !== 'readme') {
      return {
        text: `請提供參數。用法：/${command} <主題或關鍵字>`,
        nextState: 'responding',
      };
    }

    if (command !== 'search' && command !== 'analysis' && command !== 'analyze' && command !== 'write') {
      // 支援任意 registry skill id（如 /readme /ocr /stt）
      const directSkill = (await this.ensureRegistry()).get(command);
      if (!directSkill) {
        return {
          text: `未知指令：/${command}\n輸入 /help 查看可用指令。`,
          nextState: 'responding',
        };
      }
      const directArgs: Record<string, unknown> = { query: arg, topic: arg, arg, channelId: conv.channelId, userId: conv.userId };
      if (systemContext) directArgs.systemContext = systemContext;
      directArgs.recentHistory = conv.history.slice(-6);
      const directResult = await this.executor.execute(directSkill, directArgs, conv);
      return {
        text: formatResponse(directResult.output, conv),
        nextState: 'responding',
        artifacts: directResult.artifacts,
      };
    }

    const skillId = command === 'search' ? 'web-search' : command === 'write' ? 'write' : 'analyze';
    const skill = (await this.ensureRegistry()).get(skillId);
    if (!skill) {
      return {
        text: `Skill "${skillId}" 尚未啟用，請聯絡管理員。`,
        nextState: 'responding',
      };
    }

    const args: Record<string, unknown> =
      command === 'search'
        ? { query: arg }
        : command === 'write' || command === 'analysis' || command === 'analyze'
        ? { topic: arg }
        : { query: arg };
    if (systemContext) args.systemContext = systemContext;
    args.recentHistory = conv.history.slice(-6);

    const result = await this.executor.execute(skill, args, conv);
    return {
      text: formatResponse(result.output, conv),
      nextState: 'responding',
      artifacts: result.artifacts,
    };
  }

  private buildArgs(intent: Intent, conv: Conversation): Record<string, unknown> {
    if (intent.type === 'request_skill') {
      return {
        ...intent.entities,
        ...conv.context,
      };
    }
    if (intent.type === 'follow_up') {
      return {
        refersTo: intent.refersTo,
        recentHistory: conv.history.slice(-6),
      };
    }
    return { ...conv.context };
  }

  private async fallbackForIntent(
    intent: Intent,
    conv: Conversation,
    systemContext?: string,
  ): Promise<{ text: string; nextState: AgentState; artifacts?: Record<string, unknown> }> {
    if (intent.type === 'chitchat') {
      return {
        text: '收到 😊 隨時都可以問我問題。',
        nextState: 'responding',
      };
    }
    try {
      const text = await this.generateReply(conv, systemContext);
      return { text, nextState: 'responding' };
    } catch (e) {
      logger.warn('agent.generate_reply_failed', { error: String(e) });
      return {
        text: intent.type === 'question'
          ? `關於「${intent.topic}」我目前需要更多 context 才能回答。可以更具體描述，或試試 /search ${intent.topic}`
          : '請問你想進一步了解哪一段？',
        nextState: 'awaiting_followup',
      };
    }
  }

  private async generateReply(conv: Conversation, systemContext?: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: [
          '你是 sam LINE 分身助理，一位專業的業務助理。',
          '「## 已知資訊」段落是你從對話歷史中記得的客戶資訊，回答時應優先使用這些資訊。',
          '若已知資訊不足，誠實說明並引導使用者提供更多細節。',
          '用繁體中文、簡潔且專業的語氣回覆。',
          systemContext ? `\n\n## 已知資訊\n${systemContext}` : '',
        ].join(''),
      },
      ...conv.history.slice(-12).map((m) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
    ];
    const result = await chatCompletion({
      messages,
      temperature: 0.6,
      maxTokens: 800,
      timeoutMs: 30_000,
    });
    return result.content.trim();
  }

  private async handleMedia(input: HandleMessageInput): Promise<HandleMessageResult> {
    const media = input.media!;
    const conversation = await this.getOrCreateConversation(input.userId, input.channelId, Date.now());
    const registry = await this.ensureRegistry();

    const skillId =
      media.mediaType === 'image' ? 'ocr'
      : media.mediaType === 'audio' ? 'stt'
      : media.mediaType === 'video' ? 'stt'
      : 'file-process';

    const skill = registry.get(skillId);
    let text: string;

    if (skill) {
      const result = await this.executor.execute(skill, { ...media, ...input }, conversation);
      text = formatResponse(result.output, conversation);
    } else {
      text = this.degradedMediaReply(media);
    }

    await this.appendHistory(conversation, {
      role: 'user',
      content: `[${media.mediaType}] ${media.fileName ?? media.messageId}`,
      timestamp: Date.now(),
    });
    await this.appendHistory(conversation, {
      role: 'agent',
      content: text,
      timestamp: Date.now(),
    });
    await this.store.touch(conversation.id, conversation.channelId);

    return {
      text,
      conversationId: conversation.id,
      state: 'idle',
    };
  }

  private degradedMediaReply(media: NonNullable<HandleMessageInput['media']>): string {
    switch (media.mediaType) {
      case 'image':
        return '已收到您的圖片 📷 圖片辨識功能即將開放，之後就能自動幫您整理名片、賀卡與圖片內容。';
      case 'audio':
      case 'video':
        return '已收到您的語音訊息 🎤 語音轉文字功能即將開放，之後就能直接理解您的語音內容。';
      case 'file':
        return `已收到您的檔案「${media.fileName ?? '未命名'}」📎 檔案解析功能即將開放，之後就能自動摘要 PDF / Word 內容。`;
      default:
        return '已收到您的訊息。';
    }
  }

  private async getOrCreateConversation(
    userId: string,
    channelId: string,
    now: number,
  ): Promise<Conversation> {
    const existing = await this.store.listByUser(userId, channelId);
    if (existing.length > 0) {
      const latest = existing.sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (latest.channelId === channelId && latest.state !== 'idle' && latest.state !== 'awaiting_followup') {
        const refreshed = await this.store.touch(latest.id, latest.channelId);
        if (refreshed.state === 'understanding' || refreshed.state === 'executing' || refreshed.state === 'responding' || refreshed.state === 'error') {
          return await this.store.update(refreshed.id, refreshed.channelId, { state: 'idle' });
        }
        return refreshed;
      }
      return latest;
    }
    const id = `conv_${now}_${randomUUID().slice(0, 8)}`;
    const conv: Conversation = {
      id,
      userId,
      channelId,
      state: 'idle',
      history: [],
      context: {},
      createdAt: now,
      updatedAt: now,
      expiresAt: now + TTL_SECONDS * 1000,
    };
    return await this.store.create(conv);
  }

  private async transition(
    conv: Conversation,
    to: AgentState,
  ): Promise<Conversation> {
    if (!canTransition(conv.state, to)) {
      throw new AgentError(
        'STATE_INVALID_TRANSITION',
        `cannot transition from ${conv.state} to ${to}`,
        { context: { from: conv.state, to } },
      );
    }
    return await this.store.update(conv.id, conv.channelId, { state: to });
  }

  private async appendHistory(
    conv: Conversation,
    msg: ConversationMessage,
  ): Promise<void> {
    const trimmed = [...conv.history, msg].slice(-HISTORY_LIMIT);
    await this.store.update(conv.id, conv.channelId, { history: trimmed });
  }
}

let _agent: Agent | null = null;

export function getAgent(options?: AgentOptions): Agent {
  if (!_agent) _agent = new Agent(options);
  return _agent;
}

export function resetAgent(): void {
  _agent = null;
}