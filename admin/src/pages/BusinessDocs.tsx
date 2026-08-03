import { useState, useEffect } from 'react'
import { get, post, del } from '../api/client'

type BusinessDocType = 'product' | 'pricing' | 'faq' | 'policy' | 'menu'

interface BusinessDoc {
  _key: string
  channelId: string
  type: BusinessDocType
  title: string
  content: string
  tags: string[]
  enabled: boolean
  createdAt: number
  updatedAt: number
}

const TYPE_META: Record<BusinessDocType, { label: string; color: string }> = {
  product: { label: '產品', color: '#3b82f6' },
  pricing: { label: '價目', color: '#10b981' },
  faq: { label: 'FAQ', color: '#f59e0b' },
  policy: { label: '政策', color: '#ef4444' },
  menu: { label: '菜單', color: '#8b5cf6' },
}

const TYPE_OPTIONS: BusinessDocType[] = ['product', 'pricing', 'faq', 'policy', 'menu']

export function BusinessDocs() {
  const [docs, setDocs] = useState<BusinessDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<BusinessDocType | 'all'>('all')
  const [searchText, setSearchText] = useState('')
  const [channelId, setChannelId] = useState('ch_test')
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formChannelId, setFormChannelId] = useState('ch_test')
  const [formType, setFormType] = useState<BusinessDocType>('faq')
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formTags, setFormTags] = useState('')
  const [formEnabled, setFormEnabled] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await get<{ data: BusinessDoc[] }>(`/admin/business-docs?channelId=${channelId}`)
      setDocs(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [channelId])

  const filtered = docs.filter((d) => {
    if (filterType !== 'all' && d.type !== filterType) return false
    if (searchText && !d.title.toLowerCase().includes(searchText.toLowerCase()) && !d.content.toLowerCase().includes(searchText.toLowerCase())) return false
    return true
  })

  async function handleCreate() {
    if (!formTitle.trim() || !formContent.trim()) {
      setError('標題和內容不能為空')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const tags = formTags.split(',').map((t) => t.trim()).filter(Boolean)
      await post('/admin/business-docs', {
        channelId: formChannelId,
        type: formType,
        title: formTitle,
        content: formContent,
        tags,
        enabled: formEnabled,
      })
      setCreateOpen(false)
      setFormTitle('')
      setFormContent('')
      setFormTags('')
      setChannelId(formChannelId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(key: string) {
    if (!confirm(`確定刪除？此操作無法復原。`)) return
    try {
      await del(`/admin/business-docs/${encodeURIComponent(key)}`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleToggleEnabled(d: BusinessDoc) {
    try {
      await post(`/admin/business-docs/${encodeURIComponent(d._key)}`, {
        ...d,
        enabled: !d.enabled,
      }).catch(() =>
        // PATCH endpoint
        fetch(`/api/v1/admin/business-docs/${encodeURIComponent(d._key)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !d.enabled }),
        })
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="page-title">Business Knowledge Base</h1>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            管理業務知識（產品 / 價目 / FAQ / 政策 / 菜單）— 給 AI 檢索用
          </span>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setFormChannelId(channelId)
              setCreateOpen(true)
            }}
          >
            + 新增
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Channel ID"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          style={{ maxWidth: 240 }}
        />
        <div className="tabs">
          <button
            className={`tab ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            全部 ({docs.length})
          </button>
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t}
              className={`tab ${filterType === t ? 'active' : ''}`}
              onClick={() => setFilterType(t)}
            >
              {TYPE_META[t].label} ({docs.filter((d) => d.type === t).length})
            </button>
          ))}
        </div>
        <input
          type="text"
          className="form-input"
          placeholder="搜尋標題或內容…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ maxWidth: 280 }}
        />
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: '#fee2e2', color: 'var(--danger)', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>載入中…</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
          尚未建立任何 Business Doc。點上方「+ 新增」開始。
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map((d) => {
            const tm = TYPE_META[d.type]
            return (
              <div key={d._key} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', background: tm.color + '22', color: tm.color, borderRadius: 4, fontWeight: 600 }}>
                    {tm.label}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      background: d.enabled ? '#d1fae5' : '#f1f5f9',
                      color: d.enabled ? '#065f46' : '#475569',
                      borderRadius: 4,
                      fontWeight: 600,
                      marginLeft: 'auto',
                    }}
                  >
                    {d.enabled ? '啟用' : '停用'}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{d.title}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    marginBottom: 12,
                    minHeight: 48,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {d.content}
                </div>
                {d.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                    {d.tags.map((t) => (
                      <span key={t} style={{ fontSize: 10, padding: '2px 6px', background: '#f1f5f9', color: '#475569', borderRadius: 4 }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: 4 }}>
                  channel: <code>{d.channelId}</code>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => handleToggleEnabled(d)} style={{ flex: 1, fontSize: 12 }}>
                    {d.enabled ? '停用' : '啟用'}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleDelete(d._key)}
                    style={{ fontSize: 12, background: '#fee2e2', color: '#dc2626', border: 'none' }}
                  >
                    刪除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {createOpen && (
        <div className="modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2>新增 Business Doc</h2>
              <button className="modal-close" onClick={() => setCreateOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Channel ID *</label>
                <input className="form-input" type="text" value={formChannelId} onChange={(e) => setFormChannelId(e.target.value)} />
              </div>
              <div className="form-group">
                <label>類型 *</label>
                <select className="form-input" value={formType} onChange={(e) => setFormType(e.target.value as BusinessDocType)}>
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{TYPE_META[t].label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>標題 *</label>
                <input className="form-input" type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              </div>
              <div className="form-group">
                <label>內容 *</label>
                <textarea className="form-input" rows={5} value={formContent} onChange={(e) => setFormContent(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Tags（逗號分隔）</label>
                <input className="form-input" type="text" value={formTags} onChange={(e) => setFormTags(e.target.value)} placeholder="product, featured" />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={formEnabled} onChange={(e) => setFormEnabled(e.target.checked)} />
                  啟用
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setCreateOpen(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? '建立中…' : '建立'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}