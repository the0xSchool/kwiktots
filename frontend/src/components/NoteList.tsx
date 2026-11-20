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
}

export function NoteList({ notes, shownId, onShow }: NoteListProps) {
  if (notes.length === 0) {
    return <p className="empty-state">No notes yet</p>
  }

  return (
    <ul className="note-list">
      {notes.map((note) => {
        const isShown = note.id === shownId
        return (
          <li key={note.id} className={isShown ? 'is-current' : undefined}>
            <button
              type="button"
              id={`note-row-${note.id}`}
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
          </li>
        )
      })}
    </ul>
  )
}
