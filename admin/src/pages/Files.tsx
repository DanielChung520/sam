import { useState, useEffect } from 'react'
import { get, del } from '../api/client'

interface FileDto {
  fileId: string
  channelId: string
  filename: string
  contentType: string
  size: number
  createdAt: number
  shareUrl: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

export function Files() {
  const [files, setFiles] = useState<FileDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadFiles() {
    setLoading(true)
    setError(null)
    try {
      const res = await get<{ data: FileDto[] }>('/admin/files')
      setFiles(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFiles() }, [])

  async function handleDelete(fileId: string) {
    if (!confirm('Delete this file? This cannot be undone.')) return
    try {
      await del(`/admin/files/${encodeURIComponent(fileId)}`)
      setFiles((prev) => prev.filter((f) => f.fileId !== fileId))
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Files</h1>
        <p className="page-subtitle">Uploaded files across all channels — share token management</p>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-spacer" />
          <button className="btn btn-secondary" onClick={loadFiles} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: '#fee2e2', color: 'var(--danger)', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
            ⚠ {error}
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Filename</th>
                <th>Channel</th>
                <th>Type</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Share URL</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>Loading...</td></tr>
              ) : files.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No files uploaded yet</td></tr>
              ) : (
                files.map((f) => (
                  <tr key={f.fileId}>
                    <td style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{f.channelId}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{f.contentType}</td>
                    <td style={{ fontSize: 12 }}>{formatSize(f.size)}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(f.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <code style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {f.shareUrl.slice(0, 30)}…
                        </code>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            copyToClipboard(window.location.origin + f.shareUrl)
                          }}
                          title="Copy share URL"
                        >
                          📋
                        </button>
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(f.fileId)}>Del</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
