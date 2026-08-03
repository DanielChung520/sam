import { useEffect, useRef, useState } from 'react'
import { Graph } from '@antv/g6'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'

export interface FlowEdgeDef {
  source: string
  target: string
  label?: string
}

export interface NodePropSchema {
  name: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'code' | 'json' | 'textarea'
  required?: boolean
  placeholder?: string
  options?: { label: string; value: string }[]
  default?: unknown
  desc?: string
}

export interface FlowNode {
  id: string
  type: string  // trigger, llm, condition, function, skill, storage, reply, dummy, tool, memory
  label: string
  desc: string
  color?: string
  enabled: boolean
  pos?: { x: number; y: number }
  config?: Record<string, any>
  /** 輸入資料描述（吃什麼 JSON/資料） */
  inputs?: string
  /** 輸出資料描述（吐什麼 JSON/資料） */
  outputs?: string
  /** 節點屬性 schema（右側屬性欄依此渲染表單） */
  propsSchema?: NodePropSchema[]
}

const NODE_TYPES: Record<string, { label: string; color: string; icon: string }> = {
  trigger:   { label: 'Trigger',   color: '#6366f1', icon: '▶' },
  llm:       { label: 'LLM',       color: '#f97316', icon: '🧠' },
  condition: { label: '判斷',      color: '#eab308', icon: '◇' },
  function:  { label: 'Function',  color: '#22c55e', icon: 'ƒ' },
  skill:     { label: '子技能',    color: '#8b5cf6', icon: '◎' },
  storage:   { label: 'Storage',   color: '#3b82f6', icon: '💾' },
  reply:     { label: 'Reply',     color: '#06b6d4', icon: '↩' },
  dummy:     { label: '佔位',      color: '#94a3b8', icon: '…' },
  tool:      { label: '工具',      color: '#ef4444', icon: '🔧' },
  memory:    { label: '記憶',      color: '#14b8a6', icon: '📝' },
}

interface FlowEditorProps {
  open: boolean
  onClose: () => void
  skillTitle: string
  skillIcon: React.ReactNode
  skillColor: string
  initialNodes: FlowNode[]
  initialEdges?: FlowEdgeDef[]
  onSave: (nodes: FlowNode[], edges?: FlowEdgeDef[]) => void
  inputSchema?: { name: string; type: string; required: boolean; desc: string }[]
  outputSchema?: { name: string; type: string; desc: string }[]
}

