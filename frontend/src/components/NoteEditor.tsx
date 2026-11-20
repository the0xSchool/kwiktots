import { useRef } from 'react'
import type { KeyboardEvent, RefObject } from 'react'

// The server's limits (backend/app/models.py), so the fields cannot go over them.
const TITLE_MAX_LENGTH = 200
const BODY_MAX_LENGTH = 10_000

export interface NoteFields {
  title: string
  body: string
}

// A message above the note. `retry` adds a Try again button (a failed save).
export interface NoteBanner {
  text: string
  retry: boolean
}

interface NoteEditorProps {
  fields: NoteFields
  status: string
  banner: NoteBanner | undefined
  titleRef: RefObject<HTMLInputElement | null>
  backRef: RefObject<HTMLButtonElement | null>
  onChange: (fields: NoteFields) => void
  onRetry: () => void
  onClose: () => void
  onBack: () => void
}

// The open note, edited in place: the top line is the title, the rest is the body.
export function NoteEditor({
  fields,
  status,
  banner,
  titleRef,
  backRef,
  onChange,
  onRetry,
  onClose,
  onBack,
}: NoteEditorProps) {
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Enter in the title moves to the start of the body, like the first line of a document.
  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    bodyRef.current?.focus()
    bodyRef.current?.setSelectionRange(0, 0)
  }

  // Backspace at the very start of the body goes back up to the end of the title.
  function handleBodyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const body = event.currentTarget
    if (event.key !== 'Backspace' || body.selectionStart !== 0 || body.selectionEnd !== 0) return
    event.preventDefault()
    const end = fields.title.length
    titleRef.current?.focus()
    titleRef.current?.setSelectionRange(end, end)
  }

  return (
    <section className="note-pane" aria-label="Open note">
      <button type="button" ref={backRef} className="secondary back-button" onClick={onBack}>
        Back
      </button>
      {banner ? (
        <p className="status error" role="alert">
          {banner.text}{' '}
          {banner.retry ? (
            <button type="button" className="secondary" onClick={onRetry}>
              Try again
            </button>
          ) : null}
        </p>
      ) : null}
      <div className="note-head">
        <input
          ref={titleRef}
          className="note-title-input"
          aria-label="Title"
          placeholder="Title"
          maxLength={TITLE_MAX_LENGTH}
          autoComplete="off"
          value={fields.title}
          onChange={(event) => onChange({ title: event.target.value, body: fields.body })}
          onKeyDown={handleTitleKeyDown}
        />
        <button
          type="button"
          className="icon-button note-close"
          aria-label="Close note"
          title="Close note"
          onClick={onClose}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <p className="note-status" role="status">
        {status}
      </p>
      <textarea
        ref={bodyRef}
        className="note-body-input"
        aria-label="Body"
        placeholder="Start writing"
        maxLength={BODY_MAX_LENGTH}
        value={fields.body}
        onChange={(event) => onChange({ title: fields.title, body: event.target.value })}
        onKeyDown={handleBodyKeyDown}
      />
    </section>
  )
}
