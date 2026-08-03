/**
 * Agent Detail Drawer — for Main Agents
 *
 * Shows: system prompt, model, rate limit, enabled skills, stats, linked channels
 * Round 1 scope: read + edit. Sub-Agent detail deferred to round 2.
 */
import { useState, useEffect } from 'react'
import { get, patch as apiPatch, del } from '../api/client'

interface AgentCenterItem {
  id: string
  type: 'main' | 'sub'
  name: string
  template: string
  category: string
  description: string
  enabled: boolean
  status: string
  persona: {
    archetype: string
    role: string
    traits: string[]
    myth: string
  }
  createdAt: string
  updatedAt: string
  raw: any
}

export interface MainAgentDetail extends AgentCenterItem {
  raw: {
    _key: string
    name: string
    description: string
    enabled: boolean
    systemPrompt: string
    model: string
    temperature: number
    maxTokens: number
    personToken: string
    maxMessagesPerDay: number
    cooldownSeconds: number
    autoReplyEnabled: boolean
    autoReplyMessage: string
  }
}

interface LinkedChannel {
  id: string
  name: string
  channelId: string
  enabled: boolean
}

// / 指令列表項目
interface SlashCommandItem {
  command: string
  label: string
  description: string
  target: string        // skill id 或 agent 名稱
  targetType: 'skill' | 'agent'
  enabled: boolean
  argHint?: string
}

// 行為路由規則（輸入條件 → 行為）
interface RoutingRule {
  id: string
  pattern: string       // 輸入匹配（關鍵字/regex/類型）
  matchType: 'keyword' | 'regex' | 'type'
  action: string        // 行為：skill / agent / reply
  target: string        // skill id / agent 名 / 回覆文字
  params: Record<string, unknown>
  enabled: boolean
}

