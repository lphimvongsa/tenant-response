'use client'

import { useState, useRef } from 'react'
import styles from './MessageInput.module.css'

const AttachIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
)

const MicIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
)

const SendIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

type Props = {
  conversationId: string
}

export default function MessageInput({ conversationId }: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`)
      }

      setText('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    // Auto-grow textarea
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  const canSend = text.trim().length > 0 && !loading

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && (
        <p className={styles.error} role="alert">{error}</p>
      )}
      <div className={styles.bar}>
        {/* Attach */}
        <button className={styles.iconBtn} type="button" aria-label="Attach file" disabled={loading}>
          {AttachIcon}
        </button>

        {/* Input */}
        <div className={styles.inputWrap}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Your message…"
            rows={1}
            disabled={loading}
            className={styles.textarea}
            aria-label="Message"
          />
        </div>

        {/* Mic */}
        <button className={styles.iconBtn} type="button" aria-label="Voice message" disabled={loading}>
          {MicIcon}
        </button>

        {/* Send */}
        <button
          type="submit"
          disabled={!canSend}
          className={`${styles.sendBtn} ${canSend ? styles.sendBtnActive : ''}`}
          aria-label="Send message"
        >
          {loading
            ? <span className={styles.spinner} aria-hidden="true" />
            : SendIcon}
        </button>
      </div>
    </form>
  )
}
