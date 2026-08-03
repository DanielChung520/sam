/**
 * Agent Center — Unified Agent + Sub-Agent management
 *
 * Round 1 scope:
 *   - Main Agent CRUD: full working
 *   - Sub-Agent list: placeholder (round 2 will integrate taskforge)
 *
 * Reference: .docs/ADMIN_AGENT_CENTER_MOCK.md
 */
import { useState, useEffect } from 'react'
import { get, post, patch as apiPatch, del } from '../api/client'
import { AgentDetail, type MainAgentDetail } from './AgentDetail'

/* ── Types ── */

type AgentType = 'main' | 'sub'

interface AgentCenterItem {
  id: string
  type: AgentType
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

type FilterTab = 'all' | AgentType

/* ── Component ── */

export function AgentCenter() {
  const [items, setItems] = useState<AgentCenterItem[]>([])
  const [stats, setStats] = useState<Record<string, { lastCalled: number; callCount: number }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [searchText, setSearchText] = useState('')

  // Detail drawer state
  const [selected, setSelected] = useState<AgentCenterItem | null>(null)

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [createType, setCreateType] = useState<AgentType>('main')
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createSystemPrompt, setCreateSystemPrompt] = useState('')
  const [createModel, setCreateModel] = useState('gpt-4o')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const itemsRes = await get<{ data: AgentCenterItem[] }>(`/admin/agent-center?type=${activeTab}`)
      setItems(itemsRes.data ?? [])
      try {
        const statsRes = await get<{ data: Record<string, { lastCalled: number; callCount: number }> }>(`/admin/agent-center/stats`)
        setStats(statsRes.data ?? {})
      } catch {
        setStats({})
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const filteredItems = searchText
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(searchText.toLowerCase()) ||
          i.description.toLowerCase().includes(searchText.toLowerCase())
      )
    : items

  const counts = {
    all: items.length, // total from API when type=all
    main: items.filter((i) => i.type === 'main').length,
    sub: items.filter((i) => i.type === 'sub').length,
  }
  // When activeTab !== 'all', recount by re-fetching 'all' on demand
  // For simplicity, show counts only when activeTab === 'all'
  const showCounts = activeTab === 'all'

