import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, AlertTriangle, X, Layers } from 'lucide-react'
import DocumentPanel from './components/DocumentPanel'
import ChatPanel from './components/ChatPanel'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import { uploadDocument, listDocuments, deleteDocument, streamChat } from './utils/api'
import type { Document, ChatMessage, Analytics } from './utils/api'

type Panel = 'documents' | 'analytics'

export default function App() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeAnalytics, setActiveAnalytics] = useState<Analytics | null>(null)
  const [leftPanel, setLeftPanel] = useState<Panel>('documents')
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const abortRef = useRef<boolean>(false)

  // Load documents on mount
  useEffect(() => {
    listDocuments()
      .then(docs => {
        setDocuments(docs)
        if (docs.length > 0) setSelectedIds(docs.map(d => d.document_id))
      })
      .catch(() => { /* backend not running yet */ })
  }, [])

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const result = await uploadDocument(file)
      const newDoc: Document = {
        document_id: result.document_id,
        filename: result.filename,
        chunk_count: result.chunk_count,
        char_count: 0,
        analytics: result.analytics,
      }
      setDocuments(prev => [...prev, newDoc])
      setSelectedIds(prev => [...prev, result.document_id])
      if (result.analytics) {
        setActiveAnalytics(result.analytics)
        setLeftPanel('analytics')
        setTimeout(() => setLeftPanel('documents'), 1800)
      }
    } catch (e: any) {
      setError(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteDocument(id)
      setDocuments(prev => prev.filter(d => d.document_id !== id))
      setSelectedIds(prev => prev.filter(s => s !== id))
    } catch (e: any) {
      setError(e.message || 'Delete failed')
    }
  }, [])

  const handleSend = useCallback(async (text: string) => {
    if (chatLoading) return
    setError(null)
    abortRef.current = false

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    const aiId = (Date.now() + 1).toString()
    const aiMsg: ChatMessage = {
      id: aiId,
      role: 'assistant',
      content: '',
      streaming: true,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg, aiMsg])
    setChatLoading(true)

    try {
      let convId = conversationId
      for await (const chunk of streamChat(text, selectedIds.length > 0 ? selectedIds : undefined, convId)) {
        if (abortRef.current) break

        if (chunk.type === 'sources') {
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, sources: chunk.sources } : m))
        } else if (chunk.type === 'token') {
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: m.content + (chunk.content || '') } : m))
        } else if (chunk.type === 'done') {
          convId = chunk.conversation_id
          setConversationId(chunk.conversation_id)
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, streaming: false } : m))
        } else if (chunk.type === 'error') {
          setError(chunk.content || 'Stream error')
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: '⚠️ Error generating response.', streaming: false } : m))
        }
      }
    } catch (e: any) {
      setError(e.message || 'Chat failed')
      setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: '⚠️ Failed to connect to the backend.', streaming: false } : m))
    } finally {
      setChatLoading(false)
      setMessages(prev => prev.map(m => m.id === aiId ? { ...m, streaming: false } : m))
    }
  }, [chatLoading, selectedIds, conversationId])

  // When user selects a doc that has analytics, show them
  useEffect(() => {
    if (selectedIds.length === 1) {
      const doc = documents.find(d => d.document_id === selectedIds[0])
      if (doc?.analytics) setActiveAnalytics(doc.analytics)
    } else if (selectedIds.length === 0) {
      setActiveAnalytics(null)
    }
  }, [selectedIds, documents])

  return (
    <div style={layout.root}>
      {/* Header */}
      <header style={layout.header}>
        <div style={layout.logo}>
          <div style={layout.logoIcon}><Bot size={18} style={{ color: 'white' }} /></div>
          <span style={layout.logoText}>SataabAI</span>
          <span style={layout.logoBadge}>RAG</span>
        </div>
        <div style={layout.headerCenter}>
          {selectedIds.length > 0 && (
            <div style={layout.contextPill}>
              <Layers size={12} style={{ color: 'var(--indigo)' }} />
              <span>{selectedIds.length} doc{selectedIds.length > 1 ? 's' : ''} in context</span>
            </div>
          )}
        </div>
        <div style={layout.headerRight}>
          <div style={layout.statusDot} title="Backend status" />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>FastAPI · Pinecone · GPT-4o</span>
        </div>
      </header>

      {/* Error toast */}
      {error && (
        <div style={layout.error} className="animate-fade-in">
          <AlertTriangle size={14} style={{ color: 'var(--rose)', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Body */}
      <div style={layout.body}>
        {/* Left sidebar */}
        <aside style={layout.sidebar}>
          <div style={layout.sidebarTabs}>
            <button
              style={{ ...layout.sidebarTab, ...(leftPanel === 'documents' ? layout.sidebarTabActive : {}) }}
              onClick={() => setLeftPanel('documents')}
            >
              Documents
            </button>
            <button
              style={{ ...layout.sidebarTab, ...(leftPanel === 'analytics' ? layout.sidebarTabActive : {}) }}
              onClick={() => setLeftPanel('analytics')}
            >
              Analytics
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {leftPanel === 'documents' ? (
              <DocumentPanel
                documents={documents}
                selectedIds={selectedIds}
                onSelect={setSelectedIds}
                onUpload={handleUpload}
                onDelete={handleDelete}
                uploading={uploading}
              />
            ) : (
              <AnalyticsDashboard documents={documents} activeAnalytics={activeAnalytics} />
            )}
          </div>
        </aside>

        {/* Main chat */}
        <main style={layout.main}>
          <ChatPanel
            messages={messages}
            loading={chatLoading}
            onSend={handleSend}
            selectedDocCount={selectedIds.length}
          />
        </main>
      </div>
    </div>
  )
}

const layout: Record<string, React.CSSProperties> = {
  root: { height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' },
  header: {
    height: 52, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16,
    borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  logoIcon: { width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px var(--indigo-glow)' },
  logoText: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.02em' },
  logoBadge: { fontSize: 10, fontWeight: 700, padding: '2px 6px', background: 'var(--indigo-glow)', color: 'var(--indigo-bright)', borderRadius: 4, border: '1px solid var(--indigo)', letterSpacing: '0.08em' },
  headerCenter: { flex: 1, display: 'flex', justifyContent: 'center' },
  contextPill: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'var(--indigo-glow)', border: '1px solid var(--indigo)', borderRadius: 99, fontSize: 11, color: 'var(--indigo-bright)', fontWeight: 500 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  statusDot: { width: 7, height: 7, borderRadius: '50%', background: 'var(--emerald)', boxShadow: '0 0 6px var(--emerald)' },
  error: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'var(--rose-dim)', borderBottom: '1px solid rgba(244,63,94,0.2)', fontSize: 12, color: 'var(--rose)', flexShrink: 0 },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  sidebar: { width: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', flexShrink: 0, overflow: 'hidden' },
  sidebarTabs: { display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  sidebarTab: { flex: 1, padding: '10px 0', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s', borderBottom: '2px solid transparent' },
  sidebarTabActive: { color: 'var(--indigo-bright)', borderBottom: '2px solid var(--indigo)', background: 'var(--bg-elevated)' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
}
