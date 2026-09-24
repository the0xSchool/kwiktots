import { useEffect, useRef, useState } from 'react'
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
const NOTE_GONE_MESSAGE =
  'That note no longer exists, perhaps because the server restarted.'
const NOTE_GONE_KEEP_DRAFT_MESSAGE =
  'That note no longer exists, perhaps because the server restarted. Your text is kept as a new note. Press Save to create it.'

type PendingFocus = 'title' | 'new-note-button' | null

function sortByUpdatedDesc(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | undefined>(undefined)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [savingId, setSavingId] = useState<string | undefined>(undefined)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | undefined>(undefined)
  const [draft, setDraft] = useState<{ title: string; body: string } | undefined>(
    undefined,
  )

  const selectedIdRef = useRef<string | undefined>(selectedId)
  const pendingFocus = useRef<PendingFocus>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const newNoteButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    if (pendingFocus.current === 'title' && selectedId !== undefined) {
      titleInputRef.current?.focus()
      pendingFocus.current = null
    } else if (pendingFocus.current === 'new-note-button' && selectedId === undefined) {
      newNoteButtonRef.current?.focus()
      pendingFocus.current = null
    }
  }, [selectedId])

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
  const isSaving = savingId !== undefined && savingId === selectedId

  function openNewNote() {
    setSelectedId(NEW_NOTE)
    setDraft(undefined)
    setFieldErrors({})
    setFormError(undefined)
  }

  function selectNote(id: string) {
    setSelectedId(id)
    setDraft(undefined)
    setFieldErrors({})
    setFormError(undefined)
  }

  function closeEditorAsGone(targetId: string) {
    setNotes((current) => current.filter((note) => note.id !== targetId))
    if (selectedIdRef.current === targetId) {
      setSelectedId(undefined)
      setFieldErrors({})
      setFormError(NOTE_GONE_MESSAGE)
      pendingFocus.current = 'new-note-button'
    }
  }

  async function handleSave(title: string, body: string) {
    const targetId = selectedId
    if (targetId === undefined) return
    const targetIsNew = targetId === NEW_NOTE
    const existingNote = targetIsNew
      ? undefined
      : notes.find((note) => note.id === targetId)

    setSavingId(targetId)
    setFieldErrors({})
    setFormError(undefined)

    try {
      if (targetIsNew) {
        const created = await createNote({ title, body })
        setNotes((current) => sortByUpdatedDesc([...current, created]))
        if (selectedIdRef.current === targetId) {
          pendingFocus.current = 'title'
          setSelectedId(created.id)
        }
      } else if (existingNote) {
        const updated = await updateNote(existingNote.id, { title, body })
        setNotes((current) =>
          sortByUpdatedDesc(
            current.map((note) => (note.id === updated.id ? updated : note)),
          ),
        )
      }
    } catch (error) {
      if (!targetIsNew && isNotFound(error)) {
        setNotes((current) => current.filter((note) => note.id !== targetId))
        if (selectedIdRef.current === targetId) {
          setDraft({ title, body })
          setFieldErrors({})
          setFormError(NOTE_GONE_KEEP_DRAFT_MESSAGE)
          pendingFocus.current = 'title'
          setSelectedId(NEW_NOTE)
        }
        return
      }
      if (selectedIdRef.current === targetId) {
        if (error instanceof ApiError && error.status === 422) {
          setFieldErrors(fieldErrorsFor(error))
        }
        setFormError(messageFor(error))
      }
    } finally {
      setSavingId((current) => (current === targetId ? undefined : current))
    }
  }

  async function handleDelete() {
    if (!selectedNote) return
    const targetId = selectedNote.id
    const confirmed = window.confirm(
      `Delete "${selectedNote.title}"? This cannot be undone.`,
    )
    if (!confirmed) return

    try {
      await deleteNote(targetId)
      setNotes((current) => current.filter((note) => note.id !== targetId))
      if (selectedIdRef.current === targetId) {
        setSelectedId(undefined)
        setFormError(undefined)
        pendingFocus.current = 'new-note-button'
      }
    } catch (error) {
      if (isNotFound(error)) {
        closeEditorAsGone(targetId)
        return
      }
      if (selectedIdRef.current === targetId) {
        setFormError(messageFor(error))
      }
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Kwiktots</h1>
        <button type="button" ref={newNoteButtonRef} onClick={openNewNote}>
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
          {formError ? (
            <p className="status error" role="alert">
              {formError}
            </p>
          ) : null}
          {isEditorOpen ? (
            <NoteEditor
              key={selectedId}
              initialTitle={isNew ? (draft?.title ?? '') : (selectedNote?.title ?? '')}
              initialBody={isNew ? (draft?.body ?? '') : (selectedNote?.body ?? '')}
              isNew={isNew}
              isSaving={isSaving}
              fieldErrors={fieldErrors}
              titleInputRef={titleInputRef}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          ) : (
            <p className="status">Select a note, or create a new one.</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default App
