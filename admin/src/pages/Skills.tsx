import { useState, useMemo, useEffect } from 'react'
import ChatIcon from '@mui/icons-material/Chat'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import ImageIcon from '@mui/icons-material/Image'
import BadgeIcon from '@mui/icons-material/Badge'
import MicIcon from '@mui/icons-material/Mic'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import TravelExploreIcon from '@mui/icons-material/TravelExplore'
import CelebrationIcon from '@mui/icons-material/Celebration'
import TextSnippetIcon from '@mui/icons-material/TextSnippet'
import ArticleIcon from '@mui/icons-material/Article'
import AssignmentIcon from '@mui/icons-material/Assignment'
import Switch from '@mui/material/Switch'
import { FlowEditor, type FlowNode } from '../components/FlowEditor'
import { get, put, patch } from '../api/client'
import { SKILL_CATALOG, type SkillDefinition } from '../data/skill-catalog'
import skillDefs from '../../skills/name-card.json'

// ── Icon resolver ──
const MUI_ICONS: Record<string, React.ReactNode> = {
  Chat: <ChatIcon sx={{ fontSize: 22 }} />,
  MenuBook: <MenuBookIcon sx={{ fontSize: 22 }} />,
  Image: <ImageIcon sx={{ fontSize: 22 }} />,
  Badge: <BadgeIcon sx={{ fontSize: 22 }} />,
  Mic: <MicIcon sx={{ fontSize: 22 }} />,
  AttachFile: <AttachFileIcon sx={{ fontSize: 22 }} />,
  TravelExplore: <TravelExploreIcon sx={{ fontSize: 22 }} />,
  Celebration: <CelebrationIcon sx={{ fontSize: 22 }} />,
  TextSnippet: <TextSnippetIcon sx={{ fontSize: 22 }} />,
  Article: <ArticleIcon sx={{ fontSize: 22 }} />,
  Assignment: <AssignmentIcon sx={{ fontSize: 22 }} />,
}

function skillIcon(s: SkillDefinition): React.ReactNode {
  return MUI_ICONS[s.icon] ?? <ChatIcon sx={{ fontSize: 22 }} />
}

const TYPE_LABELS: Record<string, string> = {
  builtin: '內建',
  mcp: 'MCP',
  business: '商業',
}

const EXECUTOR_TYPE_LABELS: Record<string, string> = {
  inline: '同步',
  taskforge: 'taskforge',
  http: 'HTTP',
}

interface AgentSkill {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  enabled: boolean;
  executorType: 'inline' | 'taskforge' | 'http';
  parameters: Array<{ name: string; type: string; required: boolean; description: string }>;
  timeoutMs?: number;
}

const STATIC_SKILLS = SKILL_CATALOG.filter((s) => !s.id.startsWith('agent-'));

// ── Flow data from name-card.json (for builtin skills that have flows) ──
type RawSkill = (typeof skillDefs)['skills'][number]
const flowDefs: Record<string, FlowNode[]> = {}
for (const raw of skillDefs.skills) {
  const flow = (raw as any).flow
  if (flow && Array.isArray(flow.nodes)) {
    flowDefs[raw.id] = flow.nodes.map((n: any) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      desc: n.desc || '',
      color: n.color || raw.color,
      enabled: n.enabled ?? true,
      config: n.config ?? {},
    }))
  }
}

const STORAGE_PREFIX = 'sam.flow.'

function loadStoredFlow(id: string): FlowNode[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + id)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FlowNode[]
    return Array.isArray(parsed) ? parsed : null
  } catch { return null }
}

function persistFlowLocal(id: string, nodes: FlowNode[]) {
  try { localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(nodes)) } catch { /* noop */ }
}

async function fetchFlow(id: string): Promise<FlowNode[] | null> {
  try {
    const res = await get<{ data: FlowNode[] | null }>(`/admin/skills/${encodeURIComponent(id)}/flow`)
    return Array.isArray(res.data) ? res.data : null
  } catch { return null }
}

async function saveFlowRemote(id: string, nodes: FlowNode[]): Promise<boolean> {
  try {
    await put(`/admin/skills/${encodeURIComponent(id)}/flow`, nodes)
    return true
  } catch { return false }
}

async function getInitialFlow(id: string): Promise<FlowNode[]> {
  const remote = await fetchFlow(id)
  if (remote && remote.length > 0) return remote
  const stored = loadStoredFlow(id)
  if (stored && stored.length > 0) return stored
  return flowDefs[id] ?? []
}

