import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  open: boolean
  onClose: () => void
  onSave: () => void
  children: ReactNode
  saveLabel?: string
  saving?: boolean
}

export function Modal({ title, open, onClose, onSave, children, saveLabel = 'Save', saving }: ModalProps) {
  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>\u2715</button>
        </div>
        <div>{children}</div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
