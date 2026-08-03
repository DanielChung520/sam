// AvatarPicker — 頭像選擇器（系統圖示 + 上傳裁切縮放）
// 參考 aibox-th 的 AvatarPicker，改用 sam admin 自製 CSS 風格

import { useEffect, useRef, useState } from 'react'

interface AvatarItem {
  name: string
  url: string
}

interface AvatarPickerProps {
  value?: string
  onChange: (value: string) => void
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  const [open, setOpen] = useState(false)
  const [avatars, setAvatars] = useState<AvatarItem[]>([])
  const [tab, setTab] = useState<'system' | 'upload'>('system')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/v1/avatars')
      .then((r) => r.json())
      .then((d) => setAvatars(d.data ?? []))
      .catch(() => {})
  }, [open])

  const isUploaded = value ? value.startsWith('data:') : false
  const currentSystem = isUploaded ? null : avatars.find((a) => a.name === value)
  const previewSrc = isUploaded ? value : currentSystem?.url

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('圖片大小請勿超過 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const size = Math.min(img.width, img.height)
        const offsetX = (img.width - size) / 2
        const offsetY = (img.height - size) / 2
        const canvas = document.createElement('canvas')
        canvas.width = 200
        canvas.height = 200
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, 200, 200)
        onChange(canvas.toDataURL('image/jpeg', 0.8))
        setOpen(false)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{
          cursor: 'pointer',
          width: 64,
          height: 64,
          borderRadius: 10,
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: '#f8fafc',
        }}
      >
        {previewSrc ? (
          <img src={previewSrc} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', padding: 4 }}>選擇頭像</span>
        )}
      </div>

      {open && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="modal" style={{ width: 520, maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">選擇頭像</h2>
              <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                className={`btn ${tab === 'system' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTab('system')}
              >
                🎨 系統圖示
              </button>
              <button
                className={`btn ${tab === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTab('upload')}
              >
                📁 上傳圖片
              </button>
            </div>

            {tab === 'system' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, maxHeight: 320, overflowY: 'auto', padding: '8px 0' }}>
                {avatars.map((a) => (
                  <div
                    key={a.name}
                    onClick={() => { onChange(a.name); setOpen(false) }}
                    style={{
                      cursor: 'pointer',
                      width: 64,
                      height: 64,
                      borderRadius: 8,
                      border: value === a.name ? '2px solid var(--primary)' : '1px solid var(--border)',
                      overflow: 'hidden',
                      transition: 'border-color 0.2s',
                    }}
                    title={a.name}
                  >
                    <img src={a.url} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    padding: '24px 48px',
                    borderRadius: 8,
                    border: '2px dashed var(--border)',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 32 }}>📤</span>
                  點擊選擇圖片（自動裁切為正方形，最大 5MB）
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
