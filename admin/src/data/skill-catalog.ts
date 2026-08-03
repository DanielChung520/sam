/** SAM Agent 技能目錄 — 所有可用技能的單一資料源 */

export interface SkillDefinition {
  id: string
  title: string
  desc: string
  tag: string
  color: string
  /** MUI icon name (resolved via IconNameLookup) */
  icon: string
  /** 技能類型 */
  type: 'builtin' | 'line-native' | 'mcp' | 'business' | 'custom'
  /** 是否預設啟用 */
  enabled: boolean
  /** 設定 Schema（選填） */
  configSchema?: Record<string, any>
  /** 輸入規格（選填）— 顯示於流程設置卡的「輸入」面板 */
  inputSchema?: { name: string; type: string; required: boolean; desc: string }[]
  /** 輸出規格（選填）— 顯示於流程設置卡的「輸出」面板 */
  outputSchema?: { name: string; type: string; desc: string }[]
  /** 分組 */
  group: '客服' | '行銷' | '銷售' | '多媒體' | '會員' | '整合'
  /** 是否有 flow 定義（可在 Skills 頁面編輯流程圖） */
  hasFlow?: boolean
}

export const SKILL_CATALOG: SkillDefinition[] = [
  // ── Built-in（自建技能） ──
  {
    id: 'article-reader',
    title: '網路文章閱讀器',
    desc: '讀取分享的網路文章網址，自動提取內文並生成摘要回覆',
    tag: 'READER',
    color: '#06b6d4',
    icon: 'Article',
    type: 'builtin',
    enabled: true,
    group: '客服',
    hasFlow: true,
  },
  {
    id: 'knowledge-base',
    title: '知識庫檢索',
    desc: 'RAG 問答：上傳產品文件、FAQ、規範，AI 基於內容精準回答',
    tag: 'RAG',
    color: '#10b981',
    icon: 'MenuBook',
    type: 'builtin',
    enabled: true,
    group: '客服',
    hasFlow: true,
  },
  {
    id: 'ocr',
    title: 'OCR 解析',
    desc: '圖片文字辨識：VL 模型提取文字 → 分類 → 結構化 JSON 輸出',
    tag: 'OCR',
    color: '#6366f1',
    icon: 'TextSnippet',
    type: 'builtin',
    enabled: true,
    group: '多媒體',
    hasFlow: true,
    inputSchema: [
      { name: 'image', type: 'image', required: true, desc: 'LINE 收到的圖片' },
      { name: 'channelId', type: 'string', required: true, desc: 'LINE channel ID（依 channel 隔離備存）' },
      { name: 'receivedAt', type: 'timestamp', required: true, desc: '接收時間' },
    ],
    outputSchema: [
      { name: 'summary', type: 'string', desc: '圖片概述' },
      { name: 'type', type: 'enum', desc: '名片 / 問安卡 / 祝福賀卡 / 其他' },
      { name: 'name/title/company/phone/email', type: 'string', desc: '名片欄位（名字理論上為圖中最大字）' },
      { name: 'other_contacts', type: 'object', desc: 'qq / line / 微信 等聯繫方式' },
      { name: 'greeting_period/festival', type: 'string', desc: '問安時段（早/中/午/晚）或節慶名稱' },
      { name: 'greeting_content', type: 'string', desc: '問候或祝福內容' },
      { name: 'text', type: 'string', desc: '其他圖片掃描的全部文字' },
    ],
  },
  {
    id: 'card-collection',
    title: '名片收集與回應',
    desc: 'OCR 分類為名片時自動儲存至名片夾，並發送確認/優惠訊息',
    tag: 'Recognition',
    color: '#3b82f6',
    icon: 'Badge',
    type: 'builtin',
    enabled: true,
    group: '客服',
    hasFlow: true,
  },
  {
    id: 'greeting',
    title: '回應祝賀及問安',
    desc: '偵測節日祝賀、問安圖片，自動回覆對應祝福語',
    tag: 'Greeting',
    color: '#f59e0b',
    icon: 'Celebration',
    type: 'builtin',
    enabled: true,
    group: '客服',
    hasFlow: true,
  },
  {
    id: 'image-other',
    title: '其他圖片解析與處理',
    desc: '非名片/問安類圖片的通用解析、描述與回應',
    tag: 'Image',
    color: '#8b5cf6',
    icon: 'Image',
    type: 'builtin',
    enabled: true,
    group: '多媒體',
    hasFlow: true,
  },
  {
    id: 'stt',
    title: '語音轉文字（STT）',
    desc: '語音訊息自動轉文字，接續 LLM 處理或特定指令',
    tag: 'STT',
    color: '#22c55e',
    icon: 'Mic',
    type: 'builtin',
    enabled: true,
    group: '多媒體',
    hasFlow: true,
  },
  {
    id: 'file-process',
    title: '檔案處理',
    desc: '非圖片/語音檔案（PDF、Excel、Word）解析摘要與儲存',
    tag: 'FILE',
    color: '#06b6d4',
    icon: 'AttachFile',
    type: 'builtin',
    enabled: true,
    group: '多媒體',
    hasFlow: true,
  },

  // ── Business（業務流程與生產力工具） ──
  {
    id: 'todos',
    title: '任務分解引擎（TaskForge）',
    desc: '將高層目標自動分解為可執行任務序列，循序執行並產出完整文件。支援 REST 與 MCP 呼叫。',
    tag: 'TODOS',
    color: '#f97316',
    icon: 'Assignment',
    type: 'business',
    enabled: true,
    group: '整合',
    hasFlow: true,
  },
]

/** 依 ID 查詢技能 */
export function getSkill(id: string): SkillDefinition | undefined {
  return SKILL_CATALOG.find((s) => s.id === id)
}

/** 依類型過濾 */
export function getSkillsByType(type: SkillDefinition['type']): SkillDefinition[] {
  return SKILL_CATALOG.filter((s) => s.type === type)
}

/** 依群組過濾 */
export function getSkillsByGroup(group: string): SkillDefinition[] {
  return SKILL_CATALOG.filter((s) => s.group === group)
}

/** 所有啟用中的技能 */
export function getEnabledSkills(): SkillDefinition[] {
  return SKILL_CATALOG.filter((s) => s.enabled)
}
