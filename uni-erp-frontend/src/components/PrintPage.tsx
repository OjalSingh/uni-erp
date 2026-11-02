import type { ReactNode } from 'react'

// Screen: title + controls + preview. Paper: only the cards (everything else carries .no-print or sits in the shell, hidden by print CSS).
export default function PrintPage({ title, controls, included, total, error, empty, children }: {
  title: string
  controls: ReactNode
  included: number
  total: number
  error: string
  empty: string
  children: ReactNode
}) {
  return (
    <>
      <h1 className="page-title no-print">{title}</h1>
      <section className="panel no-print">
        <div className="toolbar">{controls}</div>
        {error && <p className="err pad">{error}</p>}
        <div className="toolbar">
          <span className="hint">
            {included} of {total} selected for printing. Untick a card to leave it out.
          </span>
          <button className="btn-save" disabled={included === 0} onClick={() => window.print()}>
            Print {included} {included === 1 ? 'card' : 'cards'}
          </button>
        </div>
        {total === 0 && !error && <p className="empty-note">{empty}</p>}
      </section>
      <div className="print-area">{children}</div>
    </>
  )
}

// Wrapper that adds the include/exclude tick (hidden on paper) around one printable card
export function Selectable({ on, onToggle, label, children }: { on: boolean; onToggle: () => void; label: string; children: ReactNode }) {
  return (
    <div className={`selectable ${on ? '' : 'excluded'}`}>
      <label className="no-print pick">
        <input type="checkbox" checked={on} onChange={onToggle} /> {label}
      </label>
      {on && children}
    </div>
  )
}
