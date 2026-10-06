import { useEffect } from 'react'

// 간단한 확인 창(취소 / 확인 버튼). open이 false면 아무것도 그리지 않는다. Esc = 취소.
function ConfirmDialog({ open, title, message, confirmLabel = '확인', cancelLabel = '취소', danger = false, busy = false, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
      role="presentation"
      onClick={() => !busy && onCancel?.()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-sm rounded-xl border border-ridefit-border bg-ridefit-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="confirm-dialog"
      >
        <p id="confirm-dialog-title" className="text-base font-semibold text-ridefit-text">{title}</p>
        {message && <p className="mt-1.5 text-sm text-ridefit-text-secondary">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-ridefit-border px-4 py-2 text-sm text-ridefit-text transition hover:border-ridefit-primary disabled:opacity-50"
            data-testid="confirm-cancel"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${
              danger ? 'bg-ridefit-danger hover:brightness-110' : 'bg-ridefit-primary hover:brightness-110'
            }`}
            data-testid="confirm-ok"
          >
            {busy ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
