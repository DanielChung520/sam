import { useEffect, useRef, useState } from 'react'
import { Graph } from '@antv/g6'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'

export interface FlowNode {
  id: string
  label: string
  desc: string
  color: string
  enabled: boolean
  pos?: { x: number; y: number }
}

interface FlowEditorProps {
  open: boolean
  onClose: () => void
  skillTitle: string
  skillIcon: React.ReactNode
  skillColor: string
  initialNodes: FlowNode[]
  onSave: (nodes: FlowNode[]) => void
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
  onSave,
}: FlowEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Graph | null>(null)
  const [nodes, setNodes] = useState<FlowNode[]>(initialNodes)
  const [editingId, setEditingId] = useState<string | null>(null)

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
          step: i + 1,
          skillColor,
        },
        style: {
          x: n.pos?.x ?? NODE_WIDTH / 2 + 40 + i * (NODE_WIDTH + H_GAP),
          y: n.pos?.y ?? NODE_Y,
        },
      })),
      edges: nodes.slice(0, -1).map((_, i) => ({
        id: `edge-${i}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
      })),
    })
    graphRef.current.draw()
    graphRef.current.fitView(24, { duration: 200 })
  }, [nodes, skillColor])

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
            const { label, desc, color, enabled, step, skillColor } = d.data
            const c = enabled ? color : '#cbd5e1'
            const bg = enabled ? `${skillColor}08` : '#f8fafc'
            const stepBg = enabled ? color : '#94a3b8'
            const opacity = enabled ? '1' : '0.55'
            return `
<div style="
  width:${NODE_WIDTH}px;height:${NODE_HEIGHT}px;
  background:${bg};
  border:2px solid ${c};
  border-radius:14px;
  padding:14px 16px;
  display:flex;align-items:center;gap:12px;
  font-family:inherit;
  opacity:${opacity};
  box-shadow:0 2px 8px rgba(0,0,0,0.06);
  user-select:none;
  cursor:pointer;
">
  <div style="
    width:32px;height:32px;border-radius:50%;
    background:${stepBg};color:white;
    display:flex;align-items:center;justify-content:center;
    font-size:13px;font-weight:700;flex-shrink:0;
  ">${step}</div>
  <div style="flex:1;min-width:0;overflow:hidden;">
    <div style="
      font-size:14px;font-weight:600;color:#0f172a;
      line-height:1.3;
      overflow-wrap:break-word;word-break:break-word;
      display:-webkit-box;-webkit-line-clamp:2;
      -webkit-box-orient:vertical;overflow:hidden;
      margin-bottom:3px;
    ">${escapeHtml(label)}</div>
    <div style="
      font-size:11px;color:#64748b;line-height:1.4;
      overflow-wrap:break-word;word-break:break-word;
      display:-webkit-box;-webkit-line-clamp:3;
      -webkit-box-orient:vertical;overflow:hidden;
    ">${escapeHtml(desc)}</div>
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
            return sourceNode?.enabled ? sourceNode.color : '#cbd5e1'
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
          step: i + 1,
          skillColor,
        },
        style: {
          x: n.pos?.x ?? NODE_WIDTH / 2 + 40 + i * (NODE_WIDTH + H_GAP),
          y: n.pos?.y ?? NODE_Y,
        },
      })),
      edges: nodes.slice(0, -1).map((_, i) => ({
        id: `edge-${i}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
      })),
    })
    graph.draw()
    requestAnimationFrame(() => {
      try {
        graph.fitView(24, { duration: 200 })
      } catch {
        // graph not ready
      }
    })

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
                onSave(nodes)
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
                          background: node.enabled ? node.color : '#94a3b8',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
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

  // Reset local state when editing a different node
  useEffect(() => {
    setLabel(node.label)
    setDesc(node.desc)
    setEnabled(node.enabled)
  }, [node.id, node.label, node.desc, node.enabled])

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
        }}
      >
        Edit Step
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
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
          onClick={() => onSave({ ...node, label, desc, enabled })}
        >
          <CheckIcon sx={{ fontSize: 16 }} /> Save
        </button>
      </div>
    </div>
  )
}