// ── Manifest Modal ──
function ManifestModal({ skill, onClose }: { skill: AgentSkill; onClose: () => void }) {
  const manifest = {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    triggers: skill.triggers,
    enabled: skill.enabled,
    executor: { type: skill.executorType },
    parameters: skill.parameters,
    timeoutMs: skill.timeoutMs,
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">📄 {skill.name} — Manifest</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <pre style={{
          fontSize: 12, lineHeight: 1.5, overflow: 'auto', maxHeight: '60vh',
          background: '#1e293b', color: '#e2e8f0', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {JSON.stringify(manifest, null, 2)}
        </pre>
      </div>
    </div>
  )
}

// ── Test Sandbox Modal ──
function TestSandboxModal({ skill, onClose }: { skill: AgentSkill; onClose: () => void }) {
  const [argsText, setArgsText] = useState(() => {
    const defaults: Record<string, string> = {}
    for (const p of skill.parameters) {
      if (p.default !== undefined) defaults[p.name] = String(p.default)
    }
    return Object.keys(defaults).length > 0 ? JSON.stringify(defaults, null, 2) : '{}'
  })
  const [result, setResult] = useState<{ output?: string; error?: string; ok?: boolean } | null>(null)
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function handleTest() {
    setLoading(true)
    setErrMsg(null)
    setResult(null)
    try {
      let parsed: Record<string, unknown> = {}
      try { parsed = JSON.parse(argsText) } catch { setErrMsg('Invalid JSON'); setLoading(false); return }
      const res = await fetch(`/api/v1/agent/skills/${encodeURIComponent(skill.id)}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args: parsed }),
      })
      const json = await res.json()
      if (!res.ok) { setErrMsg(json.error ?? `HTTP ${res.status}`); return }
      setResult(json.data.result)
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 600 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">🧪 Test: {skill.name}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="form-group">
          <label className="form-label">Arguments (JSON)</label>
          <textarea
            className="form-input"
            rows={6}
            value={argsText}
            onChange={(e) => setArgsText(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={handleTest} disabled={loading}>
            {loading ? 'Executing...' : '▶ Execute'}
          </button>
          <button className="btn btn-secondary" onClick={() => {
            const defaults: Record<string, string> = {}
            for (const p of skill.parameters) {
              if (p.default !== undefined) defaults[p.name] = String(p.default)
            }
            setArgsText(Object.keys(defaults).length > 0 ? JSON.stringify(defaults, null, 2) : '{}')
          }}>
            Reset
          </button>
        </div>

        {errMsg && (
          <div style={{ padding: '8px 12px', background: '#fee2e2', color: 'var(--danger)', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
            ⚠ {errMsg}
          </div>
        )}

        {result && (
          <div>
            <label className="form-label">Result</label>
            <pre style={{
              fontSize: 12, lineHeight: 1.5, overflow: 'auto', maxHeight: 300,
              background: '#1e293b', color: '#e2e8f0', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {result.ok !== undefined && <span style={{ color: result.ok ? '#10b981' : '#ef4444' }}>{result.ok ? '✓ OK' : '✗ FAIL'}</span>}
              {'\n'}
              {result.output ? `Output: ${result.output}` : ''}
              {result.error ? `\nError: ${result.error}` : ''}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export function Skills() {
  const [view, setView] = useState<'card' | 'list'>('card')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [flowSkill, setFlowSkill] = useState<SkillDefinition | null>(null)
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([])
  const [flowLoading, setFlowLoading] = useState(false)

  const [agentSkills, setAgentSkills] = useState<AgentSkill[]>([])
  const [agentLoading, setAgentLoading] = useState(true)
  const [agentError, setAgentError] = useState<string | null>(null)

  // manifest modal
  const [manifestSkill, setManifestSkill] = useState<AgentSkill | null>(null)
  // test modal
  const [testSkill, setTestSkill] = useState<AgentSkill | null>(null)

  async function loadAgentSkills() {
    setAgentLoading(true)
    setAgentError(null)
    try {
      const res = await get<{ data: AgentSkill[] }>('/agent/skills')
      setAgentSkills(res.data ?? [])
    } catch (e) {
      setAgentError(e instanceof Error ? e.message : String(e))
    } finally {
      setAgentLoading(false)
    }
  }

  useEffect(() => {
    loadAgentSkills()
  }, [])

  async function toggleAgentSkill(id: string, enabled: boolean) {
    try {
      const res = await patch<{ data: AgentSkill }>(`/agent/skills/${encodeURIComponent(id)}`, { enabled })
      setAgentSkills((prev) => prev.map((s) => (s.id === id ? res.data : s)))
    } catch (e) {
      console.error('toggle skill failed', e)
      loadAgentSkills()
    }
  }

  async function openSkill(s: SkillDefinition) {
    if (!s.hasFlow) return
    setFlowSkill(s)
    setFlowLoading(true)
    const nodes = await getInitialFlow(s.id)
    setFlowNodes(nodes)
    setFlowLoading(false)
  }

  async function handleSave(nodes: FlowNode[]) {
    if (!flowSkill) return
    persistFlowLocal(flowSkill.id, nodes)
    const ok = await saveFlowRemote(flowSkill.id, nodes)
    if (!ok) console.warn('Remote save failed; cached locally only')
  }

  const filtered = useMemo(() => {
    let list = STATIC_SKILLS.filter((s) => s.enabled)
    if (filterType !== 'all') {
      list = list.filter((s) => s.type === filterType)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.desc.toLowerCase().includes(q) ||
          s.tag.toLowerCase().includes(q),
      )
    }
    return list
  }, [search, filterType])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: STATIC_SKILLS.filter((s) => s.enabled).length }
    for (const s of STATIC_SKILLS) {
      if (s.enabled) counts[s.type] = (counts[s.type] ?? 0) + 1
    }
    return counts
  }, [])

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">技能目錄</h1>
        <p className="page-subtitle">SAM Agent 可用技能 — 靜態 {STATIC_SKILLS.filter((s) => s.enabled).length} 項 / Agent {agentSkills.filter((s) => s.enabled).length} 項</p>
      </div>

      {/* Agent Skills (managed by server) */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>🤖 Agent Skills（server 管理，可即時開關）</h2>
          <button
            onClick={loadAgentSkills}
            disabled={agentLoading}
            style={{ padding: '5px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }}
          >
            {agentLoading ? '載入中...' : '重新整理'}
          </button>
        </div>
        {agentError && (
          <div style={{ padding: 8, background: '#FEE', borderRadius: 6, color: '#C00', fontSize: 12, marginBottom: 12 }}>
            ⚠ {agentError}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
          {agentSkills.map((s) => (
            <div
              key={s.id}
              style={{
                padding: 12,
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: s.enabled ? 'var(--bg)' : 'var(--bg-disabled, #f5f5f5)',
                opacity: s.enabled ? 1 : 0.6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>id: {s.id}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{s.description}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11 }}>
                    <span style={{ padding: '2px 6px', background: '#EEF', borderRadius: 4 }}>
                      {EXECUTOR_TYPE_LABELS[s.executorType] ?? s.executorType}
                    </span>
                    {s.triggers.slice(0, 3).map((t) => (
                      <span key={t} style={{ padding: '2px 6px', background: '#EFE', borderRadius: 4 }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setManifestSkill(s)}
                      title="View manifest"
                    >
                      📄 Manifest
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setTestSkill(s)}
                      title="Test skill"
                    >
                      🧪 Test
                    </button>
                  </div>
                </div>
                <Switch
                  checked={s.enabled}
                  onChange={(e) => toggleAgentSkill(s.id, e.target.checked)}
                  size="small"
                  disabled={agentLoading}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="toolbar-search"
          placeholder="搜尋技能..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 260, flex: 1 }}
        />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {['all', 'builtin', 'mcp', 'business'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              style={{
                padding: '5px 10px', fontSize: 11, fontWeight: 600,
                border: '1px solid var(--border)', borderRadius: 6,
                background: filterType === t ? 'var(--bg-hover)' : 'transparent',
                color: 'var(--text)', cursor: 'pointer',
              }}
            >
              {t === 'all' ? '全部' : TYPE_LABELS[t] ?? t}
              <span style={{ marginLeft: 4, opacity: 0.6 }}>{typeCounts[t] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Card view */}
      {view === 'card' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map((s) => (
            <div
              key={s.id}
              className="card skill-card"
              style={{ padding: 16, cursor: s.hasFlow ? 'pointer' : 'default' }}
              onClick={() => openSkill(s)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ color: s.color }}>{skillIcon(s)}</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.title}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{s.desc}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <span style={{ padding: '2px 8px', background: s.color + '22', color: s.color, borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                  {s.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Flow editor modal */}
      {flowSkill && (
        <FlowEditor
          key={flowSkill.id}
          skillTitle={flowSkill.title}
          skillColor={flowSkill.color}
          skillIcon={skillIcon(flowSkill)}
          initialNodes={flowNodes}
          open={!!flowSkill}
          loading={flowLoading}
          onClose={() => setFlowSkill(null)}
          onSave={handleSave}
        />
      )}

      {/* Manifest modal */}
      {manifestSkill && (
        <ManifestModal skill={manifestSkill} onClose={() => setManifestSkill(null)} />
      )}

      {/* Test sandbox modal */}
      {testSkill && (
        <TestSandboxModal skill={testSkill} onClose={() => setTestSkill(null)} />
      )}
    </>
  )
}
