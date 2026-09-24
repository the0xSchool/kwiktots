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
  selectedId: string | undefined
  onSelect: (id: string) => void
}

export function NoteList({ notes, selectedId, onSelect }: NoteListProps) {
  if (notes.length === 0) {
    return <p className="empty-state">No notes yet</p>
  }

  return (
    <ul className="note-list">
      {notes.map((note) => (
        <li key={note.id}>
          <button
            type="button"
            className={
              note.id === selectedId ? 'note-summary is-selected' : 'note-summary'
            }
            aria-current={note.id === selectedId}
            onClick={() => onSelect(note.id)}
          >
            <span className="note-summary-title">{note.title}</span>
            <span className="note-summary-preview">{preview(note.body)}</span>
            <span className="note-summary-updated">
              Updated {relativeTime(note.updated_at)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