export function AgentDetail({
  item,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: AgentCenterItem
  onClose: () => void
  onSaved: () => Promise<void> | void
  onDeleted: () => Promise<void> | void
}) {
  const [tab, setTab] = useState<'persona' | 'basic' | 'intent' | 'commands' | 'routing' | 'behavior' | 'rate' | 'channels' | 'raw'>('persona')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkedChannels, setLinkedChannels] = useState<LinkedChannel[]>([])

  // Editable fields
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description)
  const [systemPrompt, setSystemPrompt] = useState(item.raw?.systemPrompt ?? '')
  const [model, setModel] = useState(item.raw?.model ?? 'gpt-4o')
  const [temperature, setTemperature] = useState(item.raw?.temperature ?? 0.7)
  const [maxTokens, setMaxTokens] = useState(item.raw?.maxTokens ?? 2000)
  const [maxMessagesPerDay, setMaxMessagesPerDay] = useState(item.raw?.maxMessagesPerDay ?? 1000)
  const [cooldownSeconds, setCooldownSeconds] = useState(item.raw?.cooldownSeconds ?? 0)
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(item.raw?.autoReplyEnabled ?? false)
  const [autoReplyMessage, setAutoReplyMessage] = useState(
    item.raw?.autoReplyMessage ?? '目前不在服務時間，我們將在營業時間盡快回覆您！'
  )

  // 意圖/感知參數
  const [intentConfidenceThreshold, setIntentConfidenceThreshold] = useState(item.raw?.intentConfidenceThreshold ?? 0.5)
  const [conversationTtl, setConversationTtl] = useState(item.raw?.conversationTtl ?? 1800)
  const [historyLimit, setHistoryLimit] = useState(item.raw?.historyLimit ?? 20)

  // / 指令列表（slashCommands）
  const [slashCommands, setSlashCommands] = useState<SlashCommandItem[]>(item.raw?.slashCommands ?? [])

  // 行為路由規則（routing）
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>(item.raw?.routing ?? [])

  useEffect(() => {
    loadLinkedChannels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  async function loadLinkedChannels() {
    setLoading(true)
    try {
      const res = await get<{ data: LinkedChannel[] }>(`/admin/channels`)
      const channels = (res.data ?? []).filter((c) => c.id && c.name)
      setLinkedChannels(channels.filter((c) => isLinkedToAgent(c, item.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await apiPatch(`/admin/agent-center/main/${item.id}`, {
        name,
        description,
        systemPrompt,
        model,
        temperature: Number(temperature),
        maxTokens: Number(maxTokens),
        maxMessagesPerDay: Number(maxMessagesPerDay),
        cooldownSeconds: Number(cooldownSeconds),
        autoReplyEnabled,
        autoReplyMessage,
        intentConfidenceThreshold: Number(intentConfidenceThreshold),
        conversationTtl: Number(conversationTtl),
        historyLimit: Number(historyLimit),
        slashCommands,
        routing: routingRules,
      })
      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`確定要刪除「${name}」？此操作無法復原。`)) return
    try {
      await del(`/admin/agent-center/main/${item.id}`)
      await onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '80vw',
          maxWidth: 1200,
          height: '80vh',
          maxHeight: 900,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <h2>{name}</h2>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                background: item.enabled ? '#d1fae5' : '#f1f5f9',
                color: item.enabled ? '#065f46' : '#475569',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              {item.enabled ? '啟用' : '停用'}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div
          style={{
            padding: '0 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: 4,
          }}
        >
          {(['persona', 'basic', 'intent', 'commands', 'routing', 'behavior', 'rate', 'channels', 'raw'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 12px',
                border: 'none',
                background: 'transparent',
                borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
                color: tab === t ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: tab === t ? 600 : 400,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {t === 'persona' ? 'Persona' : t === 'basic' ? '基本' : t === 'intent' ? '意圖' : t === 'commands' ? '/ 指令' : t === 'routing' ? '路由' : t === 'behavior' ? '行為' : t === 'rate' ? 'Rate' : t === 'channels' ? 'Channels' : 'Raw'}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {error && (
            <div
              style={{
                padding: '8px 12px',
                background: '#fee2e2',
                color: 'var(--danger)',
                borderRadius: 6,
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              ⚠ {error}
            </div>
          )}

          {tab === 'persona' && (
            <>
              <div
                style={{
                  padding: 16,
                  background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                  borderRadius: 8,
                  marginBottom: 16,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Template / 角色
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                  {item.template}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      background: '#dbeafe',
                      color: '#1e40af',
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    {item.persona.archetype}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      background: '#f1f5f9',
                      color: '#475569',
                      borderRadius: 4,
                    }}
                  >
                    {item.category}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label>角色（Role）</label>
                <div
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  {item.persona.role || '（未設定）'}
                </div>
              </div>

              <div className="form-group">
                <label>特質（Traits）</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {item.persona.traits.length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>（無）</span>
                  ) : (
                    item.persona.traits.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          background: '#fef3c7',
                          color: '#92400e',
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        {t}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {item.persona.myth && (
                <div className="form-group">
                  <label>背景（Myth）</label>
                  <div
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: 6,
                      fontSize: 12,
                      fontStyle: 'italic',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {item.persona.myth}
                  </div>
                </div>
              )}

              {item.raw?.prompts?.main && (
                <div className="form-group">
                  <label>System Prompt（核心）</label>
                  <pre
                    style={{
                      padding: 12,
                      background: '#0f172a',
                      color: '#e2e8f0',
                      borderRadius: 6,
                      fontSize: 11,
                      maxHeight: 240,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {item.raw.prompts.main}
                  </pre>
                </div>
              )}
            </>
          )}

          {tab === 'basic' && (
            <>
              <div className="form-group">
                <label>名稱</label>
                <input
                  className="form-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>描述</label>
                <input
                  className="form-input"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Model</label>
                <input
                  className="form-input"
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Temperature: {temperature}</label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group">
                <label>Max Tokens</label>
                <input
                  className="form-input"
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>System Prompt</label>
                <textarea
                  className="form-input"
                  rows={8}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="你是一個專業的…"
                />
              </div>
            </>
          )}

          {tab === 'intent' && (
            <>
              <div className="form-group">
                <label>意圖分類信心門檻（Intent Confidence Threshold）</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={intentConfidenceThreshold}
                  onChange={(e) => setIntentConfidenceThreshold(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  當前值：{intentConfidenceThreshold.toFixed(2)} — 低於此值視為「無法判斷」（unknown）
                </div>
              </div>
              <div className="form-group">
                <label>對話 TTL（秒，conversationTtl）</label>
                <input
                  className="form-input"
                  type="number"
                  value={conversationTtl}
                  onChange={(e) => setConversationTtl(Number(e.target.value))}
                />
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  對話多久無活動後過期（秒）。預設 1800（30 分鐘）
                </div>
              </div>
              <div className="form-group">
                <label>對話歷史上限（historyLimit）</label>
                <input
                  className="form-input"
                  type="number"
                  value={historyLimit}
                  onChange={(e) => setHistoryLimit(Number(e.target.value))}
                />
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  保留最近幾則訊息作為上下文。預設 20
                </div>
              </div>
            </>
          )}

          {tab === 'commands' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  「/」指令列表 — 設定斜線指令的顯示與行為
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSlashCommands([...slashCommands, { command: '', label: '', description: '', target: '', targetType: 'skill', enabled: true }])}
                >
                  ＋ 新增指令
                </button>
              </div>
              {slashCommands.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                  尚無自訂指令。點「＋ 新增指令」開始設定。
                </div>
              ) : (
                slashCommands.map((cmd, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input
                        className="form-input"
                        placeholder="/指令名"
                        value={cmd.command}
                        onChange={(e) => {
                          const next = [...slashCommands]
                          next[i] = { ...cmd, command: e.target.value }
                          setSlashCommands(next)
                        }}
                        style={{ width: 140 }}
                      />
                      <input
                        className="form-input"
                        placeholder="顯示名稱"
                        value={cmd.label}
                        onChange={(e) => {
                          const next = [...slashCommands]
                          next[i] = { ...cmd, label: e.target.value }
                          setSlashCommands(next)
                        }}
                        style={{ flex: 1 }}
                      />
                      <select
                        value={cmd.targetType}
                        onChange={(e) => {
                          const next = [...slashCommands]
                          next[i] = { ...cmd, targetType: e.target.value as 'skill' | 'agent' }
                          setSlashCommands(next)
                        }}
                        className="form-input"
                        style={{ width: 90 }}
                      >
                        <option value="skill">Skill</option>
                        <option value="agent">Agent</option>
                      </select>
                      <input
                        className="form-input"
                        placeholder="目標（skill id 或 agent 名）"
                        value={cmd.target}
                        onChange={(e) => {
                          const next = [...slashCommands]
                          next[i] = { ...cmd, target: e.target.value }
                          setSlashCommands(next)
                        }}
                        style={{ flex: 1 }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        <input
                          type="checkbox"
                          checked={cmd.enabled}
                          onChange={(e) => {
                            const next = [...slashCommands]
                            next[i] = { ...cmd, enabled: e.target.checked }
                            setSlashCommands(next)
                          }}
                        />
                        啟用
                      </label>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setSlashCommands(slashCommands.filter((_, j) => j !== i))}
                      >
                        刪除
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="form-input"
                        placeholder="參數提示（如 <主題>）"
                        value={cmd.argHint ?? ''}
                        onChange={(e) => {
                          const next = [...slashCommands]
                          next[i] = { ...cmd, argHint: e.target.value }
                          setSlashCommands(next)
                        }}
                        style={{ width: 200 }}
                      />
                      <input
                        className="form-input"
                        placeholder="描述（顯示在選單）"
                        value={cmd.description}
                        onChange={(e) => {
                          const next = [...slashCommands]
                          next[i] = { ...cmd, description: e.target.value }
                          setSlashCommands(next)
                        }}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {tab === 'routing' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  行為路由 — 依輸入條件決定走哪個 skill / agent / 回覆
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => setRoutingRules([...routingRules, { id: `rule_${Date.now()}`, pattern: '', matchType: 'keyword', action: 'skill', target: '', params: {}, enabled: true }])}
                >
                  ＋ 新增規則
                </button>
              </div>
              {routingRules.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                  尚無路由規則。點「＋ 新增規則」開始設定。
                </div>
              ) : (
                routingRules.map((rule, i) => (
                  <div key={rule.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <select
                        value={rule.matchType}
                        onChange={(e) => {
                          const next = [...routingRules]
                          next[i] = { ...rule, matchType: e.target.value as RoutingRule['matchType'] }
                          setRoutingRules(next)
                        }}
                        className="form-input"
                        style={{ width: 100 }}
                      >
                        <option value="keyword">關鍵字</option>
                        <option value="regex">Regex</option>
                        <option value="type">類型</option>
                      </select>
                      <input
                        className="form-input"
                        placeholder="匹配條件（關鍵字/regex/類型）"
                        value={rule.pattern}
                        onChange={(e) => {
                          const next = [...routingRules]
                          next[i] = { ...rule, pattern: e.target.value }
                          setRoutingRules(next)
                        }}
                        style={{ flex: 1 }}
                      />
                      <select
                        value={rule.action}
                        onChange={(e) => {
                          const next = [...routingRules]
                          next[i] = { ...rule, action: e.target.value as RoutingRule['action'] }
                          setRoutingRules(next)
                        }}
                        className="form-input"
                        style={{ width: 100 }}
                      >
                        <option value="skill">Skill</option>
                        <option value="agent">Agent</option>
                        <option value="reply">直接回覆</option>
                      </select>
                      <input
                        className="form-input"
                        placeholder="目標（skill id / agent 名 / 回覆文字）"
                        value={rule.target}
                        onChange={(e) => {
                          const next = [...routingRules]
                          next[i] = { ...rule, target: e.target.value }
                          setRoutingRules(next)
                        }}
                        style={{ flex: 1 }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => {
                            const next = [...routingRules]
                            next[i] = { ...rule, enabled: e.target.checked }
                            setRoutingRules(next)
                          }}
                        />
                        啟用
                      </label>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setRoutingRules(routingRules.filter((_, j) => j !== i))}
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {tab === 'rate' && (
            <>
              <div className="form-group">
                <label>每日訊息上限（每 channel）</label>
                <input
                  className="form-input"
                  type="number"
                  value={maxMessagesPerDay}
                  onChange={(e) => setMaxMessagesPerDay(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>冷卻秒數（同一 user 連發間隔）</label>
                <input
                  className="form-input"
                  type="number"
                  value={cooldownSeconds}
                  onChange={(e) => setCooldownSeconds(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={autoReplyEnabled}
                    onChange={(e) => setAutoReplyEnabled(e.target.checked)}
                  />
                  啟用自動回覆（非服務時間）
                </label>
              </div>
              {autoReplyEnabled && (
                <div className="form-group">
                  <label>自動回覆訊息</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={autoReplyMessage}
                    onChange={(e) => setAutoReplyMessage(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {tab === 'channels' && (
            <>
              {loading ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  載入中…
                </div>
              ) : linkedChannels.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                  }}
                >
                  目前沒有 channel 連結到此 agent
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {linkedChannels.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: 12,
                        background: 'var(--bg-secondary)',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          background: c.enabled ? '#d1fae5' : '#f1f5f9',
                          color: c.enabled ? '#065f46' : '#475569',
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        {c.enabled ? '啟用' : '停用'}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
                      <code style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.channelId}</code>
                    </div>
                  ))}
                </div>
              )}
              <div
                style={{
                  marginTop: 12,
                  padding: 8,
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 4,
                }}
              >
                在「Channels」頁面設定 channel 的 linkedAgent
              </div>
            </>
          )}

          {tab === 'raw' && (
            <pre
              style={{
                padding: 12,
                background: '#0f172a',
                color: '#e2e8f0',
                borderRadius: 6,
                fontSize: 11,
                overflow: 'auto',
                maxHeight: 400,
              }}
            >
              {JSON.stringify(item.raw, null, 2)}
            </pre>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn"
            style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }}
            onClick={handleDelete}
          >
            刪除
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>
            取消
          </button>
          {tab !== 'raw' && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '儲存中…' : '儲存'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Helper: detect if a channel is linked to this agent ── */

function isLinkedToAgent(channel: LinkedChannel, agentKey: string): boolean {
  // The channel.list endpoint should already filter or include linkedAgentKey.
  // For round 1 we use a heuristic: if the channel's name contains the agent key,
  // it's likely linked. Real implementation should use channel.linkedAgentKey.
  return channel.name?.toLowerCase().includes(agentKey.toLowerCase()) ?? false
}