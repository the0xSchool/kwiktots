import { useEffect, useRef, useState, type FormEvent } from 'react'
import { sendChat } from '../api'

interface Message {
  from: 'me' | 'assistant'
  text: string
}

export function Chat() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const endRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const text = message.trim()
    if (!text) return
    setMessage('')
    setMessages((current) => [...current, { from: 'me', text }])
    const reply = await sendChat(text)
    setMessages((current) => [...current, { from: 'assistant', text: reply }])
  }

  return (
    <section className="chat-pane" aria-label="Chat">
      <h2>Assistant</h2>
      <ul className="chat-messages">
        {messages.map((m, i) => (
          <li key={i} className={`chat-message ${m.from}`}>
            {m.text}
          </li>
        ))}
        <li ref={endRef} aria-hidden="true" />
      </ul>
      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          aria-label="Message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </section>
  )
}
