import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ApiError, createNote, deleteNote, listNotes, updateNote, type Note } from './api'
import { Chat, type SheetStop } from './components/Chat'
import { NoteEditor, type NoteBanner, type NoteFields } from './components/NoteEditor'
import { NoteList } from './components/NoteList'
import { messageFor } from './errorMessage'
import { relativeTime } from './relativeTime'

// shownId while a new note has no title yet, so nothing has been created.
const NEW_NOTE = 'new'
const NOTE_GONE_MESSAGE =
  'That note no longer exists, perhaps because the server restarted.'
const NOTE_GONE_KEPT_MESSAGE =
  'That note no longer exists, perhaps because the server restarted. Your text is kept as a new note.'
// Changes save themselves this long after the last keystroke.
const SAVE_DELAY_MS = 500
// Matches the narrow-screen breakpoint in index.css (60rem).
const PHONE_QUERY = '(max-width: 60rem)'
// Remembers which pane gave way, across reloads.
const WIDE_KEY = 'kwiktots.wide'

// The Assistant (folded or not) and the note pane (closed or not) are independent,
// so both can be closed at once and the list then fills the space. They are stored
// together as 'none', 'note' (Assistant folded), 'list' (note closed) or 'both'.
interface Panes {
  assistantFolded: boolean
  noteClosed: boolean
}

// The note being edited. It has no id until a new note is first saved.
interface EditSession {
  id: string | undefined
}

