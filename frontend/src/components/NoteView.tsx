import type { Note } from '../api'
import { relativeTime } from '../relativeTime'

interface NoteViewProps {
  note: Note
}

export function NoteView({ note }: NoteViewProps) {
  return (
    <article className="note-view" aria-labelledby="note-view-title">
      <h2 id="note-view-title">{note.title}</h2>
      <p className="note-view-updated">Updated {relativeTime(note.updated_at)}</p>
      {note.body.trim() ? <p className="note-view-body">{note.body}</p> : null}
    </article>
  )
}
