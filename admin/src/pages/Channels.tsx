/**
 * Channels Management
 * Card-based layout with sheet detail editing
 * 參考 eea-consult LINE Channel 管理頁
 */
import { useState, useEffect } from 'react'
import { get, post, patch as apiPatch, del } from '../api/client'

/* ── Types ── */

interface AgentDto {
  _key: string
  name: string
  model: string
  enabled: boolean
}

interface SkillDto {
  id: string
  name: string
  description: string
  enabled: boolean
}

interface ChannelDto {
  id: string
  name: string
  channelId: string
  destination?: string
  businessOwnerId: string
  channelSecret: string
  accessToken: string
  enabled: boolean
  status: 'connected' | 'pending' | 'error' | 'disabled'
  permissions?: string[]
  inheritedPermissions?: string[]
  authorizedAgents?: string[]
  pushEnabled?: boolean
  ackEnabled?: boolean
  ackMessage?: string
  concurrencyLimit?: number
  queuePriority?: number
  linkedAgentKey: string
  createdAt: number
  updatedAt: number
}

/* ── Platform config ── */

type Platform = 'line' | 'whatsapp' | 'dingtalk' | 'wecom'

const PLATFORM_META: Record<Platform, { label: string; icon: string }> = {
  line: { label: 'LINE', icon: '💬' },
  whatsapp: { label: 'WhatsApp', icon: '📱' },
  dingtalk: { label: 'DingTalk', icon: '🔷' },
  wecom: { label: 'WeCom', icon: '🔶' },
}

const PLATFORM_CONFIG_FIELDS: Record<Platform, { key: string; label: string; password: boolean }[]> = {
  line: [
    { key: 'channelId', label: 'Channel ID', password: false },
    { key: 'channelSecret', label: 'Channel Secret', password: true },
    { key: 'accessToken', label: 'Access Token', password: true },
  ],
  whatsapp: [
    { key: 'channelId', label: 'Phone Number ID', password: false },
    { key: 'accessToken', label: 'Access Token', password: true },
  ],
  dingtalk: [
    { key: 'channelId', label: 'App Key', password: false },
    { key: 'channelSecret', label: 'App Secret', password: true },
  ],
  wecom: [
    { key: 'channelId', label: 'Corp ID', password: false },
    { key: 'channelSecret', label: 'Agent ID', password: false },
    { key: 'accessToken', label: 'Secret', password: true },
  ],
}

/* ── Component ── */

