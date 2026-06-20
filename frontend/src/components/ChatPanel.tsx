import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Send, Bot, User, BookOpen, Zap } from 'lucide-react'
import type { ChatMessage, ChatSource } from '../utils/api'

interface Props {
  messages: ChatMessage[]
  loading: boolean
  onSend: (msg: string) => void
  selectedDocCount: number
}

export default function ChatPanel({ messages, loading, onSend, selectedDocCount }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return
    onSend(trimmed)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const t = e.target
    t.style.height = 'auto'
    t.style.height = Math.min(t.scrollHeight, 120) + 'px'
  }

  return (
    <div style={styles.container}>
      {/* Messages */}
      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}><Bot size={28} style={{ color: 'var(--indigo)' }} /></div>
            <h2 style={styles.emptyTitle}>SataabAI RAG Chat</h2>
            <p style={styles.emptyHint}>Select documents from the left panel, then ask anything grounded in their content.</p>
            <div style={styles.suggestionsGrid}>
              {SUGGESTIONS.map(s => (
                <button key={s} style={styles.suggestion} onClick={() => onSend(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {loading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div style={styles.thinking} className="animate-fade-in">
            <div style={styles.thinkingAvatar}><Bot size={14} style={{ color: 'var(--indigo)' }} /></div>
            <div style={styles.thinkingDots}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ ...styles.dot, animationDelay: `${i * 0.2}s` }} className="animate-pulse" />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={styles.inputArea}>
        {selectedDocCount === 0 && (
          <div style={styles.warning}>
            <BookOpen size={12} style={{ color: 'var(--amber)', flexShrink: 0 }} />
            <span>Select documents to ground the AI in your content</span>
          </div>
        )}
        <div style={styles.inputRow}>
          <textarea
            ref={textareaRef}
            style={styles.textarea}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={selectedDocCount > 0 ? `Ask about your ${selectedDocCount} document${selectedDocCount > 1 ? 's' : ''}…` : 'Ask a question…'}
            rows={1}
            disabled={loading}
            aria-label="Chat message"
          />
          <button
            style={{ ...styles.sendBtn, ...((!input.trim() || loading) ? styles.sendBtnDisabled : {}) }}
            onClick={handleSend}
            disabled={!input.trim() || loading}
            aria-label="Send message"
          >
            {loading ? <Zap size={16} style={{ animation: 'pulse 1s ease-in-out infinite' }} /> : <Send size={16} />}
          </button>
        </div>
        <p style={styles.hint}>Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const [showSources, setShowSources] = useState(false)

  return (
    <div style={{ ...styles.bubble, ...(isUser ? styles.bubbleUser : styles.bubbleAI) }} className="animate-fade-in">
      <div style={styles.bubbleHeader}>
        <div style={isUser ? styles.userAvatar : styles.aiAvatar}>
          {isUser ? <User size={12} /> : <Bot size={12} />}
        </div>
        <span style={styles.roleLabel}>{isUser ? 'You' : 'DocMind'}</span>
        <span style={styles.timestamp}>{formatTime(message.timestamp)}</span>
      </div>

      <div style={styles.bubbleContent}>
        {isUser ? (
          <p style={styles.userText}>{message.content}</p>
        ) : (
          <div className="markdown">
            <ReactMarkdown>{message.content || (message.streaming ? '▍' : '')}</ReactMarkdown>
          </div>
        )}
      </div>

      {message.sources && message.sources.length > 0 && (
        <div style={styles.sources}>
          <button style={styles.sourcesToggle} onClick={() => setShowSources(v => !v)}>
            <BookOpen size={11} />
            <span>{message.sources.length} source{message.sources.length > 1 ? 's' : ''} used</span>
            <span>{showSources ? '▴' : '▾'}</span>
          </button>
          {showSources && (
            <div style={styles.sourcesList} className="animate-fade-in">
              {message.sources.map((src, i) => (
                <SourceCard key={i} source={src} index={i + 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SourceCard({ source, index }: { source: ChatSource; index: number }) {
  const pct = Math.round(source.score * 100)
  return (
    <div style={styles.sourceCard}>
      <div style={styles.sourceCardHeader}>
        <span style={styles.sourceIndex}>[{index}]</span>
        <span style={styles.sourceName}>{source.source}</span>
        <div style={styles.scoreBar}>
          <div style={{ ...styles.scoreFill, width: `${pct}%` }} />
        </div>
        <span style={styles.scoreText}>{pct}%</span>
      </div>
      <p style={styles.sourcePreview}>{source.preview}</p>
    </div>
  )
}

const SUGGESTIONS = [
  'Summarize the key points',
  'What are the main themes?',
  'List any action items or recommendations',
  'What questions does this raise?',
]

const formatTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  messages: { flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '40px 20px', textAlign: 'center' },
  emptyIcon: { width: 56, height: 56, borderRadius: '50%', background: 'var(--indigo-glow)', border: '1px solid var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' },
  emptyHint: { color: 'var(--text-muted)', fontSize: 13, maxWidth: 360 },
  suggestionsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 480, marginTop: 8 },
  suggestion: { background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', borderRadius: 'var(--radius-md)', padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: 'var(--font-body)' },
  thinking: { display: 'flex', alignItems: 'center', gap: 10 },
  thinkingAvatar: { width: 28, height: 28, borderRadius: '50%', background: 'var(--indigo-glow)', border: '1px solid var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  thinkingDots: { display: 'flex', gap: 4, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--indigo-bright)', display: 'inline-block' },
  bubble: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: '88%', padding: '12px 16px', borderRadius: 'var(--radius-lg)' },
  bubbleUser: { alignSelf: 'flex-end', background: 'var(--indigo)', borderBottomRightRadius: 4 },
  bubbleAI: { alignSelf: 'flex-start', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderBottomLeftRadius: 4 },
  bubbleHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  userAvatar: { width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  aiAvatar: { width: 20, height: 20, borderRadius: '50%', background: 'var(--indigo-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  roleLabel: { fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  timestamp: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 'auto' },
  bubbleContent: { fontSize: 13.5, lineHeight: 1.65 },
  userText: { color: 'rgba(255,255,255,0.93)' },
  sources: { borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 },
  sourcesToggle: { display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--indigo-bright)', fontSize: 11, cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' },
  sourcesList: { display: 'flex', flexDirection: 'column', gap: 6 },
  sourceCard: { background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 },
  sourceCardHeader: { display: 'flex', alignItems: 'center', gap: 6 },
  sourceIndex: { fontSize: 10, color: 'var(--indigo-bright)', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0 },
  sourceName: { fontSize: 11, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  scoreBar: { width: 40, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', flexShrink: 0 },
  scoreFill: { height: '100%', background: 'var(--indigo)', borderRadius: 99 },
  scoreText: { fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 },
  sourcePreview: { fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  inputArea: { padding: '12px 16px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 },
  warning: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--amber)' },
  inputRow: { display: 'flex', alignItems: 'flex-end', gap: 10 },
  textarea: {
    flex: 1, background: 'var(--bg-elevated)', border: '1.5px solid var(--border-bright)', borderRadius: 'var(--radius-lg)',
    padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13.5, fontFamily: 'var(--font-body)',
    resize: 'none', outline: 'none', lineHeight: 1.5, minHeight: 42, transition: 'border-color 0.15s',
  },
  sendBtn: { width: 42, height: 42, borderRadius: '50%', background: 'var(--indigo)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', flexShrink: 0, transition: 'all 0.15s' },
  sendBtnDisabled: { background: 'var(--bg-elevated)', color: 'var(--text-muted)', cursor: 'not-allowed' },
  hint: { fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' },
}
