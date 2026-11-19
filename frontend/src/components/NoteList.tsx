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
  onEdit: (id: string) => void
  onDelete: (note: Note) => void
}

export function NoteList({ notes, onEdit, onDelete }: NoteListProps) {
  if (notes.length === 0) {
    return <p className="empty-state">No notes yet</p>
  }

  return (
    <ul className="note-list">
      {notes.map((note) => (
        <li key={note.id}>
          <button
            type="button"
            className="note-summary"
            onClick={() => onEdit(note.id)}
          >
            <span className="note-summary-title">{note.title}</span>
            <span className="note-summary-preview">{preview(note.body)}</span>
            <span className="note-summary-updated">
              Updated {relativeTime(note.updated_at)}
            </span>
          </button>
          <button type="button" aria-label="Edit note" onClick={() => onEdit(note.id)}>
            ✎
          </button>
          <button type="button" aria-label="Delete note" onClick={() => onDelete(note)}>
            🗑
          </button>
        </li>
      ))}
    </ul>
  )
}
