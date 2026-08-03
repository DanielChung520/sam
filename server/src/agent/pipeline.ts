import { Agent, type HandleMessageInput, type HandleMessageResult } from './agent.js';
import { retrieveContext, type RetrievedContext } from './contextRetriever.js';
import { enqueueExtraction } from './memoryExtractor.js';
import type { Conversation } from './types.js';
import {
  formatSlashMenuText,
  resolveSlashCommand,
  resolveMenuChoice,
  buildSlashMenu,
  VISIBLE_MENU_IDS,
  type ResolvedTarget,
  type MenuItemType,
} from './slashMenu.js';
import { findAgentById } from '../data/agentRepo.js';
import { delegateToAgent, recordDelegation, type DelegationResult } from './agentDelegation.js';
import { saveArtifact } from '../lib/artifactStore.js';
import { logger } from './logger.js';
import { getConversationStore } from './stateStore.js';

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

    // 選單等待狀態：user 剛輸入 / 或選了需變數的指令
    const pending = await this.getMenuState(input.userId, input.channelId);
    if (pending?.menuPending) {
      return await this.handleMenuPending(input, text, pending);
    }

    if (text === NEW_COMMAND) {
      return await this.handleReset(input);
    }

    if (text === '/') {
      await this.setMenuState(input.userId, input.channelId, { menuPending: true });
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

    // /編號 → 等價於輸入 / 再選數字
    if (/^\/\d+$/.test(text)) {
      return await this.handleMenuPending(input, text.slice(1), { menuPending: true });
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

    // Polaris 行為路由（DB 配置）：依 routing 規則決定行為，取代部分硬編碼
    const polarisRule = await this.matchPolarisRoute(input, text);
    if (polarisRule) {
      return polarisRule;
    }

    // 意圖引擎（DB 配置）：多關鍵詞 → 意圖 → 行為（sirius/deneb/問候等皆由 DB 規則驅動）
    const intentResult = await this.matchIntentBehavior(input, text);
    if (intentResult) {
      return intentResult;
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
    // /？ /help /? → 完整指令說明文件（HTML 存檔，回標題+連結）
    const helpInput = text.trim();
    if (helpInput === '/？' || helpInput === '/?' || helpInput === '/help' || helpInput === '／？') {
      const doc = await this.buildHelpDoc(input);
      if (doc) {
        return {
          text: doc,
          intent: { type: 'menu_show' },
          conversationId: input.conversationId ?? input.userId,
          state: 'idle',
          reset: false,
        };
      }
    }

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

    // 指令需要變數但沒提供 → 設 pendingArg 並提問，等 user 輸入
    if (!target.remainingArgs) {
      await this.setMenuState(input.userId, input.channelId, {
        menuPending: true,
        pendingArg: target.name,
      });
      return {
        text: `請問你要 ${target.name} 做什麼？\n（輸入內容後自動執行，或輸入 0 取消）`,
        intent: { type: 'menu_show' },
        conversationId: input.conversationId ?? input.userId,
        state: 'idle',
        reset: false,
        slashTarget: target,
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

    // slash 指向 sub-agent（如 /Spica 任務）：直接委派給該 agent，
    // 避免純參數交給主 agent 被誤判成問候/閒聊。
    if (target.type === 'sub_agent') {
      const delegated = await delegateToAgent({
        agentName: target.name,
        userMessage: target.remainingArgs || target.name,
        depth: 0,
        history: [],
        customerId: input.userId,
        channelId: input.channelId,
        systemContext: personaContext,
      });
      if (this.enableExtraction) {
        enqueueExtraction({
          customerId: input.userId,
          channelId: input.channelId,
          messages: [
            { role: 'user', content: text, at: Date.now() },
            { role: 'agent', content: delegated.text, at: Date.now() },
          ],
        });
      }
      // 結構化產出（含標題的長內容）→ 存 HTML 文件並回標題+連結
      const artifact = await this.trySaveArtifact(input, target.name, delegated.text);
      return {
        text: artifact ?? delegated.text,
        intent: { type: 'chitchat' },
        conversationId: input.conversationId ?? input.userId,
        state: 'idle',
        reset: false,
        slashTarget: target,
      };
    }

    // main_agent（如 /Polaris 任務）：帶 persona 讓主 agent 以該角色回應
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

    // main_agent 產出物也存 HTML（如 Deneb 的深度諮詢報告）
    const artifact = await this.trySaveArtifact(input, target.name, result.text);
    return { ...result, text: artifact ?? result.text, reset: false, slashTarget: target };
  }

  // 產生完整指令說明文件（markdown → HTML 存 SeaweedFS，回標題+連結）
  private async buildHelpDoc(input: HandleMessageInput): Promise<string | null> {
    try {
      const menu = await buildSlashMenu(input.channelId);
      const visible = menu.filter((m) => VISIBLE_MENU_IDS.has(m.id));
      visible.forEach((m, i) => {
        m.index = i + 1;
      });

      const lines: string[] = [
        '# SAM 分身助理指令說明',
        '',
        '輸入 `/` 可隨時查看功能選單；輸入 `/？` 查看本說明文件。',
        '每個指令都可以用「數字」（例如 `1`）或「斜線指令」（例如 `/Spica 主題`）呼叫。',
        '',
      ];

      const section = (label: string, type: MenuItemType, desc: string) => {
        const items = visible.filter((m) => m.type === type);
        if (!items.length) return;
        lines.push(`## ${label}`);
        lines.push('');
        lines.push(desc);
        lines.push('');
        for (const m of items) {
          const hint = m.argHint ? ` <${m.argHint}>` : '';
          lines.push(`### ${m.index}. /${m.name}${hint}`);
          lines.push('');
          lines.push(`${m.description}`);
          lines.push('');
          lines.push(`- 指令：\`/${m.name}${hint}\``);
          lines.push(`- 使用範例：\`/${m.name} ${m.argHint ? '你的' + (m.argHint === 'query' ? '查詢內容' : m.argHint === 'topic' ? '主題' : '內容') : ''}\``);
          lines.push('');
        }
      };

      section('主 Agents（會自己做決策）', 'main_agent', '這些 Agent 會理解你的需求並自行規劃、分工與執行，適合複雜任務。');
      section('Sub-Agents（執行單一任務）', 'sub_agent', '每個 Sub-Agent 專精一種任務，輸入 `/名稱 任務內容` 直接呼叫。');
      section('Skills（即時工具）', 'skill', '即時工具，可搭配參數直接使用。');

      lines.push('## 其他可用指令');
      lines.push('');
      lines.push('- `/`：顯示功能選單');
      lines.push('- `/？`、`/help`：顯示本說明文件');
      lines.push('- `/new`：開始新的對話');
      lines.push('');

      const md = lines.join('\n');
      const ref = await saveArtifact({
        channelId: input.channelId,
        title: 'SAM 分身助理指令說明',
        markdown: md,
        ownerUserId: input.userId,
      });
      return `📖 ${ref.title}\n\n${ref.shareUrl}`;
    } catch (e) {
      logger.warn('help_doc_failed', { channelId: input.channelId, error: String(e) });
      return null;
    }
  }

  // ── 選單等待狀態 ──────────────────────────────────

  private async getMenuState(
    userId: string,
    channelId: string,
  ): Promise<{ menuPending: boolean; pendingArg?: string } | null> {
    try {
      const store = getConversationStore();
      const convs = await store.listByUser(userId, channelId);
      if (convs.length === 0) return null;
      const latest = convs.sort((a, b) => b.updatedAt - a.updatedAt)[0];
      const ctx = latest.context ?? {};
      if (ctx.menuPending || ctx.pendingArg) {
        return { menuPending: !!ctx.menuPending, pendingArg: ctx.pendingArg as string | undefined };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async setMenuState(
    userId: string,
    channelId: string,
    state: { menuPending?: boolean; pendingArg?: string },
  ): Promise<void> {
    try {
      const store = getConversationStore();
      const convs = await store.listByUser(userId, channelId);
      const latest = convs.sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (!latest) {
        // / 分支提前 return 未建 conversation → 建立一個再寫狀態
        const now = Date.now();
        const { randomUUID } = await import('node:crypto');
        const conv: Conversation = {
          id: `conv_${now}_${randomUUID().slice(0, 8)}`,
          userId,
          channelId,
          state: 'idle',
          history: [],
          context: { menuPending: state.menuPending ?? false, pendingArg: state.pendingArg },
          createdAt: now,
          updatedAt: now,
          expiresAt: now + 30 * 60 * 1000,
        };
        await store.create(conv);
        return;
      }
      await store.update(latest.id, latest.channelId, {
        context: {
          ...latest.context,
          menuPending: state.menuPending ?? undefined,
          pendingArg: state.pendingArg ?? undefined,
        },
      });
    } catch {
      /* 狀態寫入失敗不阻斷 */
    }
  }

  // 選單等待中：數字選擇指令 / 無效輸入提示 / 0 結束
  private async handleMenuPending(
    input: HandleMessageInput,
    text: string,
    pending: { menuPending: boolean; pendingArg?: string },
  ): Promise<PipelineResult> {
    const trimmed = text.trim();

    // 等待變數輸入（上一輪選了需參數的指令）
    if (pending.pendingArg) {
      if (trimmed === '0') {
        await this.setMenuState(input.userId, input.channelId, { menuPending: false, pendingArg: undefined });
        return {
          text: '已取消，請輸入 / 重新查看指令。',
          intent: { type: 'menu_show' },
          conversationId: input.conversationId ?? input.userId,
          state: 'idle',
          reset: false,
        };
      }
      if (trimmed.startsWith('/')) {
        await this.setMenuState(input.userId, input.channelId, { menuPending: false, pendingArg: undefined });
        return this.handleMessage({ ...input, text: trimmed });
      }
      // 收到變數 → 執行指令
      const cmd = pending.pendingArg;
      await this.setMenuState(input.userId, input.channelId, { menuPending: false, pendingArg: undefined });
      return this.handleSlash(input, `/${cmd} ${trimmed}`.trim());
    }

    // 等待數字選擇
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      if (num === 0) {
        await this.setMenuState(input.userId, input.channelId, { menuPending: false });
        return {
          text: '已結束，請輸入 / 重新查看指令。',
          intent: { type: 'menu_show' },
          conversationId: input.conversationId ?? input.userId,
          state: 'idle',
          reset: false,
        };
      }
      const choice = await resolveMenuChoice(String(num), input.channelId);
      if (!choice) {
        const menuText = await formatSlashMenuText(input.channelId);
        return {
          text: `沒有收到指令（${num}）。請繼續輸入數值，或 0 結束等待指令。\n\n${menuText}`,
          intent: { type: 'menu_show' },
          conversationId: input.conversationId ?? input.userId,
          state: 'idle',
          reset: false,
        };
      }
      return this.handleSlash(input, `/${choice.name} ${choice.remainingArgs}`.trim());
    }

    // 非數字 → 提示繼續
    const menuText = await formatSlashMenuText(input.channelId);
    return {
      text: `沒有收到指令。請輸入數值，或 0 結束等待指令。\n\n${menuText}`,
      intent: { type: 'menu_show' },
      conversationId: input.conversationId ?? input.userId,
      state: 'idle',
      reset: false,
    };
  }

  // 結構化產出 → 存 HTML 文件（SeaweedFS），回「標題 + 連結」
  private async trySaveArtifact(
    input: HandleMessageInput,
    agentName: string,
    content: string,
  ): Promise<string | null> {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length < 100) return null;

    let title = `${agentName} 產出`;
    let md = trimmed;

    // 若 agent 回傳 { title, content } JSON → 拆出標題與內容
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && parsed.content) {
        title = typeof parsed.title === 'string' && parsed.title ? parsed.title : title;
        md = String(parsed.content);
      }
    } catch {
      /* 非 JSON，整段當 markdown */
    }

    // 純對話/非結構化內容不存檔
    if (!/#{1,4}\s/.test(md) && md.length < 200) return null;

    try {
      const ref = await saveArtifact({
        channelId: input.channelId,
        title,
        markdown: md,
        ownerUserId: input.userId,
      });
      return `📄 ${ref.title}\n\n${ref.shareUrl}`;
    } catch (e) {
      logger.warn('artifact.save_failed', { channelId: input.channelId, error: String(e) });
      return null;
    }
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

  // 意圖引擎（DB 配置）：依多關鍵詞規則決定行為
  private async matchIntentBehavior(
    input: HandleMessageInput,
    text: string,
  ): Promise<PipelineResult | null> {
    try {
      const { getIntentRules, matchIntent } = await import('./intentEngine.js');
      const rules = await getIntentRules();
      if (rules.length === 0) return null;

      const match = matchIntent(text, rules);
      if (!match) return null;
      const { rule } = match;

      // reply → 直接回覆
      if (rule.behavior.action === 'reply') {
        return {
          text: rule.behavior.target,
          intent: { type: 'chitchat' },
          conversationId: input.conversationId ?? input.userId,
          state: 'idle',
          reset: false,
        };
      }

      // skill → 走 slash 路由（reuse resolveSlashCommand 格式）
      if (rule.behavior.action === 'skill') {
        return await this.handleSlash(input, `/${rule.behavior.target} ${text}`.trim());
      }

      // agent → 委派
      if (rule.behavior.action === 'agent') {
        const retrieved = this.enableRetrieval
          ? await retrieveContext(input.userId, input.channelId, text).catch(() => undefined)
          : undefined;
        return await this.handleDelegation(input, text, retrieved, rule.behavior.target);
      }

      // llm → 交給主 agent（帶意圖提示）
      if (rule.behavior.action === 'llm') {
        const enriched: HandleMessageInput = {
          ...input,
          systemContext: rule.behavior.target
            ? `（使用者意圖：${rule.name}）${rule.behavior.target}`
            : input.systemContext,
        };
        const result = await this.agent.handleMessage(enriched);
        return { ...result, reset: false };
      }
      return null;
    } catch {
      return null;
    }
  }

  // Polaris 行為路由（DB 配置）：依 routing 規則決定走哪個 skill / agent / 回覆
  private async matchPolarisRoute(
    input: HandleMessageInput,
    text: string,
  ): Promise<PipelineResult | null> {
    try {
      const { getPolarisConfig, matchRoutingRule } = await import('./polarisRouting.js');
      const config = await getPolarisConfig();
      const rule = matchRoutingRule(text, config.routing);
      if (!rule) return null;

      if (rule.action === 'reply') {
        return {
          text: rule.target,
          intent: { type: 'chitchat' },
          conversationId: input.conversationId ?? input.userId,
          state: 'idle',
          reset: false,
        };
      }

      // skill / agent → 走既有 handleSlash 路徑（reuse resolveSlashCommand 格式）
      if (rule.action === 'skill') {
        return await this.handleSlash(input, `/${rule.target} ${rule.pattern}`.trim());
      }
      if (rule.action === 'agent') {
        return await this.handleSlash(input, `/${rule.target} ${text}`.trim());
      }
      return null;
    } catch {
      return null;
    }
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
        history: [],
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