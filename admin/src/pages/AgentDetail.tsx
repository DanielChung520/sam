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
  const [tab, setTab] = useState<'persona' | 'basic' | 'behavior' | 'rate' | 'channels' | 'raw'>('persona')
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
          maxWidth: 720,
          width: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
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
          {(['persona', 'basic', 'behavior', 'rate', 'channels', 'raw'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 14px',
                border: 'none',
                background: 'transparent',
                borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
                color: tab === t ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: tab === t ? 600 : 400,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {t === 'persona' ? 'Persona' : t === 'basic' ? '基本' : t === 'behavior' ? '行為' : t === 'rate' ? 'Rate' : t === 'channels' ? 'Channels' : 'Raw'}
            </button>
          ))}
        </div>

        <div className="modal-body">
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