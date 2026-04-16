import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  pendingLabel?: string
  cancelLabel?: string
  isPending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  pendingLabel,
  cancelLabel = 'Cancel',
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, isPending, onCancel])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-surface-container-lowest/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onCancel()
      }}
    >
      <div className="w-full max-w-sm rounded-3xl bg-surface-container-high p-6 text-on-surface shadow-[0_20px_60px_-10px_rgba(6,14,32,0.8)]">
        <h2 className="font-display mb-2 text-base font-semibold text-on-surface">
          {title}
        </h2>
        <p className="body-md mb-6 text-on-surface-variant">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-xl border border-outline-variant/30 px-4 py-3 text-on-surface transition hover:bg-white/5 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 rounded-xl bg-tertiary-container px-4 py-3 font-display font-semibold text-on-tertiary-container shadow-[0_10px_30px_-10px_rgba(207,44,48,0.5)] transition disabled:opacity-60"
          >
            {isPending ? (pendingLabel ?? `${confirmLabel}…`) : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
