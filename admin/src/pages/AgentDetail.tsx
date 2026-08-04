/**
 * Agent Detail Drawer — for Main Agents
 *
 * Shows: system prompt, model, rate limit, enabled skills, stats, linked channels
 * Round 1 scope: read + edit. Sub-Agent detail deferred to round 2.
 */
import { useState } from 'react'
import { patch as apiPatch, del } from '../api/client'

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

// 意圖規則（名稱 / 型別 / 細分型 / 判斷 / 行為）
interface IntentRuleItem {
  id: string
  name: string
  messageType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker'
  subType?: string
  match: {
    type: 'keyword' | 'regex'
    patterns: string[]
  }
  behavior: {
    action: 'agent' | 'skill' | 'llm'
    target: string
    params?: Record<string, unknown>
  }
  enabled: boolean
  priority: number
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
  const [tab, setTab] = useState<'persona' | 'basic' | 'intent' | 'rate' | 'raw'>('persona')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // 意圖規則（多關鍵詞 → 意圖 → 行為）
  const [intents, setIntents] = useState<IntentRuleItem[]>(item.raw?.intents ?? [])

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
        intents,
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
          {(['persona', 'basic', 'intent', 'rate', 'raw'] as const).map((t) => (
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
              {t === 'persona' ? 'Persona' : t === 'basic' ? '設定' : t === 'intent' ? '意圖' : t === 'rate' ? 'Rate' : 'Raw'}
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

          {tab === 'intent' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  名稱 / 型別 / 細分型 / 判斷 / 行為（依優先序高→低比對，命中即執行）
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    setIntents([
                      ...intents,
                      {
                        id: `intent-${Date.now()}`,
                        name: '',
                        messageType: 'text',
                        subType: '問候',
                        match: { type: 'keyword', patterns: [] },
                        behavior: { action: 'llm', target: '' },
                        enabled: true,
                        priority: intents.length + 1,
                      },
                    ])
                  }
                >
                  ＋ 新增意圖規則
                </button>
              </div>
              {intents.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                  尚無意圖規則。點「＋ 新增意圖規則」設定型別、細分型、判斷與對應行為。
                </div>
              ) : (
                intents.map((rule, i) => (
                  <div key={rule.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input
                        className="form-input"
                        placeholder="名稱（如：問候、名片收集）"
                        value={rule.name}
                        onChange={(e) =>
                          setIntents(intents.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                        }
                        style={{ flex: 2 }}
                      />
                      <select
                        className="form-input"
                        value={rule.messageType}
                        onChange={(e) =>
                          setIntents(
                            intents.map((r, j) =>
                              j === i ? { ...r, messageType: e.target.value as IntentRuleItem['messageType'] } : r,
                            ),
                          )
                        }
                        style={{ flex: 1 }}
                      >
                        <option value="text">文字 (text)</option>
                        <option value="image">圖片 (image)</option>
                        <option value="video">影片 (video)</option>
                        <option value="audio">語音 (audio)</option>
                        <option value="file">檔案 (file)</option>
                        <option value="location">位置 (location)</option>
                        <option value="sticker">貼圖 (sticker)</option>
                      </select>
                      <select
                        className="form-input"
                        value={rule.subType ?? ''}
                        onChange={(e) =>
                          setIntents(intents.map((r, j) => (j === i ? { ...r, subType: e.target.value } : r)))
                        }
                        style={{ flex: 1 }}
                      >
                        <option value="">— 無細分型 —</option>
                        {rule.messageType === 'text' ? (
                          <>
                            <option value="問候">text: 問候</option>
                            <option value="打招呼">text: 打招呼</option>
                            <option value="詢問">text: 詢問</option>
                            <option value="指令">text: 指令</option>
                          </>
                        ) : rule.messageType === 'image' ? (
                          <>
                            <option value="問候及祝福">image: 問候及祝福</option>
                            <option value="名片">image: 名片</option>
                            <option value="其他">image: 其他</option>
                          </>
                        ) : null}
                      </select>
                      <select
                        className="form-input"
                        value={rule.behavior.action}
                        onChange={(e) =>
                          setIntents(
                            intents.map((r, j) =>
                              j === i
                                ? { ...r, behavior: { ...r.behavior, action: e.target.value as IntentRuleItem['behavior']['action'] } }
                                : r,
                            ),
                          )
                        }
                        style={{ flex: 1 }}
                      >
                        <option value="llm">LLM</option>
                        <option value="skill">Skills</option>
                        <option value="agent">Sub-Agent</option>
                      </select>
                      <input
                        className="form-input"
                        placeholder="目標（agent 名 / skill id / llm 提示）"
                        value={rule.behavior.target}
                        onChange={(e) =>
                          setIntents(
                            intents.map((r, j) =>
                              j === i ? { ...r, behavior: { ...r.behavior, target: e.target.value } } : r,
                            ),
                          )
                        }
                        style={{ flex: 3 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <select
                        className="form-input"
                        value={rule.match.type}
                        onChange={(e) =>
                          setIntents(
                            intents.map((r, j) =>
                              j === i ? { ...r, match: { ...r.match, type: e.target.value as IntentRuleItem['match']['type'] } } : r,
                            ),
                          )
                        }
                        style={{ width: 110 }}
                      >
                        <option value="keyword">關鍵詞</option>
                        <option value="regex">Regex</option>
                      </select>
                      <input
                        className="form-input"
                        placeholder="判斷內容（頓號分隔；留空則僅靠型別/細分型命中）"
                        value={rule.match.patterns.join('、')}
                        onChange={(e) =>
                          setIntents(
                            intents.map((r, j) =>
                              j === i
                                ? { ...r, match: { ...r.match, patterns: e.target.value.split(/[、,，\n]/).map((s) => s.trim()).filter(Boolean) } }
                                : r,
                            ),
                          )
                        }
                        style={{ flex: 3 }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        優先序
                        <input
                          className="form-input"
                          type="number"
                          value={rule.priority}
                          onChange={(e) =>
                            setIntents(intents.map((r, j) => (j === i ? { ...r, priority: Number(e.target.value) } : r)))
                          }
                          style={{ width: 70 }}
                        />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) =>
                            setIntents(intents.map((r, j) => (j === i ? { ...r, enabled: e.target.checked } : r)))
                          }
                        />
                        啟用
                      </label>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setIntents(intents.filter((_, j) => j !== i))}
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
