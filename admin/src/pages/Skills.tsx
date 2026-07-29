import { useState, useMemo, useEffect } from 'react'
import SoapIcon from '@mui/icons-material/Soap'
import ChatIcon from '@mui/icons-material/Chat'
import CelebrationIcon from '@mui/icons-material/Celebration'
import ImageIcon from '@mui/icons-material/Image'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import ViewListIcon from '@mui/icons-material/ViewList'
import { FlowEditor, type FlowNode } from '../components/FlowEditor'

const skillData = [
  {
    icon: <SoapIcon sx={{ fontSize: 22 }} />,
    title: '名片收集與回應',
    desc: 'LINE 名片自動辨識、存放與設定自動回覆留言。支援多種格式名片掃描與聯絡人同步。',
    color: '#3b82f6',
    tag: 'Recognition',
    date: '2026-07-29',
  },
  {
    icon: <ChatIcon sx={{ fontSize: 22 }} />,
    title: '回答與聊天',
    desc: 'AI 即時回答客戶問題，支援自然語言對話。可配置回答模板與知識庫管理。',
    color: '#10b981',
    tag: 'Chat',
    date: '2026-07-28',
  },
  {
    icon: <CelebrationIcon sx={{ fontSize: 22 }} />,
    title: '回應祝賀及問安',
    desc: '自動回覆節慶祝福、生日問候等情感交互。支援定時推送與個人化節慶語言設定。',
    color: '#f59e0b',
    tag: 'Greeting',
    date: '2026-07-27',
  },
  {
    icon: <ImageIcon sx={{ fontSize: 22 }} />,
    title: '其他未歸類圖片解析與處理',
    desc: 'AI 圖片辨識，自動分類與處理未歸檔的圖片內容。支援多種圖片格式與智能分類。',
    color: '#8b5cf6',
    tag: 'Image',
    date: '2026-07-26',
  },
]

const cardFlowNodes: FlowNode[] = [
  { id: '1', label: '接收名片圖片', desc: '用戶透過 LINE 發送名片照片', color: '#3b82f6', enabled: true },
  { id: '2', label: 'AI 辨識名片內容', desc: '自動辨識姓名、電話、公司、職稱等欄位', color: '#3b82f6', enabled: true },
  { id: '3', label: '擷取聯絡資訊', desc: '結構化提取聯絡人資料', color: '#3b82f6', enabled: true },
  { id: '4', label: '儲存至通訊錄', desc: '自動存入 LINE 通訊錄或指定 CRM', color: '#3b82f6', enabled: true },
  { id: '5', label: '發送回覆確認', desc: '自動回覆用戶「已儲存聯絡資訊」', color: '#3b82f6', enabled: true },
  { id: '6', label: '同步至 CRM', desc: '選填：同步聯絡人至外部 CRM 系統', color: '#3b82f6', enabled: false },
]

const chatFlowNodes: FlowNode[] = [
  { id: '1', label: '接收用戶訊息', desc: 'LINE 用戶傳送文字訊息', color: '#10b981', enabled: true },
  { id: '2', label: '意圖理解', desc: '使用 LLM 解析訊息意圖與上下文', color: '#10b981', enabled: true },
  { id: '3', label: '搜尋知識庫', desc: '從向量資料庫檢索相關文件', color: '#10b981', enabled: true },
  { id: '4', label: '生成回答', desc: '整合知識庫與上下文生成回覆', color: '#10b981', enabled: true },
  { id: '5', label: '發送訊息', desc: '透過 LINE 回覆用戶', color: '#10b981', enabled: true },
  { id: '6', label: '記錄對話', desc: '儲存對話歷史供後續分析', color: '#10b981', enabled: false },
]

const greetingFlowNodes: FlowNode[] = [
  { id: '1', label: '偵測事件', desc: '識別節慶、生日等特殊日期', color: '#f59e0b', enabled: true },
  { id: '2', label: '匹配範本', desc: '從範本庫中選擇合適的祝賀語', color: '#f59e0b', enabled: true },
  { id: '3', label: '個人化', desc: '替換客戶姓名與稱謂', color: '#f59e0b', enabled: true },
  { id: '4', label: '排程發送', desc: '於最佳時間點發送訊息', color: '#f59e0b', enabled: true },
  { id: '5', label: '追蹤回應', desc: '監控客戶是否回覆', color: '#f59e0b', enabled: false },
]

const imageFlowNodes: FlowNode[] = [
  { id: '1', label: '接收圖片', desc: '用戶傳送未歸類圖片', color: '#8b5cf6', enabled: true },
  { id: '2', label: 'AI 分類', desc: '識別圖片類型（菜單/海報/截圖...）', color: '#8b5cf6', enabled: true },
  { id: '3', label: '擷取資訊', desc: 'OCR 或視覺理解提取內容', color: '#8b5cf6', enabled: true },
  { id: '4', label: '結構化儲存', desc: '存入對應分類的資料夾', color: '#8b5cf6', enabled: true },
  { id: '5', label: '回覆用戶', desc: '告知處理結果', color: '#8b5cf6', enabled: false },
]