function sortByUpdatedDesc(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

// True when the screen shows one pane at a time (the list, or the open note).
function isPhone(): boolean {
  // The tests run in jsdom, which has no matchMedia; treat that as a wide screen.
  return window.matchMedia?.(PHONE_QUERY).matches ?? false
}

function loadPanes(): Panes {
  try {
    const saved = localStorage.getItem(WIDE_KEY)
    return {
      assistantFolded: saved === 'note' || saved === 'both',
      noteClosed: saved === 'list' || saved === 'both',
    }
  } catch {
    // Storage blocked: start with everything open.
    return { assistantFolded: false, noteClosed: false }
  }
}

function savePanes({ assistantFolded, noteClosed }: Panes) {
  const value = assistantFolded
    ? noteClosed ? 'both' : 'note'
    : noteClosed ? 'list' : 'none'
  try {
    localStorage.setItem(WIDE_KEY, value)
  } catch {
    // Storage blocked: remember it for this page only.
  }
}

function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | undefined>(undefined)
  // A failed delete, shown at the top of the list.
  const [listError, setListError] = useState<string | undefined>(undefined)
  // The note in the middle: a note id, NEW_NOTE, or undefined when there is none.
  const [shownId, setShownId] = useState<string | undefined>(undefined)
  // What is in the open note's title and body fields.
  const [fields, setFields] = useState<NoteFields>({ title: '', body: '' })
  const [saving, setSaving] = useState(false)
  // A failed save, or a note that vanished, shown above the open note.
  const [banner, setBanner] = useState<NoteBanner | undefined>(undefined)
  // On a phone: false shows the list, true shows the open note.
  const [onNoteScreen, setOnNoteScreen] = useState(false)
  const [sheetFull, setSheetFull] = useState(false)
  const [panes, setPanes] = useState<Panes>(loadPanes)

  const newNoteButtonRef = useRef<HTMLButtonElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const backButtonRef = useRef<HTMLButtonElement>(null)

  // Autosave bookkeeping. These are refs because the save timer and the save
  // requests finish after the render that started them.
  const fieldsRef = useRef(fields)
  const session = useRef<EditSession>({ id: undefined })
  const saveTimer = useRef<number | undefined>(undefined)
  // Saves run one after another, so a new note is created once, then updated.
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const savesWaiting = useRef(0)
  // Notes deleted here, so a late save does not bring one back.
  const deletedIds = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listNotes()
      .then((loaded) => {
        if (cancelled) return
        const sorted = sortByUpdatedDesc(loaded)
        setNotes(sorted)
        setLoadError(undefined)
        // Open the newest note.
        if (sorted[0]) editNote(sorted[0])
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
    // editNote only uses refs and state setters, so the first one is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shownNote = notes.find((note) => note.id === shownId)
  const isNew = shownId === NEW_NOTE

  // ---------- Saving ----------

  // Send what is in the fields now, after any save already on its way.
  function queueSave() {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = undefined
    const { title, body } = fieldsRef.current
    if (!title.trim()) return
    const target = session.current
    savesWaiting.current += 1
    setSaving(true)
    saveQueue.current = saveQueue.current
      .then(() => sendSave(target, title, body))
      .finally(() => {
        savesWaiting.current -= 1
        if (savesWaiting.current === 0) setSaving(false)
      })
  }

  async function sendSave(target: EditSession, title: string, body: string): Promise<void> {
    if (target.id !== undefined && deletedIds.current.has(target.id)) return
    const isCurrent = target === session.current
    try {
      const saved =
        target.id === undefined
          ? await createNote({ title, body })
          : await updateNote(target.id, { title, body })
      target.id = saved.id
      // Saving moves the note to the top of the list; a new note appears there.
      setNotes((current) =>
        sortByUpdatedDesc([saved, ...current.filter((note) => note.id !== saved.id)]),
      )
      if (target === session.current) {
        setShownId(saved.id)
        setBanner((current) => (current?.retry ? undefined : current))
      }
    } catch (error) {
      if (target.id !== undefined && isNotFound(error)) {
        if (deletedIds.current.has(target.id)) return
        // The note is gone from the server: keep the text by saving it as a new note.
        const goneId = target.id
        target.id = undefined
        setNotes((current) => current.filter((note) => note.id !== goneId))
        if (isCurrent) setBanner({ text: NOTE_GONE_KEPT_MESSAGE, retry: false })
        await sendSave(target, title, body)
        return
      }
      if (target === session.current) {
        setBanner({ text: `Not saved: ${messageFor(error)}`, retry: true })
      }
    }
  }

  function handleFieldsChange(next: NoteFields) {
    setFields(next)
    fieldsRef.current = next
    window.clearTimeout(saveTimer.current)
    saveTimer.current = undefined
    // A note cannot be saved without a title (the server requires one).
    if (next.title.trim()) {
      setSaving(true)
      saveTimer.current = window.setTimeout(queueSave, SAVE_DELAY_MS)
    } else if (savesWaiting.current === 0) {
      setSaving(false)
    }
  }

  // ---------- Moving between notes ----------

  // Put a note in the editor, or an empty new note (null). Saves what is pending first.
  function editNote(note: Note | null) {
    if (saveTimer.current !== undefined) queueSave()
    session.current = { id: note?.id }
    const next = { title: note?.title ?? '', body: note?.body ?? '' }
    setFields(next)
    fieldsRef.current = next
    setShownId(note ? note.id : NEW_NOTE)
    setBanner(undefined)
  }

  // Folded is remembered across reloads. Full screen (phones) is not.
  function changeSheetStop(stop: SheetStop) {
    setSheetFull(stop === 'full')
    const folded = stop === 'folded'
    if (folded !== panes.assistantFolded) changePanes({ assistantFolded: folded })
  }

  function changePanes(change: Partial<Panes>) {
    const next = { ...panes, ...change }
    setPanes(next)
    savePanes(next)
  }

  function showNote(id: string) {
    const note = notes.find((n) => n.id === id)
    if (!note) return
    setListError(undefined)
    // Opening a note from the list brings a closed note pane back.
    if (panes.noteClosed) changePanes({ noteClosed: false })
    if (!isPhone()) {
      if (id !== shownId) editNote(note)
      return
    }
    // On a phone the list is about to hide, so apply the change now and then
    // move focus to the top of the note screen.
    flushSync(() => {
      if (id !== shownId) editNote(note)
      setOnNoteScreen(true)
    })
    backButtonRef.current?.focus()
  }

  function openNewNote() {
    if (panes.noteClosed) changePanes({ noteClosed: false })
    // Render the empty note first, so the Title field exists to take focus.
    flushSync(() => {
      editNote(null)
      if (isPhone()) setOnNoteScreen(true)
    })
    titleInputRef.current?.focus()
  }

  // Back to the list (phones). Focus goes to the given note's row, or to New note.
  function showList(focusId: string | undefined) {
    if (saveTimer.current !== undefined) queueSave()
    flushSync(() => setOnNoteScreen(false))
    const row = focusId ? document.getElementById(`note-row-${focusId}`) : null
    if (row) row.focus()
    else newNoteButtonRef.current?.focus()
  }

  // The ✕: close the note pane completely; the list takes its space.
  function closeNote() {
    if (saveTimer.current !== undefined) queueSave()
    flushSync(() => changePanes({ noteClosed: true }))
    // The ✕ went with the pane, so focus the note's row: that is how it opens again.
    const row = shownNote ? document.getElementById(`note-row-${shownNote.id}`) : null
    if (row) row.focus()
    else newNoteButtonRef.current?.focus()
  }

  async function handleDelete(note: Note) {
    const confirmed = window.confirm(`Delete "${note.title}"? This cannot be undone.`)
    if (!confirmed) return

    // Afterwards, focus (and, if it was open, show) the next note down, or the one
    // above if this was the last.
    const index = notes.findIndex((n) => n.id === note.id)
    const neighbour = notes[index + 1] ?? notes[index - 1]
    const wasShown = note.id === shownId
    let gone = false

    deletedIds.current.add(note.id)
    try {
      await deleteNote(note.id)
    } catch (error) {
      if (!isNotFound(error)) {
        deletedIds.current.delete(note.id)
        setListError(messageFor(error))
        return
      }
      gone = true
    }

    if (wasShown) {
      // Drop any unsent change to the deleted note.
      window.clearTimeout(saveTimer.current)
      saveTimer.current = undefined
    }
    flushSync(() => {
      setNotes((current) => current.filter((n) => n.id !== note.id))
      setListError(gone ? NOTE_GONE_MESSAGE : undefined)
      if (wasShown) {
        if (neighbour) editNote(neighbour)
        else setShownId(undefined)
      }
    })
    // The bin went with its row.
    const row = neighbour ? document.getElementById(`note-row-${neighbour.id}`) : null
    if (row) row.focus()
    else newNoteButtonRef.current?.focus()
  }

  // ---------- What the open note says under its title ----------

  let status = ''
  if (!fields.title.trim()) status = 'Add a title to save'
  else if (saving) status = 'Saving…'
  else if (banner?.retry) status = '' // the red banner above says it
  else if (shownNote) status = `Updated ${relativeTime(shownNote.updated_at)}`

  let appClass = 'app'
  if (onNoteScreen) appClass += ' show-note'
  if (panes.assistantFolded) appClass += ' wide-note'
  if (panes.noteClosed) appClass += ' wide-list'
  if (sheetFull && !panes.assistantFolded) appClass += ' sheet-full'

  return (
    <div className={appClass}>
      <main className="notes-area">
        <header className="app-header">
          <h1>Kwiktots</h1>
          <button type="button" ref={newNoteButtonRef} onClick={openNewNote}>
            New note
          </button>
        </header>

        <div className="notes-body">
          <section className="list-pane" aria-label="Notes">
            {listError ? (
              <p className="status error" role="alert">
                {listError}
              </p>
            ) : null}
            {loading ? <p className="status">Loading notes…</p> : null}
            {loadError ? (
              <p className="status error" role="alert">
                {loadError}
              </p>
            ) : null}
            {!loading && !loadError ? (
              <NoteList
                notes={notes}
                // With the note pane closed, no row is the open note.
                shownId={panes.noteClosed ? undefined : shownNote?.id}
                onShow={showNote}
                onDelete={handleDelete}
              />
            ) : null}
          </section>

          {isNew || shownNote ? (
            <NoteEditor
              fields={fields}
              status={status}
              banner={banner}
              titleRef={titleInputRef}
              backRef={backButtonRef}
              onChange={handleFieldsChange}
              onRetry={queueSave}
              onClose={closeNote}
              onBack={() => showList(shownNote?.id)}
            />
          ) : null}
        </div>
      </main>

      <Chat
        stop={panes.assistantFolded ? 'folded' : sheetFull ? 'full' : 'default'}
        onStop={changeSheetStop}
      />
    </div>
  )
}

export default App