const NODE_WIDTH = 240
const NODE_HEIGHT = 96
const H_GAP = 100
const NODE_Y = NODE_HEIGHT / 2 + 24 // center y of each node (canvas anchor)

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function FlowEditor({
  open,
  onClose,
  skillTitle,
  skillIcon,
  skillColor,
  initialNodes,
  initialEdges,
  onSave,
  inputSchema,
  outputSchema,
}: FlowEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Graph | null>(null)
  const [nodes, setNodes] = useState<FlowNode[]>(initialNodes)
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 導入流程（md/xml/json/yaml 檔案）
  const handleImportFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const { parseFlowText } = await import('../lib/flowImport')
        const imported = parseFlowText(String(reader.result ?? ''), file.name)
        if (!imported.length) throw new Error('匯入結果為空')
        setNodes(imported)
        setEditingId(null)
      } catch (e) {
        alert('匯入失敗：' + (e instanceof Error ? e.message : String(e)))
      }
    }
    reader.readAsText(file)
  }

  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes])

  function buildEdges(ns: FlowNode[]): { id: string; source: string; target: string }[] {
    if (initialEdges && initialEdges.length > 0) {
      return initialEdges.map((e, i) => ({
        id: `edge-${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
      }))
    }
    return ns.slice(0, -1).map((_, i) => ({
      id: `edge-${i}`,
      source: ns[i].id,
      target: ns[i + 1].id,
    }))
  }

  // Sync G6 → React state when nodes change externally
  useEffect(() => {
    if (!graphRef.current) return
    graphRef.current.setData({
      nodes: nodes.map((n, i) => ({
        id: n.id,
        data: {
          label: n.label,
          desc: n.desc,
          color: n.color,
          enabled: n.enabled,
          type: n.type,
          step: i + 1,
          skillColor,
        },
        style: {
          x: n.pos?.x ?? NODE_WIDTH / 2 + 40 + i * (NODE_WIDTH + H_GAP),
          y: n.pos?.y ?? NODE_Y,
        },
      })),
      edges: buildEdges(nodes),
    })
    graphRef.current.draw()
    setTimeout(() => {
      try {
        graphRef.current?.fitView(24, { duration: 200 })
      } catch {
        return
      }
    }, 100)
  }, [nodes, skillColor, initialEdges])

  // Initialize G6 graph
  useEffect(() => {
    if (!open || !containerRef.current) return

    const graph = new Graph({
      container: containerRef.current,
      autoResize: true,
      background: 'transparent',
      padding: 24,
      data: {
        nodes: [],
        edges: [],
      },
      node: {
        type: 'html',
        style: {
          size: [NODE_WIDTH, NODE_HEIGHT],
          innerHTML: (d: any) => {
            const { label, desc, color, enabled, type, skillColor } = d.data
            const nodeType = NODE_TYPES[type] ?? NODE_TYPES.dummy
            const typeColor = color || nodeType.color
            const c = enabled ? typeColor : '#cbd5e1'
            const bg = enabled ? `${nodeType.color}10` : '#f8fafc'
            const iconBg = enabled ? nodeType.color : '#94a3b8'
            const opacity = enabled ? '1' : '0.55'
            return `
<div style="
  width:${NODE_WIDTH}px;height:${NODE_HEIGHT}px;
  background:${bg};
  border:2px solid ${c};
  border-radius:14px;
  padding:12px 14px;
  display:flex;align-items:center;gap:10px;
  font-family:inherit;
  opacity:${opacity};
  box-shadow:0 2px 8px rgba(0,0,0,0.06);
  user-select:none;
  cursor:pointer;
  position:relative;
">
  <div style="
    width:32px;height:32px;border-radius:50%;
    background:${iconBg};color:white;
    display:flex;align-items:center;justify-content:center;
    font-size:14px;font-weight:700;flex-shrink:0;
  ">${nodeType.icon}</div>
  <div style="flex:1;min-width:0;overflow:hidden;">
    <div style="
      font-size:14px;font-weight:600;color:#0f172a;
      line-height:1.3;
      overflow-wrap:break-word;word-break:break-word;
      display:-webkit-box;-webkit-line-clamp:2;
      -webkit-box-orient:vertical;overflow:hidden;
      margin-bottom:2px;
    ">${escapeHtml(label)}</div>
    <div style="
      font-size:11px;color:#64748b;line-height:1.4;
      overflow-wrap:break-word;word-break:break-word;
      display:-webkit-box;-webkit-line-clamp:2;
      -webkit-box-orient:vertical;overflow:hidden;
    ">${escapeHtml(desc)}</div>
    <div style="
      margin-top:3px;font-size:9px;font-weight:600;
      color:${nodeType.color};
      letter-spacing:0.5px;
    ">${nodeType.label}</div>
  </div>
</div>`
          },
        },
      },
      edge: {
        type: 'line',
        style: {
          stroke: (d: any) => {
            const sourceNode = nodes.find((n) => n.id === d.source)
            if (!sourceNode) return '#cbd5e1'
            if (!sourceNode.enabled) return '#cbd5e1'
            const nt = NODE_TYPES[sourceNode.type] ?? NODE_TYPES.dummy
            return sourceNode.color || nt.color
          },
          lineWidth: 2,
          endArrow: true,
          endArrowSize: 10,
        },
      },
      layout: false,
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
    })

    // Node click → open edit panel
    graph.on('node:click', (evt: any) => {
      const id = evt.target?.id || evt.targetID
      if (id) setEditingId(String(id))
    })

    graph.on('node:dragend', (evt: any) => {
      const id = evt.target?.id || evt.targetID
      if (!id) return
      const model = graph.getElementPosition(id)
      if (!model) return
      const x = Array.isArray(model) ? model[0] : (model as any).x
      const y = Array.isArray(model) ? model[1] : (model as any).y
      if (typeof x !== 'number' || typeof y !== 'number') return
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, pos: { x, y } } : n)),
      )
    })

    graph.render()
    graphRef.current = graph

    // Initial draw with current nodes
    graph.setData({
      nodes: nodes.map((n, i) => ({
        id: n.id,
        data: {
          label: n.label,
          desc: n.desc,
          color: n.color,
          enabled: n.enabled,
          type: n.type,
          step: i + 1,
          skillColor,
        },
        style: {
          x: n.pos?.x ?? NODE_WIDTH / 2 + 40 + i * (NODE_WIDTH + H_GAP),
          y: n.pos?.y ?? NODE_Y,
        },
      })),
      edges: buildEdges(nodes),
    })
graph.draw()
    setTimeout(() => {
      try {
        graph.fitView(24, { duration: 200 })
      } catch {
        return
      }
    }, 200)

    return () => {
      graph.destroy()
      graphRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const editingNode = nodes.find((n) => n.id === editingId) ?? null

  const handleEditSave = (updated: FlowNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
    setEditingId(null)
  }

  const handleReorder = () => {
    // After drag, G6 has updated node positions. Read them and reorder by x.
    if (!graphRef.current) return
    const gNodes = graphRef.current.getNodeData()
    const sorted = [...gNodes].sort((a: any, b: any) => {
      const ax = (a.style?.x ?? 0) as number
      const bx = (b.style?.x ?? 0) as number
      return ax - bx
    })
    const reorderedIds = sorted.map((n: any) => n.id)
    setNodes((prev) => {
      const map = new Map(prev.map((n) => [n.id, n]))
      return reorderedIds
        .map((id) => map.get(id as string))
        .filter((n): n is FlowNode => Boolean(n))
    })
  }

  const handleReset = () => {
    setNodes(initialNodes.map((n) => ({ ...n, pos: undefined })))
    setEditingId(null)
  }

  if (!open) return null

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        setEditingId(null)
        onClose()
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 16,
          width: '90vw',
          height: '86vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: `${skillColor}14`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {skillIcon}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{skillTitle}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Flow Editor · drag to reorder · click to edit
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.xml,.json,.yaml,.yml,text/markdown,text/xml,application/json,application/yaml"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleImportFile(f)
                e.target.value = ''
              }}
            />
            <button
              className="btn btn-secondary"
              onClick={() => {}}
              title="搜尋外部技能（預留：串接技能市集/外部來源）"
            >
              🔍 搜尋外部技能
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              title="導入流程定義（md/xml/json/yaml）"
            >
              ⬆ 導入
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleReset}
              title="Reset to default"
            >
              <RefreshIcon sx={{ fontSize: 15 }} /> Reset
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleReorder}
              title="Apply new node positions"
            >
              套用排序
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                onSave(nodes, initialEdges)
                onClose()
              }}
            >
              Save Flow
            </button>
            <button
              className="modal-close"
              onClick={() => {
                setEditingId(null)
                onClose()
              }}
            >
              <CloseIcon sx={{ fontSize: 20 }} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Graph canvas */}
          <div
            ref={containerRef}
            style={{
              flex: 1,
              minWidth: 0,
              background:
                'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #f8fafc 100%)',
              position: 'relative',
            }}
          />

          {/* Right side: node list + edit panel */}
          <div
            style={{
              width: 320,
              flexShrink: 0,
              borderLeft: '1px solid var(--border)',
              background: 'var(--bg)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {editingNode ? (
              <EditPanel
                node={editingNode}
                onSave={handleEditSave}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                {/* 輸入 / 輸出規格 */}
                {(inputSchema?.length || outputSchema?.length) && (
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                    {inputSchema && inputSchema.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, color: '#059669', marginBottom: 6 }}>
                          📥 輸入規格
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          {inputSchema.map((f) => (
                            <div key={f.name} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
                              <span style={{ fontWeight: 600, color: 'var(--text)', minWidth: 70 }}>
                                {f.name}
                                {f.required && <span style={{ color: '#ef4444' }}>*</span>}
                              </span>
                              <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
                                {f.desc} <span style={{ opacity: 0.6 }}>({f.type})</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {outputSchema && outputSchema.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, color: '#f97316', marginBottom: 6 }}>
                          📤 輸出規格
                        </div>
                        <div>
                          {outputSchema.map((f) => (
                            <div key={f.name} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
                              <span style={{ fontWeight: 600, color: 'var(--text)', minWidth: 70 }}>
                                {f.name}
                              </span>
                              <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
                                {f.desc} <span style={{ opacity: 0.6 }}>({f.type})</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                  }}
                >
                  Steps ({nodes.length})
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
                  {nodes.map((node, i) => (
                    <div
                        key={node.id}
                        onClick={() => setEditingId(node.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          marginBottom: 4,
                          transition: 'background 0.15s',
                          opacity: node.enabled ? 1 : 0.55,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-hover)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: node.enabled ? (NODE_TYPES[node.type] ?? NODE_TYPES.dummy).color : '#94a3b8',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {(NODE_TYPES[node.type] ?? NODE_TYPES.dummy).icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {node.label}
                            </div>
                            <span style={{ fontSize: 9, color: (NODE_TYPES[node.type] ?? NODE_TYPES.dummy).color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {(NODE_TYPES[node.type] ?? NODE_TYPES.dummy).label}
                            </span>
                          </div>
                        </div>
                        <EditIcon
                          sx={{ fontSize: 13, color: 'var(--text-secondary)' }}
                        />
                      </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function EditPanel({
  node,
  onSave,
  onCancel,
}: {
  node: FlowNode
  onSave: (n: FlowNode) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState(node.label)
  const [desc, setDesc] = useState(node.desc)
  const [enabled, setEnabled] = useState(node.enabled)
  const [config, setConfig] = useState<Record<string, any>>(node.config ?? {})
  const [inputs, setInputs] = useState(node.inputs ?? '')
  const [outputs, setOutputs] = useState(node.outputs ?? '')
  // 可維護狀態：false = 唯讀檢視；true = 可編輯表單
  const [maintainable, setMaintainable] = useState(false)

  const nodeTypeDef = NODE_TYPES[node.type] ?? NODE_TYPES.dummy

  // Reset local state when editing a different node
  useEffect(() => {
    setLabel(node.label)
    setDesc(node.desc)
    setEnabled(node.enabled)
    setConfig(node.config ?? {})
    setInputs(node.inputs ?? '')
    setOutputs(node.outputs ?? '')
    setMaintainable(false)
  }, [node.id, node.label, node.desc, node.enabled])

  const setProp = (name: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [name]: value }))
  }

  // 依 schema 型別渲染屬性表單
  const renderProp = (p: NodePropSchema) => {
    const val = config[p.name] ?? p.default ?? ''
    const base = { width: '100%', fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }
    switch (p.type) {
      case 'boolean':
        return (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!val} onChange={(e) => setProp(p.name, e.target.checked)} />
            {p.label}
          </label>
        )
      case 'select':
        return (
          <select
            value={String(val)}
            onChange={(e) => setProp(p.name, e.target.value)}
            style={{ ...base, height: 32 }}
          >
            {p.options?.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )
      case 'textarea':
        return (
          <textarea
            className="form-input"
            rows={4}
            value={String(val)}
            placeholder={p.placeholder}
            onChange={(e) => setProp(p.name, e.target.value)}
          />
        )
      case 'code':
        return (
          <textarea
            className="form-input"
            rows={6}
            value={String(val)}
            placeholder={p.placeholder}
            onChange={(e) => setProp(p.name, e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        )
      case 'json':
        return (
          <textarea
            className="form-input"
            rows={5}
            value={typeof val === 'string' ? val : JSON.stringify(val ?? {}, null, 2)}
            placeholder={p.placeholder}
            onChange={(e) => setProp(p.name, e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        )
      case 'number':
        return (
          <input
            type="number"
            className="form-input"
            value={val === '' ? '' : Number(val)}
            placeholder={p.placeholder}
            onChange={(e) => setProp(p.name, e.target.value === '' ? undefined : Number(e.target.value))}
          />
        )
      default:
        return (
          <input
            className="form-input"
            value={String(val ?? '')}
            placeholder={p.placeholder}
            onChange={(e) => setProp(p.name, e.target.value)}
          />
        )
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--text-secondary)',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{
          background: nodeTypeDef.color,
          color: 'white',
          borderRadius: 4,
          padding: '1px 6px',
          fontSize: 10,
          fontWeight: 600,
        }}>
          {nodeTypeDef.icon} {nodeTypeDef.label}
        </span>
        <button
          onClick={() => setMaintainable((v) => !v)}
          title={maintainable ? '切換回唯讀檢視' : '進入可維護狀態（編輯屬性）'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            background: maintainable ? 'var(--bg-hover, #eef2f7)' : 'transparent',
            color: maintainable ? 'var(--text)' : 'var(--text-secondary)',
          }}
        >
          <EditIcon sx={{ fontSize: 13 }} />
          {maintainable ? '維護中（可編輯）' : 'Edit'}
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {!maintainable ? (
          /* 唯讀檢視：顯示節點屬性值（非維護狀態） */
          <>
            <div className="form-group">
              <label className="form-label">Title</label>
              <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{label}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{desc || '—'}</div>
            </div>
            {node.propsSchema && node.propsSchema.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  屬性
                </div>
                {node.propsSchema.map((p) => {
                  const v = config[p.name] ?? p.default ?? ''
                  return (
                    <div key={p.name} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500, minWidth: 80 }}>{p.label}</span>
                      <span style={{ color: 'var(--text)' }}>
                        {p.type === 'boolean' ? (v ? '✅ 是' : '❌ 否') : p.type === 'select' ? (p.options?.find((o) => o.value === v)?.label ?? v) : String(v ?? '—')}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          /* 可維護狀態：可編輯表單 */
          <>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input
                className="form-input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                rows={4}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Enabled
              </label>
            </div>

            {/* 節點屬性表單（依 propsSchema 渲染） */}
            {node.propsSchema && node.propsSchema.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  屬性
                </div>
                {node.propsSchema.map((p) => (
                  <div key={p.name} className="form-group">
                    <label className="form-label">
                      {p.label}
                      {p.required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
                    </label>
                    {renderProp(p)}
                    {p.desc && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {p.desc}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* 輸入資料（吃什麼 JSON） */}
        {inputs && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              📥 輸入資料
            </div>
            {maintainable ? (
              <textarea
                className="form-input"
                rows={4}
                value={inputs}
                placeholder="描述此節點輸入的資料/JSON 格式"
                onChange={(e) => setInputs(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            ) : (
              <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, color: 'var(--text)' }}>
                {inputs}
              </pre>
            )}
          </div>
        )}

        {/* 輸出資料（吐什麼 JSON） */}
        {outputs && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              📤 輸出資料
            </div>
            {maintainable ? (
              <textarea
                className="form-input"
                rows={4}
                value={outputs}
                placeholder="描述此節點輸出的資料/JSON 格式"
                onChange={(e) => setOutputs(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            ) : (
              <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, color: 'var(--text)' }}>
                {outputs}
              </pre>
            )}
          </div>
        )}
      </div>
      <div
        style={{
          padding: 12,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
        }}
      >
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={() => onSave({ ...node, label, desc, enabled, config, inputs: inputs.trim() || undefined, outputs: outputs.trim() || undefined })}
        >
          <CheckIcon sx={{ fontSize: 16 }} /> Save
        </button>
      </div>
    </div>
  )
}