  async function handleCreate() {
    if (!createName.trim()) {
      setError('名稱不能為空')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (createType === 'main') {
        await post('/admin/agent-center/main', {
          name: createName,
          description: createDesc,
          systemPrompt: createSystemPrompt,
          model: createModel,
        })
      } else {
        await post('/admin/agent-center/sub', { name: createName, description: createDesc })
      }
      setCreateOpen(false)
      setCreateName('')
      setCreateDesc('')
      setCreateSystemPrompt('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleEnabled(item: AgentCenterItem) {
    if (item.type !== 'main') {
      setError('Sub-Agent 啟用切換待 taskforge 整合（round 2）')
      return
    }
    try {
      await apiPatch(`/admin/agent-center/main/${item.id}`, { enabled: !item.enabled })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleDelete(item: AgentCenterItem) {
    if (!confirm(`確定要刪除「${item.name}」？`)) return
    if (item.type !== 'main') {
      setError('Sub-Agent 刪除待 taskforge 整合（round 2）')
      return
    }
    try {
      await del(`/admin/agent-center/main/${item.id}`)
      setSelected(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="page-title">Agent Center</h1>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            統一管理主 Agent 與 Sub-Agent
          </span>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setCreateType('main')
              setCreateOpen(true)
            }}
          >
            + 新增主 Agent
          </button>
          <button
            className="btn"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onClick={() => {
              setCreateType('sub')
              setCreateOpen(true)
            }}
          >
            + 新增 Sub-Agent
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          全部 {showCounts ? `(${counts.all})` : ''}
        </button>
        <button
          className={`tab ${activeTab === 'main' ? 'active' : ''}`}
          onClick={() => setActiveTab('main')}
        >
          🤖 主 Agent {showCounts ? `(${counts.main})` : ''}
        </button>
        <button
          className={`tab ${activeTab === 'sub' ? 'active' : ''}`}
          onClick={() => setActiveTab('sub')}
        >
          📦 Sub-Agent {showCounts ? `(${counts.sub})` : ''}
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          className="form-input"
          placeholder="搜尋名稱或描述…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ maxWidth: 360 }}
        />
      </div>

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

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
          載入中…
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {activeTab === 'sub' ? (
              <>
                Sub-Agent 整合待 taskforge 串接（round 2）<br />
                目前主 Agent 已有 <strong>{counts.main}</strong> 筆
              </>
            ) : (
              <>尚未建立任何 Agent。點上方「+ 新增」開始。</>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {filteredItems.map((item) => (
            <AgentCard
              key={`${item.type}:${item.id}`}
              item={item}
              callCount={stats[item.name]?.callCount ?? 0}
              onClick={() => setSelected(item)}
              onToggleEnabled={() => handleToggleEnabled(item)}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selected && selected.type === 'main' && (
        <AgentDetail
          item={selected}
          onClose={() => setSelected(null)}
          onSaved={async () => {
            setSelected(null)
            await load()
          }}
          onDeleted={async () => {
            setSelected(null)
            await load()
          }}
        />
      )}
      {selected && selected.type === 'sub' && (
        <SubAgentStubDrawer
          item={selected}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Create modal */}
      {createOpen && (
        <div className="modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>新增 {createType === 'main' ? '主 Agent' : 'Sub-Agent'}</h2>
              <button className="modal-close" onClick={() => setCreateOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>名稱 *</label>
                <input
                  className="form-input"
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="例如：信義區房仲"
                />
              </div>
              <div className="form-group">
                <label>描述</label>
                <input
                  className="form-input"
                  type="text"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="簡短說明用途"
                />
              </div>
              {createType === 'main' && (
                <>
                  <div className="form-group">
                    <label>Model</label>
                    <input
                      className="form-input"
                      type="text"
                      value={createModel}
                      onChange={(e) => setCreateModel(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>System Prompt</label>
                    <textarea
                      className="form-input"
                      rows={5}
                      value={createSystemPrompt}
                      onChange={(e) => setCreateSystemPrompt(e.target.value)}
                      placeholder="你是一個專業的…"
                    />
                  </div>
                </>
              )}
              {createType === 'sub' && (
                <div
                  style={{
                    padding: 12,
                    background: 'var(--bg-secondary)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                  }}
                >
                  ℹ Sub-Agent 透過 taskforge 整合，目前 round 1 為佔位。實作見
                  <code> .docs/ADMIN_AGENT_CENTER_MOCK.md</code> round 2。
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setCreateOpen(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={saving || createType === 'sub'}
              >
                {saving ? '建立中…' : '建立'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Card component ── */

function AgentCard({
  item,
  onClick,
  onToggleEnabled,
  onDelete,
  callCount,
}: {
  item: AgentCenterItem
  onClick: () => void
  onToggleEnabled: () => void
  onDelete: () => void
  callCount: number
}) {
  const isMain = item.type === 'main'
  const statusColor =
    item.status === 'active' || item.status === 'running'
      ? '#10b981'
      : item.status === 'completed'
        ? '#3b82f6'
        : item.status === 'failed'
          ? '#ef4444'
          : '#94a3b8'

  const categoryMeta: Record<string, { label: string; color: string; icon: string }> = {
    orchestrator: { label: '編排', color: '#3b82f6', icon: '🎯' },
    planner: { label: '規劃', color: '#8b5cf6', icon: '🗺️' },
    reviewer: { label: '審查', color: '#f59e0b', icon: '🔍' },
    memory: { label: '記憶', color: '#10b981', icon: '🧠' },
    consultant: { label: '諮詢', color: '#ec4899', icon: '💭' },
    worker: { label: '執行', color: '#64748b', icon: '⚙️' },
  }
  const cm = categoryMeta[item.category] ?? categoryMeta.worker

  return (
    <div
      className="card"
      style={{ padding: 16, cursor: 'pointer', transition: 'transform 0.1s' }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 10,
            padding: '2px 6px',
            background: isMain ? '#dbeafe' : '#fef3c7',
            color: isMain ? '#1e40af' : '#92400e',
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          {isMain ? '主 Agent' : 'Sub-Agent'}
        </span>
        <span
          style={{
            fontSize: 10,
            padding: '2px 6px',
            background: cm.color + '22',
            color: cm.color,
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          {cm.icon} {cm.label}
        </span>
        <span
          style={{
            fontSize: 10,
            padding: '2px 6px',
            background: statusColor + '22',
            color: statusColor,
            borderRadius: 4,
            fontWeight: 600,
            marginLeft: 'auto',
          }}
        >
          {item.status}
        </span>
      </div>

      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{item.name}</div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          marginBottom: 8,
          fontStyle: 'italic',
        }}
      >
        {item.template}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: 12,
          minHeight: 32,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {item.description || '（無描述）'}
      </div>

      {isMain && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            marginBottom: 10,
            padding: '4px 8px',
            background: 'var(--bg-secondary)',
            borderRadius: 4,
          }}
        >
          model: <strong>{item.raw?.model ?? '-'}</strong>
        </div>
      )}

      {!isMain && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            marginBottom: 10,
            padding: '4px 8px',
            background: 'var(--bg-secondary)',
            borderRadius: 4,
          }}
        >
          plan_id: <code>{item.id}</code>
        </div>
      )}

      {callCount > 0 && (
        <div
          style={{
            fontSize: 10,
            color: '#0e7490',
            marginBottom: 10,
            padding: '3px 8px',
            background: '#cffafe',
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          📊 被呼叫 {callCount} 次
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          className="btn btn-sm"
          onClick={(e) => {
            e.stopPropagation()
            onToggleEnabled()
          }}
          style={{ flex: 1, fontSize: 12 }}
        >
          {item.enabled ? '停用' : '啟用'}
        </button>
        <button
          className="btn btn-sm"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          style={{
            fontSize: 12,
            background: '#fee2e2',
            color: '#dc2626',
            border: 'none',
          }}
        >
          刪除
        </button>
      </div>
    </div>
  )
}

/* ── Sub-Agent stub drawer (round 1) ── */

function SubAgentStubDrawer({
  item,
  onClose,
}: {
  item: AgentCenterItem
  onClose: () => void
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        <div className="modal-header">
          <h2>📦 {item.name}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div
            style={{
              padding: 12,
              background: 'var(--bg-secondary)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}
          >
            ℹ Sub-Agent 詳情頁（含 DAG 編輯器、goal template、執行紀錄）待 taskforge 整合。<br />
            參考 <code>.docs/ADMIN_AGENT_CENTER_MOCK.md</code> round 2。
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            關閉
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Re-export for parent routing ── */
export type { MainAgentDetail }