export function Channels() {
  const [channels, setChannels] = useState<ChannelDto[]>([])
  const [agents, setAgents] = useState<AgentDto[]>([])
  const [skills, setSkills] = useState<SkillDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [formPlatform, setFormPlatform] = useState<Platform>('line')
  const [formName, setFormName] = useState('')
  const [formBusinessId, setFormBusinessId] = useState('')
  const [formAgent, setFormAgent] = useState('')
  const [formChannelId, setFormChannelId] = useState('')
  const [formDestination, setFormDestination] = useState('')
  const [formSecret, setFormSecret] = useState('')
  const [formToken, setFormToken] = useState('')
  const [saving, setSaving] = useState(false)

  // Detail sheet
  const [detailChannel, setDetailChannel] = useState<ChannelDto | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [dPlatform, setDPlatform] = useState<Platform>('line')
  const [dName, setDName] = useState('')
  const [dBusinessId, setDBusinessId] = useState('')
  const [dAgent, setDAgent] = useState('')
  const [dAuthorizedAgents, setDAuthorizedAgents] = useState<string[]>([])
  const [dChannelId, setDChannelId] = useState('')
  const [dDestination, setDDestination] = useState('')
  const [dSecret, setDSecret] = useState('')
  const [dToken, setDToken] = useState('')
  const [dPermissions, setDPermissions] = useState<string[]>([])
  const [dInherited, setDInherited] = useState<string[]>([])
  const [dPermAll, setDPermAll] = useState(true)
  const [dPushEnabled, setDPushEnabled] = useState(true)
  const [dAckEnabled, setDAckEnabled] = useState(true)
  const [dAckMessage, setDAckMessage] = useState('')
  const [dConcurrency, setDConcurrency] = useState(2)
  const [detailSaving, setDetailSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [verifyInfo, setVerifyInfo] = useState<any>(null)

  /* ── Data loading ── */

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [chRes, agRes, skRes] = await Promise.all([
        get<{ data: ChannelDto[] }>('/admin/channels'),
        get<{ data: AgentDto[] }>('/admin/agents'),
        get<{ data: SkillDto[] }>('/agent/skills'),
      ])
      setChannels(chRes.data ?? [])
      setAgents(agRes.data ?? [])
      setSkills(skRes.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const activeCount = channels.filter((c) => c.enabled).length

  /* ── Create ── */

  function resetCreate() {
    setFormPlatform('line')
    setFormName('')
    setFormBusinessId('')
    setFormAgent('')
    setFormChannelId('')
    setFormDestination('')
    setFormSecret('')
    setFormToken('')
  }

  async function handleCreate() {
    if (!formName || !formChannelId) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: formName,
        channelId: formChannelId,
        channelSecret: formSecret,
        accessToken: formToken,
        linkedAgentKey: formAgent,
        businessOwnerId: formBusinessId || 'admin',
      }
      if (formDestination) body.destination = formDestination
      await post('/admin/channels', body)
      setCreateOpen(false)
      resetCreate()
      await loadAll()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  /* ── Detail open ── */

  function openDetail(ch: ChannelDto) {
    setDetailChannel(ch)
    // Determine platform by channelId prefix heuristic (all line for now)
    setDPlatform('line')
    setDName(ch.name)
    setDBusinessId(ch.businessOwnerId)
    setDAgent(ch.linkedAgentKey)
    setDChannelId(ch.channelId)
    setDDestination(ch.destination || '')
    setDSecret(ch.channelSecret || '')
    setDToken(ch.accessToken || '')
    setDPermissions(ch.permissions ?? [])
    setDInherited(ch.inheritedPermissions ?? [])
    setDAuthorizedAgents(ch.authorizedAgents ?? [])
    setDPermAll(!Array.isArray(ch.permissions))
    setDPushEnabled(ch.pushEnabled ?? true)
    setDAckEnabled(ch.ackEnabled ?? true)
    setDAckMessage(ch.ackMessage ?? '')
    setDConcurrency(ch.concurrencyLimit ?? 2)
    setTestResult(null)
    setVerifyInfo(null)
    setDetailOpen(true)
  }

  /* ── Detail save ── */

  async function handleDetailSave() {
    if (!detailChannel) return
    setDetailSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: dName,
        linkedAgentKey: dAgent,
      }
      if (dAuthorizedAgents.length > 0) body.authorizedAgents = dAuthorizedAgents
      if (dChannelId) body.channelId = dChannelId
      if (dDestination) body.destination = dDestination
      if (dSecret) body.channelSecret = dSecret
      if (dToken) body.accessToken = dToken
      if (dBusinessId) body.businessOwnerId = dBusinessId
      // permissions：全部允許 = 不送（undefined）；限制 = 送額外增補清單
      if (!dPermAll) body.permissions = dPermissions
      body.pushEnabled = dPushEnabled
      body.ackEnabled = dAckEnabled
      if (dAckMessage) body.ackMessage = dAckMessage
      body.concurrencyLimit = dConcurrency

      await apiPatch(`/admin/channels/${encodeURIComponent(detailChannel.id)}`, body)
      setDetailOpen(false)
      setDetailChannel(null)
      await loadAll()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setDetailSaving(false)
    }
  }

  /* ── Test Connection ── */

  async function handleTestConnection() {
    if (!detailChannel) return
    setTesting(true)
    setTestResult(null)
    setVerifyInfo(null)
    try {
      const res = await post<{ ok: boolean; info?: any; error?: string }>(
        `/admin/channels/${encodeURIComponent(detailChannel.id)}/test`,
        {}
      )
      setTestResult({ ok: !!res.ok, message: res.ok ? 'Connection OK' : (res.error ?? 'Connection failed') })
      if (res.ok && res.info) setVerifyInfo(res.info)
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  /* ── Toggle / Delete ── */

  async function handleToggle(ch: ChannelDto) {
    try {
      await apiPatch(`/admin/channels/${encodeURIComponent(ch.id)}`, { enabled: !ch.enabled })
      await loadAll()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleDelete(ch: ChannelDto) {
    if (!confirm(`Delete channel "${ch.name}"?`)) return
    try {
      await del(`/admin/channels/${encodeURIComponent(ch.id)}`)
      setDetailOpen(false)
      setDetailChannel(null)
      await loadAll()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  /* ── Webhook helper ── */

  function webhookUrl(ch: ChannelDto): string {
    return `https://la.aiconn.ai/webhook/ch_${ch.id}`
  }

  function copy(str: string) {
    navigator.clipboard.writeText(str).catch(() => {})
  }

  /* ── Render ── */

  const createFields = PLATFORM_CONFIG_FIELDS[formPlatform]
  const detailMeta = PLATFORM_META['line']

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Channel Management</h1>
        <p className="page-subtitle">Manage communication channels and link them to agents</p>
      </div>

      {/* ── Header bar ── */}
      <div
        style={{
          marginBottom: 20,
          padding: '16px 20px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text)' }}>{activeCount}</strong> / {channels.length} active
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { resetCreate(); setCreateOpen(true) }}>
          + Add Channel
        </button>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: '#fee2e2', color: 'var(--danger)', borderRadius: 6, fontSize: 12, marginBottom: 16 }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Channel card grid ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>Loading...</div>
      ) : channels.length === 0 ? (
        <div
          style={{
            textAlign: 'center', padding: 64, borderRadius: 16,
            border: '2px dashed var(--border)', color: 'var(--text-secondary)', fontSize: 14,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No channels yet</div>
          <div style={{ fontSize: 12 }}>Click "Add Channel" to create one</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {channels.map((ch) => {
            const meta = PLATFORM_META['line']
            const agent = agents.find((a) => a._key === ch.linkedAgentKey)
            return (
              <div
                key={ch.id}
                className="card"
                style={{
                  padding: 0, overflow: 'hidden', cursor: 'pointer',
                  transition: 'all 0.2s', opacity: ch.enabled ? 1 : 0.55,
                }}
                onClick={() => openDetail(ch)}
                onMouseEnter={(e) => { if (ch.enabled) e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
              >
                {/* Card header */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderBottom: '1px solid var(--border)',
                    background: ch.enabled ? '#ecfdf5' : '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{meta.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{ch.name}</span>
                  </div>
                  <label onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={ch.enabled}
                      onChange={() => handleToggle(ch)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                  </label>
                </div>

                {/* Card body */}
                <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Platform icon */}
                  <div
                    style={{
                      width: 64, height: 64, borderRadius: 10,
                      background: '#f0f9ff', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 28, flexShrink: 0,
                    }}
                  >
                    {meta.icon}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                      {ch.businessOwnerId}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <code style={{ fontSize: 11, background: '#f1f5f9', padding: '1px 6px', borderRadius: 3 }}>{ch.channelId}</code>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginBottom: 2 }}>
                      key: {ch.id}
                    </div>
                    {agent ? (
                      <div style={{ fontSize: 11, color: '#059669' }}>
                        Agent: {agent.name}
                      </div>
                    ) : ch.linkedAgentKey ? (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        Agent: {ch.linkedAgentKey}
                      </div>
                    ) : null}
                  </div>
                  {/* Status badge */}
                  <span className={`badge ${ch.enabled ? 'badge-green' : 'badge-gray'}`}>
                    {ch.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create Dialog ── */}
      {createOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCreateOpen(false) }}>
          <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Channel</h2>
              <button className="modal-close" onClick={() => { setCreateOpen(false); resetCreate() }}>✕</button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Platform</label>
                  <select className="form-input" value={formPlatform} onChange={(e) => setFormPlatform(e.target.value as Platform)}>
                    {Object.entries(PLATFORM_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Channel Name *</label>
                  <input className="form-input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="My Channel" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Business Owner ID</label>
                  <input className="form-input" value={formBusinessId} onChange={(e) => setFormBusinessId(e.target.value)} placeholder="admin" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Link Agent</label>
                  <select className="form-input" value={formAgent} onChange={(e) => setFormAgent(e.target.value)}>
                    <option value="">— None —</option>
                    {agents.map((a) => (
                      <option key={a._key} value={a._key}>{a.name} ({a.model})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  {PLATFORM_META[formPlatform].icon} {PLATFORM_META[formPlatform].label} Settings
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {createFields.map((f) => (
                    <div key={f.key} className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{f.label}</label>
                      <input
                        className="form-input"
                        type={f.password ? 'password' : 'text'}
                        value={
                          f.key === 'channelId' ? formChannelId :
                          f.key === 'channelSecret' ? formSecret : formToken
                        }
                        onChange={(e) => {
                          if (f.key === 'channelId') setFormChannelId(e.target.value)
                          else if (f.key === 'channelSecret') setFormSecret(e.target.value)
                          else setFormToken(e.target.value)
                        }}
                      />
                    </div>
                  ))}
                </div>
                {formPlatform === 'line' && (
                  <div className="form-group" style={{ margin: '12px 0 0' }}>
                    <label className="form-label">Webhook Destination (Bot User ID)</label>
                    <input
                      className="form-input"
                      value={formDestination}
                      onChange={(e) => setFormDestination(e.target.value)}
                      placeholder="LINE webhook destination，例如 Uxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setCreateOpen(false); resetCreate() }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !formName || !formChannelId}>
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Sheet ── */}
      {detailOpen && detailChannel && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDetailOpen(false);
              setDetailChannel(null);
            }
          }}
        >
          <div
            className="modal"
            style={{ width: 500, position: 'fixed', right: 0, top: 0, bottom: 0, margin: 0, borderRadius: '12px 0 0 12px', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">{detailMeta?.icon} Channel Settings</h2>
              <button className="modal-close" onClick={() => { setDetailOpen(false); setDetailChannel(null) }}>✕</button>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              {/* Read-only key + webhook */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Channel Key</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="form-input" value={detailChannel.id} readOnly style={{ fontSize: 11, fontFamily: 'monospace', flex: 1 }} />
                  <button className="btn btn-sm btn-secondary" onClick={() => copy(detailChannel.id)}>Copy</button>
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Webhook Destination</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="form-input" value={dDestination} onChange={(e) => setDDestination(e.target.value)} placeholder="LINE destination (Bot User ID)" style={{ fontSize: 11, fontFamily: 'monospace', flex: 1 }} />
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Webhook URL</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="form-input" value={webhookUrl(detailChannel)} readOnly style={{ fontSize: 11, fontFamily: 'monospace', flex: 1 }} />
                  <button className="btn btn-sm btn-secondary" onClick={() => copy(webhookUrl(detailChannel))}>Copy</button>
                </div>
              </div>

              {/* Test connection */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Connection</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn btn-sm btn-primary" onClick={handleTestConnection} disabled={testing}>
                    {testing ? 'Testing...' : 'Test Connection'}
                  </button>
                  {testResult && (
                    <span style={{ fontSize: 12, color: testResult.ok ? '#059669' : 'var(--danger)' }}>
                      {testResult.ok ? '✓' : '✗'} {testResult.message}
                    </span>
                  )}
                </div>
                {verifyInfo && (
                  <div style={{ marginTop: 8, padding: 8, background: '#f8fafc', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                    {verifyInfo.displayName && <div>Name: {verifyInfo.displayName}</div>}
                    {verifyInfo.userId && <div>Bot ID: {verifyInfo.userId}</div>}
                    {verifyInfo.basicId && <div>Basic ID: @{verifyInfo.basicId}</div>}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border)' }} />

              {/* Editable fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Platform</label>
                  <select className="form-input" value={dPlatform} onChange={(e) => setDPlatform(e.target.value as Platform)}>
                    {Object.entries(PLATFORM_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Status</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                    <input type="checkbox" checked={detailChannel.enabled} onChange={() => handleToggle(detailChannel)} style={{ width: 16, height: 16 }} />
                    <span style={{ fontSize: 12 }}>{detailChannel.enabled ? 'Active' : 'Disabled'}</span>
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Channel Name</label>
                <input className="form-input" value={dName} onChange={(e) => setDName(e.target.value)} />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Business Owner ID</label>
                <input className="form-input" value={dBusinessId} onChange={(e) => setDBusinessId(e.target.value)} />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">主 Agent（預設入口）</label>
                <select className="form-input" value={dAgent} onChange={(e) => setDAgent(e.target.value)}>
                  <option value="">— None —</option>
                  {agents.map((a) => (
                    <option key={a._key} value={a._key}>{a.name} ({a.model})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">授權 Agents（可多選）</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {agents.filter((a) => a.enabled && a._key !== dAgent).map((a) => (
                    <label key={a._key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={dAuthorizedAgents.includes(a._key)}
                        onChange={(e) => {
                          setDAuthorizedAgents(e.target.checked ? [...dAuthorizedAgents, a._key] : dAuthorizedAgents.filter((x) => x !== a._key))
                        }}
                      />
                      {a.name}
                    </label>
                  ))}
                </div>
              </div>

              {/* Permissions — 可呼叫清單 */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  🔐 Permissions（/ 可呼叫清單）
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  系統指令（/ /new /help /readme）與所有 Skills 預設可用。權限僅控制可呼叫的 Agents。
                </div>
                {/* 基礎 skills 唯讀 — 所有 skills 皆默認必備 */}
                {skills.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                      ⭐ Skills（預設可用，由 Agent 白名單控制）
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                      {skills.map((s) => (
                        <span key={s.id} style={{ padding: '2px 8px', background: '#f1f5f9', color: '#334155', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={dPermAll}
                    onChange={(e) => setDPermAll(e.target.checked)}
                    style={{ width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>全部允許（不限制）</span>
                </label>
                {!dPermAll && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {/* 繼承白名單（唯讀） */}
                    {dInherited.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                          📌 主 Agent + 授權 Agents 自動權限（唯讀）
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {dInherited.map((id) => {
                            const agent = agents.find((a) => a._key === id)
                            const skill = skills.find((s) => s.id === id)
                            const label = agent?.name ?? skill?.name ?? id
                            return (
                              <span key={id} style={{ padding: '2px 8px', background: '#ecfdf5', color: '#059669', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>
                                {label}
                              </span>
                            )
                          })}
                        </div>
                      </>
                    )}
                    {/* 額外增補 */}
                    {agents.filter((a) => a.enabled).length > 0 && (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#059669', marginTop: 4 }}>🤖 額外 Agents</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                          {agents.filter((a) => a.enabled).map((a) => (
                            <label key={a._key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                              <input
                                type="checkbox"
                                checked={dPermissions.includes(a._key)}
                                onChange={(e) => {
                                  setDPermissions(e.target.checked ? [...dPermissions, a._key] : dPermissions.filter((x) => x !== a._key))
                                }}
                              />
                              {a.name}
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Async Queue 設定 */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  ⚡ 異步處理設定
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  訊息異步入隊處理，立即回 200。慢任務完成後用 push 回覆（需 LINE 開 push 權限）。
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Push 回覆</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 0' }}>
                      <input type="checkbox" checked={dPushEnabled} onChange={(e) => setDPushEnabled(e.target.checked)} style={{ width: 15, height: 15 }} />
                      <span style={{ fontSize: 12 }}>啟用 push（慢任務推結果）</span>
                    </label>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">並發數（此 channel）</label>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={8}
                      value={dConcurrency}
                      onChange={(e) => setDConcurrency(Number(e.target.value) || 1)}
                    />
                  </div>
                </div>
                <div className="form-group" style={{ margin: '8px 0 0' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={dAckEnabled} onChange={(e) => setDAckEnabled(e.target.checked)} style={{ width: 15, height: 15 }} />
                    Ack 文案（慢任務先回「處理中」）
                  </label>
                  <input
                    className="form-input"
                    value={dAckMessage}
                    onChange={(e) => setDAckMessage(e.target.value)}
                    placeholder="收到，處理中..."
                    disabled={!dAckEnabled}
                    style={{ marginTop: 6 }}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  {detailMeta?.icon} {detailMeta?.label} Settings
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {PLATFORM_CONFIG_FIELDS.line.map((f) => (
                    <div key={f.key} className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{f.label}</label>
                      <input
                        className="form-input"
                        type={f.password ? 'password' : 'text'}
                        value={
                          f.key === 'channelId' ? dChannelId :
                          f.key === 'channelSecret' ? dSecret : dToken
                        }
                        onChange={(e) => {
                          if (f.key === 'channelId') setDChannelId(e.target.value)
                          else if (f.key === 'channelSecret') setDSecret(e.target.value)
                          else setDToken(e.target.value)
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(detailChannel)}>Delete</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => { setDetailOpen(false); setDetailChannel(null) }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleDetailSave} disabled={detailSaving}>
                  {detailSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
