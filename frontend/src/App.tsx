import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  ApiError,
  createNote,
  deleteNote,
  listNotes,
  updateNote,
  type Note,
} from './api'
import { Chat } from './components/Chat'
import { NoteEditor, type FieldErrors } from './components/NoteEditor'
import { NoteList } from './components/NoteList'
import { NoteView } from './components/NoteView'
import { fieldErrorsFor, messageFor } from './errorMessage'

const NEW_NOTE = 'new'
const NOTE_GONE_MESSAGE =
  'That note no longer exists, perhaps because the server restarted.'
const NOTE_GONE_KEEP_DRAFT_MESSAGE =
  'That note no longer exists, perhaps because the server restarted. Your text is kept as a new note. Press Save to create it.'

type PendingFocus = 'title' | 'new-note-button' | null

// Which pane has given way: none, the Assistant (folded to a strip), or the open note (closed).
type Wide = 'none' | 'note' | 'list'
const WIDE_KEY = 'kwiktots.wide'

function loadWide(): Wide {
  try {
    const saved = localStorage.getItem(WIDE_KEY)
    if (saved === 'note' || saved === 'list') return saved
  } catch {
    // Storage is blocked: start with nothing folded.
  }
  return 'none'
}

// Matches the narrow-screen breakpoint in index.css (60rem).
const PHONE_QUERY = '(max-width: 60rem)'

