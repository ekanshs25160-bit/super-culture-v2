import React, { useEffect } from 'react';

/**
 * ConfirmDialog
 * Accessible, glassmorphic modal confirmation dialog.
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmVariant = 'danger',
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const isDanger = confirmVariant === 'danger';

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sc-card w-full max-w-sm rounded-2xl p-5 sm:p-6 border border-white/15 bg-[#111113] shadow-[0_24px_50px_rgba(0,0,0,0.85)] flex flex-col select-none"
      >
        <h2 id="confirm-dialog-title" className="text-sm sm:text-base font-semibold text-[#F4F4F2]">
          {title}
        </h2>
        {message && (
          <p id="confirm-dialog-description" className="text-xs sm:text-sm text-[#8A8A8E] mt-2 leading-relaxed">
            {message}
          </p>
        )}

        <div className="flex items-center justify-end gap-2.5 mt-5">
          <button
            type="button"
            onClick={onCancel}
            aria-label={cancelLabel}
            className="sc-pill px-4 py-2 text-xs sm:text-sm font-medium text-[#F4F4F2] bg-white/10 hover:bg-white/20 border border-white/20 rounded-full transition cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            aria-label={confirmLabel}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-full transition cursor-pointer ${
              isDanger
                ? 'bg-[#FF5A5F] hover:bg-[#ff7377] text-white shadow-[0_4px_16px_rgba(255,90,95,0.3)]'
                : 'bg-[#1ED760] hover:bg-[#22e868] text-[#0B0B0C]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
