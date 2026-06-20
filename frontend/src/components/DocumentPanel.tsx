import React, { useCallback, useRef, useState } from 'react'
import { Upload, FileText, Trash2, CheckCircle, AlertCircle, Loader, ChevronDown, ChevronRight } from 'lucide-react'
import type { Document } from '../utils/api'

interface Props {
  documents: Document[]
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  onUpload: (file: File) => Promise<void>
  onDelete: (id: string) => void
  uploading: boolean
}

export default function DocumentPanel({ documents, selectedIds, onSelect, onUpload, onDelete, uploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await onUpload(file)
  }, [onUpload])

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await onUpload(file)
    e.target.value = ''
  }, [onUpload])

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelect(selectedIds.filter(s => s !== id))
    } else {
      onSelect([...selectedIds, id])
    }
  }

  const selectAll = () => {
    if (selectedIds.length === documents.length) {
      onSelect([])
    } else {
      onSelect(documents.map(d => d.document_id))
    }
  }

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>Documents</span>
        {documents.length > 0 && (
          <button onClick={selectAll} style={styles.selectAllBtn}>
            {selectedIds.length === documents.length ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        style={{ ...styles.dropzone, ...(dragging ? styles.dropzoneDrag : {}) }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload document"
      >
        <input ref={inputRef} type="file" accept=".pdf,.txt,.md,.docx" style={{ display: 'none' }} onChange={handleFile} />
        {uploading ? (
          <Loader size={20} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--indigo)' }} />
        ) : (
          <Upload size={20} style={{ color: 'var(--indigo)' }} />
        )}
        <span style={styles.dropzoneText}>
          {uploading ? 'Processing…' : 'Drop PDF, TXT, MD, DOCX'}
        </span>
        <span style={styles.dropzoneHint}>or click to browse</span>
      </div>

      {/* Document list */}
      <div style={styles.list}>
        {documents.length === 0 && (
          <div style={styles.empty}>
            <FileText size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No documents yet</span>
          </div>
        )}
        {documents.map(doc => {
          const isSelected = selectedIds.includes(doc.document_id)
          const isExpanded = expanded === doc.document_id
          const sentiment = doc.analytics?.sentiment
          const readability = doc.analytics?.readability

          return (
            <div key={doc.document_id} style={{ ...styles.docItem, ...(isSelected ? styles.docItemSelected : {}) }}>
              <div style={styles.docRow} onClick={() => toggleSelect(doc.document_id)}>
                <div style={{ ...styles.checkbox, ...(isSelected ? styles.checkboxOn : {}) }}>
                  {isSelected && <CheckCircle size={12} style={{ color: 'white' }} />}
                </div>
                <div style={styles.docInfo}>
                  <span style={styles.docName} title={doc.filename}>
                    {doc.filename.length > 22 ? doc.filename.slice(0, 20) + '…' : doc.filename}
                  </span>
                  <span style={styles.docMeta}>{fmt(doc.char_count)} chars · {doc.chunk_count} chunks</span>
                </div>
                <div style={styles.docActions}>
                  {doc.analytics && (
                    <button
                      style={styles.expandBtn}
                      onClick={e => { e.stopPropagation(); setExpanded(isExpanded ? null : doc.document_id) }}
                      title="Analytics"
                      aria-label="Show analytics"
                    >
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  )}
                  <button
                    style={styles.deleteBtn}
                    onClick={e => { e.stopPropagation(); onDelete(doc.document_id) }}
                    title="Delete document"
                    aria-label={`Delete ${doc.filename}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Inline analytics preview */}
              {isExpanded && doc.analytics && (
                <div style={styles.analyticsPreview} className="animate-fade-in">
                  {sentiment && (
                    <div style={styles.analyticsRow}>
                      <SentimentBadge label={sentiment.label} score={sentiment.score} />
                      <span style={styles.analyticsLabel}>Subjectivity: {(sentiment.subjectivity * 100).toFixed(0)}%</span>
                    </div>
                  )}
                  {readability && (
                    <div style={styles.analyticsRow}>
                      <span style={styles.analyticsLabel}>Readability: <strong style={{ color: 'var(--text-primary)' }}>{readability.level}</strong></span>
                      <span style={styles.analyticsLabel}>Grade {readability.flesch_kincaid_grade}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selectedIds.length > 0 && (
        <div style={styles.footer}>
          <CheckCircle size={12} style={{ color: 'var(--indigo)' }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
            {selectedIds.length} doc{selectedIds.length > 1 ? 's' : ''} in context
          </span>
        </div>
      )}
    </div>
  )
}

function SentimentBadge({ label, score }: { label: string; score: number }) {
  const color = score > 0.15 ? 'var(--emerald)' : score < -0.15 ? 'var(--rose)' : 'var(--amber)'
  const bg = score > 0.15 ? 'var(--emerald-dim)' : score < -0.15 ? 'var(--rose-dim)' : 'var(--amber-dim)'
  return (
    <span style={{ ...styles.badge, color, background: bg }}>{label}</span>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: { display: 'flex', flexDirection: 'column', height: '100%', gap: 0 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' },
  headerTitle: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' },
  selectAllBtn: { background: 'none', border: 'none', color: 'var(--indigo-bright)', fontSize: 11, cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-body)' },
  dropzone: {
    margin: '12px', border: '1.5px dashed var(--border-bright)', borderRadius: 'var(--radius-md)',
    padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    cursor: 'pointer', transition: 'all 0.2s', background: 'transparent',
  },
  dropzoneDrag: { borderColor: 'var(--indigo)', background: 'var(--indigo-glow)' },
  dropzoneText: { fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 },
  dropzoneHint: { fontSize: 11, color: 'var(--text-muted)' },
  list: { flex: 1, overflowY: 'auto', padding: '4px 8px' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0' },
  docItem: { borderRadius: 'var(--radius-md)', marginBottom: 4, border: '1px solid transparent', transition: 'all 0.15s', overflow: 'hidden' },
  docItemSelected: { border: '1px solid var(--indigo)', background: 'var(--indigo-glow)' },
  docRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', cursor: 'pointer', borderRadius: 'var(--radius-md)' },
  checkbox: { width: 18, height: 18, borderRadius: 4, border: '1.5px solid var(--border-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' },
  checkboxOn: { background: 'var(--indigo)', borderColor: 'var(--indigo)' },
  docInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  docName: { fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  docMeta: { fontSize: 10, color: 'var(--text-muted)' },
  docActions: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  expandBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 3, borderRadius: 4, display: 'flex', alignItems: 'center', transition: 'color 0.15s' },
  deleteBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 3, borderRadius: 4, display: 'flex', alignItems: 'center', transition: 'color 0.15s' },
  analyticsPreview: { padding: '8px 10px 10px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 },
  analyticsRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  analyticsLabel: { fontSize: 11, color: 'var(--text-muted)' },
  badge: { fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.05em' },
  footer: { padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 },
}
