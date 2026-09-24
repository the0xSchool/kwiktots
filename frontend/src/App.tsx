import { useEffect, useState } from 'react'
import {
  ApiError,
  createNote,
  deleteNote,
  listNotes,
  updateNote,
  type Note,
} from './api'
import { NoteEditor, type FieldErrors } from './components/NoteEditor'
import { NoteList } from './components/NoteList'
import { fieldErrorsFor, messageFor } from './errorMessage'

const NEW_NOTE = 'new'

function sortByUpdatedDesc(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
}

function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | undefined>(undefined)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listNotes()
      .then((loaded) => {
        if (cancelled) return
        setNotes(sortByUpdatedDesc(loaded))
        setLoadError(undefined)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(messageFor(error))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedNote = notes.find((note) => note.id === selectedId)
  const isEditorOpen = selectedId !== undefined
  const isNew = selectedId === NEW_NOTE

  function openNewNote() {
    setSelectedId(NEW_NOTE)
    setFieldErrors({})
    setFormError(undefined)
  }

  function selectNote(id: string) {
    setSelectedId(id)
    setFieldErrors({})
    setFormError(undefined)
  }

  async function handleSave(title: string, body: string) {
    setIsSaving(true)
    setFieldErrors({})
    setFormError(undefined)
    try {
      if (isNew) {
        const created = await createNote({ title, body })
        setNotes((current) => sortByUpdatedDesc([...current, created]))
        setSelectedId(created.id)
      } else if (selectedNote) {
        const updated = await updateNote(selectedNote.id, { title, body })
        setNotes((current) =>
          sortByUpdatedDesc(
            current.map((note) => (note.id === updated.id ? updated : note)),
          ),
        )
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setFieldErrors(fieldErrorsFor(error))
      }
      setFormError(messageFor(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedNote) return
    const confirmed = window.confirm(
      `Delete "${selectedNote.title}"? This cannot be undone.`,
    )
    if (!confirmed) return

    try {
      await deleteNote(selectedNote.id)
      setNotes((current) => current.filter((note) => note.id !== selectedNote.id))
      setSelectedId(undefined)
    } catch (error) {
      setFormError(messageFor(error))
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Kwiktots</h1>
        <button type="button" onClick={openNewNote}>
          New note
        </button>
      </header>

      <div className="app-body">
        <section className="list-pane" aria-label="Notes">
          {loading ? <p className="status">Loading notes…</p> : null}
          {loadError ? (
            <p className="status error" role="alert">
              {loadError}
            </p>
          ) : null}
          {!loading && !loadError ? (
            <NoteList notes={notes} selectedId={selectedId} onSelect={selectNote} />
          ) : null}
        </section>

        <section className="editor-pane" aria-label="Editor">
          {isEditorOpen ? (
            <>
              {formError ? (
                <p className="status error" role="alert">
                  {formError}
                </p>
              ) : null}
              <NoteEditor
                key={selectedId}
                initialTitle={isNew ? '' : (selectedNote?.title ?? '')}
                initialBody={isNew ? '' : (selectedNote?.body ?? '')}
                isNew={isNew}
                isSaving={isSaving}
                fieldErrors={fieldErrors}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            </>
          ) : (
            <p className="status">Select a note, or create a new one.</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default App
