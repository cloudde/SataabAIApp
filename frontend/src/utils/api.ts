export const API_BASE = '/app'

export interface Document {
  document_id: string
  filename: string
  chunk_count: number
  char_count: number
  analytics?: Analytics | null
}

export interface Analytics {
  sentiment: {
    score: number       // -1 to 1
    label: string       // Positive | Neutral | Negative
    subjectivity: number
    confidence: number
  }
  readability: {
    flesch_reading_ease: number
    flesch_kincaid_grade: number
    gunning_fog: number
    level: string
    avg_sentence_length: number
    avg_syllables_per_word: number
    complex_word_ratio: number
  }
  word_stats: {
    total_words: number
    unique_words: number
    unique_ratio: number
    top_words: { word: string; count: number }[]
  }
  sentence_sentiments: { text: string; score: number; label: string }[]
}

export interface ChatSource {
  source: string
  score: number
  document_id: string
  preview: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  streaming?: boolean
  timestamp: Date
}

export async function uploadDocument(file: File, onProgress?: (p: number) => void): Promise<{ document_id: string; filename: string; chunk_count: number; analytics: Analytics }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/documents/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`)
  return res.json()
}

export async function listDocuments(): Promise<Document[]> {
  const res = await fetch(`${API_BASE}/documents`)
  if (!res.ok) throw new Error('Failed to list documents')
  const data = await res.json()
  return data.documents
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
}

export async function analyzeText(text: string): Promise<Analytics> {
  const res = await fetch(`${API_BASE}/analytics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error('Analysis failed')
  return res.json()
}

export async function* streamChat(
  message: string,
  documentIds?: string[],
  conversationId?: string
): AsyncGenerator<{ type: string; content?: string; sources?: ChatSource[]; conversation_id?: string }> {
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, document_ids: documentIds, conversation_id: conversationId }),
  })
  if (!res.ok) throw new Error('Chat request failed')

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') return
        try {
          yield JSON.parse(data)
        } catch { /* skip malformed */ }
      }
    }
  }
}
