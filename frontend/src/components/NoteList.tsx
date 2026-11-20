import type { Note } from '../api'
import { relativeTime } from '../relativeTime'

function preview(body: string): string {
  const firstLine = body.split('\n')[0]?.trim() ?? ''
  if (firstLine.length <= 80) {
    return firstLine
  }
  return `${firstLine.slice(0, 79)}…`
}

interface NoteListProps {
  notes: Note[]
  shownId: string | undefined
  onShow: (id: string) => void
  onDelete: (note: Note) => void
}

export function NoteList({ notes, shownId, onShow, onDelete }: NoteListProps) {
  if (notes.length === 0) {
    return <p className="empty-state">No notes yet</p>
  }

  return (
    <ul className="note-list">
      {notes.map((note) => {
        const isShown = note.id === shownId
        return (
          <li key={note.id} className={isShown ? 'is-current' : undefined}>
            <div className="note-summary">
              <button
                type="button"
                id={`note-row-${note.id}`} /* App.tsx focuses this */
                className="note-open"
                aria-current={isShown ? 'true' : undefined}
                onClick={() => onShow(note.id)}
              >
                {note.title}
              </button>
              {preview(note.body) ? (
                <span className="note-summary-preview">{preview(note.body)}</span>
              ) : null}
              <span className="note-summary-updated">
                Updated {relativeTime(note.updated_at)}
              </span>
            </div>
            <div className="note-actions">
              <button
                type="button"
                className="icon-button danger"
                aria-label={`Delete note "${note.title}"`}
                title="Delete"
                onClick={() => onDelete(note)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 7h16" />
                  <path d="M9 7V4h6v3" />
                  <path d="M6 7l1 13h10l1-13" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