const flowsByTitle: Record<string, FlowNode[]> = {
  '名片收集與回應': cardFlowNodes,
  '回答與聊天': chatFlowNodes,
  '回應祝賀及問安': greetingFlowNodes,
  '其他未歸類圖片解析與處理': imageFlowNodes,
}

const STORAGE_PREFIX = 'sam.flow.'

function loadStoredFlow(title: string): FlowNode[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + title)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FlowNode[]
    if (!Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

function persistFlow(title: string, nodes: FlowNode[]) {
  try {
    localStorage.setItem(STORAGE_PREFIX + title, JSON.stringify(nodes))
  } catch {
    return
  }
}

function getInitialFlow(title: string): FlowNode[] {
  const stored = loadStoredFlow(title)
  if (stored && stored.length > 0) return stored
  return flowsByTitle[title] ?? []
}

export function Skills() {
  const [view, setView] = useState<'card' | 'list'>('card')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('date')
  const [flowSkill, setFlowSkill] = useState<typeof skillData[0] | null>(null)
  const [, setFlowVersion] = useState(0)
  const refreshFlows = () => setFlowVersion((v) => v + 1)

  useEffect(() => {
    try {
      if (localStorage.getItem('sam.flow.cleanup.v1')) return
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k)
      }
      keys.forEach((k) => localStorage.removeItem(k))
      localStorage.setItem('sam.flow.cleanup.v1', '1')
      if (keys.length > 0) refreshFlows()
    } catch {
      return
    }
  }, [])

  const filtered = useMemo(() => {
    const f = skillData.filter(
      (s) =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.tag.toLowerCase().includes(search.toLowerCase()),
    )
    if (sort === 'title') f.sort((a, b) => a.title.localeCompare(b.title))
    else f.sort((a, b) => b.date.localeCompare(a.date))
    return f
  }, [search, sort])

  return (
    <>
      <div className="page-header">
        <p className="page-subtitle" style={{ marginTop: 0 }}>
          LINE Agent 智能技能配置
        </p>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <input
          className="toolbar-search"
          placeholder="搜尋技能..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 260, flex: 1 }}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{
            padding: '7px 12px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: 13,
            background: 'var(--bg-card)',
            color: 'var(--text)',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="date">By Date</option>
          <option value="title">By Name</option>
        </select>
        <div
          style={{
            display: 'flex',
            border: '1px solid var(--border)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => setView('card')}
            style={{
              padding: '6px 10px',
              border: 'none',
              background: view === 'card' ? 'var(--bg-hover)' : 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Card view"
          >
            <ViewModuleIcon sx={{ fontSize: 18 }} />
          </button>
          <button
            onClick={() => setView('list')}
            style={{
              padding: '6px 10px',
              border: 'none',
              background: view === 'list' ? 'var(--bg-hover)' : 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              borderLeft: '1px solid var(--border)',
            }}
            title="List view"
          >
            <ViewListIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
        {filtered.length} skill{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Card view */}
      {view === 'card' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map((s) => (
            <div
              key={s.title}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s, transform 0.2s',
              }}
              onClick={() => setFlowSkill(s)}
              onMouseOver={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.08)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'none'
              }}
            >
              <div style={{ height: 4, background: s.color }} />
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: `${s.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {s.icon}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: `${s.color}10`, padding: '2px 8px', borderRadius: 4, letterSpacing: '0.3px' }}>
                    {s.tag}
                  </span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, lineHeight: 1.3 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.desc}</div>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>{s.date}</span>
                  <span style={{ color: s.color, fontWeight: 500, fontSize: 13 }}>配置設定 →</span>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty" style={{ gridColumn: '1 / -1' }}>無符合條件的技能</div>}
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {filtered.map((s, i) => (
            <div
              key={s.title}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onClick={() => setFlowSkill(s)}
              onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: 38, height: 38, borderRadius: 8, background: `${s.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.desc}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: `${s.color}10`, padding: '2px 8px', borderRadius: 4 }}>{s.tag}</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{s.date}</span>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty">無符合條件的技能</div>}
        </div>
      )}

      {/* Flow editor modal */}
      <FlowEditor
        open={flowSkill !== null}
        onClose={() => setFlowSkill(null)}
        skillTitle={flowSkill?.title || ''}
        skillIcon={flowSkill?.icon || null}
        skillColor={flowSkill?.color || '#3b82f6'}
        initialNodes={flowSkill ? getInitialFlow(flowSkill.title) : []}
        onSave={(nodes) => {
          if (flowSkill) {
            persistFlow(flowSkill.title, nodes)
            refreshFlows()
          }
        }}
      />
    </>
  )
}
