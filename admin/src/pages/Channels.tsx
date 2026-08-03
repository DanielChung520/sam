/**
 * Channels Management
 * Card-based layout with sheet detail editing
 * 參考 eea-consult LINE Channel 管理頁
 */
import { useState, useEffect } from 'react'
import { get, post, patch as apiPatch, del } from '../api/client'
import { AvatarPicker } from '../components/AvatarPicker'

/* ── Types ── */

interface AgentDto {
  _key: string
  name: string
  model: string
  enabled: boolean
  category?: string
}

interface SkillDto {
  id: string
  name: string
  description: string
  enabled: boolean
}

interface AccountDto {
  _key: string
  name: string
  email?: string
  username?: string
  channelIds?: string[]
  enabled?: boolean
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
  avatar?: string
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
  const [accounts, setAccounts] = useState<AccountDto[]>([])
  const [skills, setSkills] = useState<SkillDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [formPlatform, setFormPlatform] = useState<Platform>('line')
  const [formName, setFormName] = useState('')
  const [formBusinessId, setFormBusinessId] = useState('')
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
  const [dAvatar, setDAvatar] = useState('')
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
      const [chRes, agRes, skRes, acRes] = await Promise.all([
        get<{ data: ChannelDto[] }>('/admin/channels'),
        get<{ data: AgentDto[] }>('/admin/agents'),
        get<{ data: SkillDto[] }>('/agent/skills'),
        get<{ data: AccountDto[] }>('/admin/accounts'),
      ])
      setChannels(chRes.data ?? [])
      setAgents(agRes.data ?? [])
      setSkills(skRes.data ?? [])
      setAccounts(acRes.data ?? [])
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
    setDAvatar(ch.avatar || '')
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
      if (dAvatar) body.avatar = dAvatar
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
                  {/* Platform icon / avatar */}
                  <div
                    style={{
                      width: 64, height: 64, borderRadius: 10,
                      background: '#f0f9ff', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 28, flexShrink: 0, overflow: 'hidden',
                    }}
                  >
                    {ch.avatar ? (
                      ch.avatar.startsWith('data:') ? (
                        <img src={ch.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <img src={`/api/v1/avatars/${encodeURIComponent(ch.avatar)}`} alt={ch.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )
                    ) : (
                      meta.icon
                    )}
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
                  <label className="form-label">所屬帳號 *</label>
                  <select className="form-input" value={formBusinessId} onChange={(e) => setFormBusinessId(e.target.value)}>
                    <option value="">— 選擇帳號 —</option>
                    {accounts.filter((a) => a.enabled !== false).map((a) => (
                      <option key={a._key} value={a._key}>{a.name}（{a.username ?? a._key}）</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Orchestration</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {agents.find((a) => a.category === 'orchestrator' && a.enabled)?.name ?? 'Polaris'}
                    </span>
                    <span className="badge badge-green">系統自動綁定</span>
                  </div>
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
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !formName || !formChannelId || !formBusinessId}>
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
            style={{
              width: 540,
              maxWidth: '100vw',
              maxHeight: 'none',
              position: 'fixed',
              right: 0,
              top: 0,
              bottom: 0,
              margin: 0,
              borderRadius: '12px 0 0 12px',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
              animation: 'drawerSlideIn 0.25s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, marginBottom: 0 }}>
              <h2 className="modal-title">{detailMeta?.icon} Channel Settings</h2>
              <button className="modal-close" onClick={() => { setDetailOpen(false); setDetailChannel(null) }}>✕</button>
            </div>

            <div style={{ display: 'grid', gap: 14, padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
              {/* ── 1. 基本資訊 ── */}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>🔧 基本資訊</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>Channel 身份與啟用狀態</div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">系統 Key（UUID，不可變）</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="form-input" value={detailChannel.id} readOnly style={{ fontSize: 11, fontFamily: 'monospace', flex: 1 }} />
                    <button className="btn btn-sm btn-secondary" onClick={() => copy(detailChannel.id)}>Copy</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'center', marginTop: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">頭像</label>
                    <AvatarPicker value={dAvatar} onChange={setDAvatar} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Channel Name</label>
                    <input className="form-input" value={dName} onChange={(e) => setDName(e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ margin: '12px 0 0' }}>
                  <label className="form-label">所屬帳號</label>
                  <select className="form-input" value={dBusinessId} onChange={(e) => setDBusinessId(e.target.value)}>
                    <option value="">— 選擇帳號 —</option>
                    {accounts.filter((a) => a.enabled !== false).map((a) => (
                      <option key={a._key} value={a._key}>{a.name}（{a.username ?? a._key}）</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
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
              </div>

              {/* ── 2. LINE 連線 ── */}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>🔌 LINE 連線</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>Webhook 路由與 credential 驗證</div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Webhook Destination（Bot User ID）</label>
                  <input className="form-input" value={dDestination} onChange={(e) => setDDestination(e.target.value)} placeholder="LINE destination (Bot User ID)" style={{ fontSize: 11, fontFamily: 'monospace' }} />
                </div>
                <div className="form-group" style={{ margin: '10px 0 0' }}>
                  <label className="form-label">Webhook URL</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="form-input" value={webhookUrl(detailChannel)} readOnly style={{ fontSize: 11, fontFamily: 'monospace', flex: 1 }} />
                    <button className="btn btn-sm btn-secondary" onClick={() => copy(webhookUrl(detailChannel))}>Copy</button>
                  </div>
                </div>
                <div className="form-group" style={{ margin: '10px 0 0' }}>
                  <label className="form-label">連線狀態</label>
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
                    <div style={{ marginTop: 8, padding: 8, background: '#fff', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                      {verifyInfo.displayName && <div>Name: {verifyInfo.displayName}</div>}
                      {verifyInfo.userId && <div>Bot ID: {verifyInfo.userId}</div>}
                      {verifyInfo.basicId && <div>Basic ID: @{verifyInfo.basicId}</div>}
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
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
                      {f.key === 'channelId' && (
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>
                          對應 LINE Developers Console 的 Channel ID，可維護
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 3. Agent 綁定與權限 ── */}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>🤖 Agent 綁定與權限</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>Orchestration 主 Agent + 授權 Agents，控制 / 可呼叫清單</div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Orchestration（系統自動綁定）</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {agents.find((a) => a._key === dAgent)?.name ?? 'Polaris'}
                    </span>
                    <span className="badge badge-green">自動綁定</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                    主 Agent（Orchestration 入口）由系統固定，不需選擇。下方可授權其他 Agents。
                  </div>
                </div>
                <div className="form-group" style={{ margin: '10px 0 0' }}>
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

                <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    系統指令（/ /new /help /readme）與所有 Skills 預設可用。權限僅控制可呼叫的 Agents。
                  </div>
                  {skills.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                        ⭐ Skills（預設可用，由 Agent 白名單控制）
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '6px 0 10px' }}>
                        {skills.map((s) => (
                          <span key={s.id} style={{ padding: '2px 8px', background: '#fff', color: '#334155', borderRadius: 4, fontSize: 11, fontWeight: 500, border: '1px solid var(--border)' }}>
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
              </div>

              {/* ── 4. 異步處理 ── */}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>⚡ 異步處理設定</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>訊息異步入隊 → 立即 200 → 背景並發處理 → push 結果</div>
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
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '14px 20px', margin: 0, flexShrink: 0, background: 'var(--bg-card)' }}>
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
