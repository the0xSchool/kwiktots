import { useEffect, useRef, useState, type FormEvent } from 'react'
import { sendChat } from '../api'

interface Message {
  from: 'me' | 'assistant'
  text: string
}

interface ChatProps {
  folded: boolean
  onToggle: () => void
}

export function Chat({ folded, onToggle }: ChatProps) {
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

  return (
    <section className="chat-pane" aria-labelledby="chat-title">
      <div className="chat-header">
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
          onClick={onToggle}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={folded ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
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