// True when the screen shows one pane at a time (the list, or the open note).
function isPhone(): boolean {
  // The tests run in jsdom, which has no matchMedia; treat that as a wide screen.
  return window.matchMedia?.(PHONE_QUERY).matches ?? false
}

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

  // The note in the middle. Undefined means "the newest note".
  const [shownId, setShownId] = useState<string | undefined>(undefined)
  // On a phone: false shows the list, true shows the open note.
  const [onNoteScreen, setOnNoteScreen] = useState(false)
  const [wide, setWide] = useState<Wide>(loadWide)

  const selectedIdRef = useRef<string | undefined>(selectedId)
  const pendingFocus = useRef<PendingFocus>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const newNoteButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const backButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selectedId !== undefined && !dialog.open) {
      dialog.showModal()
      titleInputRef.current?.focus()
    }
    if (selectedId === undefined && dialog.open) dialog.close()
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
  const shownNote = notes.find((note) => note.id === shownId) ?? notes[0]
  const isNoteOpen = shownNote !== undefined && wide !== 'list'
  const isEditorOpen = selectedId !== undefined
  const isNew = selectedId === NEW_NOTE
  const isSaving = savingId !== undefined && savingId === selectedId

  function openNewNote() {
    setSelectedId(NEW_NOTE)
    setDraft(undefined)
    setFieldErrors({})
    setFormError(undefined)
  }

  function editNote(id: string) {
    setSelectedId(id)
    setDraft(undefined)
    setFieldErrors({})
    setFormError(undefined)
  }

  function closeEditor() {
    setSelectedId(undefined)
    setDraft(undefined)
    setFieldErrors({})
    setFormError(undefined)
  }

  function changeWide(value: Wide) {
    setWide(value)
    try {
      localStorage.setItem(WIDE_KEY, value)
    } catch {
      // Storage is blocked: the choice lasts for this page only.
    }
  }

  function showNote(id: string) {
    if (wide === 'list') changeWide('none')
    if (!isPhone()) {
      setShownId(id)
      return
    }
    // On a phone the list is about to hide, so apply the change now and then
    // move focus to Back, the first control on the note screen.
    flushSync(() => {
      setShownId(id)
      setOnNoteScreen(true)
    })
    backButtonRef.current?.focus()
  }

  // Back to the list. Focus goes to the given note's row, or to New note.
  function showList(focusId: string | undefined) {
    flushSync(() => setOnNoteScreen(false))
    const row = focusId ? document.getElementById(`note-row-${focusId}`) : null
    if (row) row.focus()
    else newNoteButtonRef.current?.focus()
  }

  // Close the open note on a wide screen: the list takes the whole notes area.
  function closeNote() {
    flushSync(() => changeWide('list'))
    const row = shownNote ? document.getElementById(`note-row-${shownNote.id}`) : null
    if (row) row.focus()
    else newNoteButtonRef.current?.focus()
  }

  function closeEditorAsGone(targetId: string) {
    setNotes((current) => current.filter((note) => note.id !== targetId))
    setFormError(NOTE_GONE_MESSAGE)
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
        setShownId(created.id)
        if (wide === 'list') changeWide('none')
        if (isPhone()) setOnNoteScreen(true)
        if (selectedIdRef.current === targetId) closeEditor()
      } else if (existingNote) {
        const updated = await updateNote(existingNote.id, { title, body })
        setNotes((current) =>
          sortByUpdatedDesc(
            current.map((note) => (note.id === updated.id ? updated : note)),
          ),
        )
        if (selectedIdRef.current === targetId) closeEditor()
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

  async function handleDelete(note: Note) {
    const targetId = note.id
    const confirmed = window.confirm(
      `Delete "${note.title}"? This cannot be undone.`,
    )
    if (!confirmed) return

    // Afterwards, show the next note down, or the one above if this was the last.
    const index = notes.findIndex((n) => n.id === targetId)
    const neighbourId = (notes[index + 1] ?? notes[index - 1])?.id

    try {
      await deleteNote(targetId)
      setNotes((current) => current.filter((note) => note.id !== targetId))
    } catch (error) {
      if (!isNotFound(error)) {
        setFormError(messageFor(error))
        return
      }
      closeEditorAsGone(targetId)
    }
    setShownId(neighbourId)
    // No note left to show: go back to the list and focus New note.
    if (neighbourId === undefined) showList(undefined)
  }

  const appClass = [
    'app',
    onNoteScreen ? 'show-note' : '',
    wide === 'note' ? 'wide-note' : '',
    wide === 'list' ? 'wide-list' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={appClass}>
      <main>
        <header className="app-header">
          <h1>Kwiktots</h1>
          <button type="button" ref={newNoteButtonRef} onClick={openNewNote}>
            New note
          </button>
        </header>

        {formError && !isEditorOpen ? (
          <p className="status error page-error" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="notes-body">
          <section className="list-pane" aria-label="Notes">
            {loading ? <p className="status">Loading notes…</p> : null}
            {loadError ? (
              <p className="status error" role="alert">
                {loadError}
              </p>
            ) : null}
            {!loading && !loadError ? (
              <NoteList
                notes={notes}
                shownId={isNoteOpen ? shownNote.id : undefined}
                onShow={showNote}
              />
            ) : null}
          </section>

          {isNoteOpen ? (
            <section className="note-pane" aria-label="Open note">
              <div className="note-bar">
                <button
                  type="button"
                  ref={backButtonRef}
                  className="secondary back-button"
                  onClick={() => showList(shownNote.id)}
                >
                  Back
                </button>
                <div className="note-bar-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Edit note "${shownNote.title}"`}
                    title="Edit"
                    onClick={() => editNote(shownNote.id)}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                      <path d="M13.5 6.5l4 4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Delete note "${shownNote.title}"`}
                    title="Delete"
                    onClick={() => handleDelete(shownNote)}
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
                  <button
                    type="button"
                    className="icon-button note-close"
                    aria-label="Close note"
                    title="Close note"
                    onClick={closeNote}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </div>
              <NoteView note={shownNote} />
            </section>
          ) : null}
        </div>
      </main>

      <dialog ref={dialogRef} onCancel={closeEditor} aria-labelledby="note-dialog-title">
        <h2 id="note-dialog-title">{isNew ? 'New note' : 'Edit note'}</h2>
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
            isSaving={isSaving}
            fieldErrors={fieldErrors}
            titleInputRef={titleInputRef}
            onSave={handleSave}
            onCancel={closeEditor}
          />
        ) : null}
      </dialog>

      <Chat
        folded={wide === 'note'}
        onToggle={() => changeWide(wide === 'note' ? 'none' : 'note')}
      />
    </div>
  )
}

export default App
