import { useEffect, useState } from 'react'
import type { FormEvent, RefObject } from 'react'

export interface FieldErrors {
  title?: string
  body?: string
}

interface NoteEditorProps {
  initialTitle: string
  initialBody: string
  isSaving: boolean
  fieldErrors: FieldErrors
  titleInputRef?: RefObject<HTMLInputElement | null>
  onSave: (title: string, body: string) => void
  onCancel: () => void
}

export function NoteEditor({
  initialTitle,
  initialBody,
  isSaving,
  fieldErrors,
  titleInputRef,
  onSave,
  onCancel,
}: NoteEditorProps) {
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)

  useEffect(() => {
    setTitle(initialTitle)
    setBody(initialBody)
  }, [initialTitle, initialBody])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSave(title, body)
  }

  return (
    <form className="note-editor" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="note-title">Title</label>
        <input
          id="note-title"
          type="text"
          ref={titleInputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={fieldErrors.title ? 'note-title-error' : undefined}
        />
        {fieldErrors.title ? (
          <p className="field-error" id="note-title-error">
            {fieldErrors.title}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="note-body">Body</label>
        <textarea
          id="note-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={12}
          aria-invalid={Boolean(fieldErrors.body)}
          aria-describedby={fieldErrors.body ? 'note-body-error' : undefined}
        />
        {fieldErrors.body ? (
          <p className="field-error" id="note-body-error">
            {fieldErrors.body}
          </p>
        ) : null}
      </div>

      <div className="editor-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
