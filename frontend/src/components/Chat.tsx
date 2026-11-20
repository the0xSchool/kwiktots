import { useEffect, useRef, useState, type FormEvent } from 'react'
import { sendChat } from '../api'

interface Message {
  from: 'me' | 'assistant'
  text: string
}

export function Chat() {
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
      <h2 id="chat-title">Assistant</h2>
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
    </section>
  )
}
