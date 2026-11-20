import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { sendChat } from '../api'

interface Message {
  from: 'me' | 'assistant'
  text: string
}

// The places the Assistant can rest on a phone, where it is a bottom sheet.
// On a wide screen only 'folded' and 'default' mean anything.
export type SheetStop = 'folded' | 'default' | 'full'

interface ChatProps {
  stop: SheetStop
  onStop: (stop: SheetStop) => void
}

// Keep these in step with the phone block at the end of index.css.
const PHONE_QUERY = '(max-width: 60rem)'
const FOLDED_REM = 5.5 // the grab bar plus the title bar
const DEFAULT_REM = 32
const DRAG_THRESHOLD = 6 // px before a press becomes a drag
const FLICK_MS = 150 // how far ahead a quick flick looks

function stopHeights() {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const screen = window.innerHeight
  return {
    folded: FOLDED_REM * rem,
    default: Math.min(DEFAULT_REM * rem, screen * 0.8),
    full: screen,
  }
}

const NEXT_STOP: Record<SheetStop, SheetStop> = {
  folded: 'default',
  default: 'full',
  full: 'folded',
}

export function Chat({ stop, onStop }: ChatProps) {
  const folded = stop === 'folded'
  const [dragHeight, setDragHeight] = useState<number | undefined>(undefined)
  const paneRef = useRef<HTMLElement>(null)
  const drag = useRef<{ startY: number; startHeight: number; startTime: number; moved: boolean } | null>(null)
  const justDragged = useRef(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(false)
  const endRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const text = message.trim()
    if (!text || sending) return
    setMessage('')
    setError(false)
    setSending(true)
    setMessages((current) => [...current, { from: 'me', text }])
    try {
      const reply = await sendChat(text)
      setMessages((current) => [...current, { from: 'assistant', text: reply }])
    } catch {
      setError(true)
    } finally {
      setSending(false)
    }
  }

  // Drag the grab bar or the title bar. On release the sheet snaps to the nearest
  // stop, leaning towards where a quick flick was heading.
  function startDrag(event: PointerEvent<HTMLElement>) {
    justDragged.current = false // a new press: any earlier drag is over
    if (!window.matchMedia?.(PHONE_QUERY).matches) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if ((event.target as HTMLElement).closest('.chat-header button')) return
    drag.current = {
      startY: event.clientY,
      startHeight: paneRef.current?.getBoundingClientRect().height ?? 0,
      startTime: event.timeStamp,
      moved: false,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function heightAt(state: { startY: number; startHeight: number }, clientY: number) {
    const heights = stopHeights()
    const next = state.startHeight + (state.startY - clientY)
    return Math.min(heights.full, Math.max(heights.folded, next))
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const state = drag.current
    if (!state) return
    if (!state.moved && Math.abs(state.startY - event.clientY) < DRAG_THRESHOLD) return
    state.moved = true
    setDragHeight(heightAt(state, event.clientY))
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    const state = drag.current
    drag.current = null
    if (!state || !state.moved) return
    // A drag that began on the grab bar is followed by a click on it, which is not
    // a press. A drag on the title bar never produces one.
    justDragged.current = event.currentTarget.classList.contains('sheet-handle')
    const elapsed = Math.max(1, event.timeStamp - state.startTime)
    const velocity = (state.startY - event.clientY) / elapsed // px per ms, up is positive
    const aim = heightAt(state, event.clientY) + velocity * FLICK_MS
    const heights = stopHeights()
    const names: SheetStop[] = ['folded', 'default', 'full']
    const nearest = names.reduce((best, name) =>
      Math.abs(heights[name] - aim) < Math.abs(heights[best] - aim) ? name : best,
    )
    setDragHeight(undefined)
    onStop(nearest)
  }

  const dragProps = {
    onPointerDown: startDrag,
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  }

  return (
    <section
      className={dragHeight === undefined ? 'chat-pane' : 'chat-pane is-dragging'}
      aria-labelledby="chat-title"
      ref={paneRef}
      style={dragHeight === undefined ? undefined : { height: dragHeight }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && stop === 'full') onStop('default')
      }}
    >
      {/* Phones only: the grab bar. It is also a button, so the keyboard and
          screen readers can step the sheet through its stops. */}
      <button
        type="button"
        className="sheet-handle"
        aria-label="Resize assistant"
        aria-controls="chat-body"
        aria-expanded={!folded}
        title="Drag to resize"
        onClick={() => {
          if (justDragged.current) {
            justDragged.current = false
            return
          }
          onStop(NEXT_STOP[stop])
        }}
        {...dragProps}
      >
        <span className="sheet-grip" aria-hidden="true" />
      </button>
      <div className="chat-header" {...dragProps}>
        <h2 id="chat-title">Assistant</h2>
        {/* One button folds and unfolds the panel. Its name stays the same;
            aria-expanded says which way it is. The chevron points the way the
            panel will move. */}
        <button
          type="button"
          className="icon-button chat-toggle"
          aria-label="Assistant panel"
          aria-controls="chat-body"
          aria-expanded={!folded}
          title={folded ? 'Show assistant' : 'Hide assistant'}
          onClick={() => onStop(folded ? 'default' : 'folded')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={folded ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
          </svg>
        </button>
        {/* Full screen only: push the sheet back down to its usual height. */}
        <button
          type="button"
          className="icon-button sheet-down"
          aria-label="Shrink assistant"
          title="Shrink assistant"
          onClick={() => onStop('default')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      {/* Hidden, not removed, so the conversation is kept while folded. */}
      <div className="chat-body" id="chat-body" hidden={folded}>
        <ul className="chat-messages">
          {messages.length === 0 ? <li className="chat-empty">No messages yet</li> : null}
          {messages.map((m, i) => (
            <li key={i} className={`chat-message ${m.from}`}>
              {m.text}
            </li>
          ))}
          <li ref={endRef} aria-hidden="true" />
        </ul>
        {error ? (
          <p className="status error" role="alert">
            The assistant did not reply. Try again.
          </p>
        ) : null}
        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            aria-label="Message"
            placeholder="Message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <button type="submit" disabled={sending}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </div>
    </section>
  )
}
