import { useState, type FormEvent } from 'react'
import { sendChat } from '../api'

export function Chat() {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setReply(await sendChat(message))
    setMessage('')
  }

  return (
    <section className="chat-pane" aria-label="Chat">
      <form onSubmit={handleSubmit}>
        <input
          aria-label="Message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button type="submit">Send</button>
      </form>
      <p>{reply}</p>
    </section>
  )
}
