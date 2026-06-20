import React, { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts'
import { Activity, BarChart2, BookOpen, Hash, TrendingUp } from 'lucide-react'
import type { Analytics, Document } from '../utils/api'

interface Props {
  documents: Document[]
  activeAnalytics: Analytics | null
}

type Tab = 'sentiment' | 'readability' | 'vocabulary' | 'sentences'

export default function AnalyticsDashboard({ documents, activeAnalytics }: Props) {
  const [tab, setTab] = useState<Tab>('sentiment')

  const analytics = activeAnalytics

  if (!analytics) {
    return (
      <div style={styles.empty}>
        <Activity size={28} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
          Upload a document to see real-time analytics
        </p>
      </div>
    )
  }

  const { sentiment, readability, word_stats, sentence_sentiments } = analytics

  return (
    <div style={styles.container}>
      {/* Tab nav */}
      <div style={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }}
            onClick={() => setTab(t.id as Tab)}
          >
            <t.Icon size={12} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {tab === 'sentiment' && <SentimentTab sentiment={sentiment} />}
        {tab === 'readability' && <ReadabilityTab readability={readability} />}
        {tab === 'vocabulary' && <VocabularyTab word_stats={word_stats} />}
        {tab === 'sentences' && <SentencesTab sentences={sentence_sentiments} />}
      </div>
    </div>
  )
}

/* ─── Sentiment ─── */
function SentimentTab({ sentiment }: { sentiment: Analytics['sentiment'] }) {
  const score01 = (sentiment.score + 1) / 2  // normalize to 0–1 for radial
  const color = sentiment.score > 0.15 ? '#10b981' : sentiment.score < -0.15 ? '#f43f5e' : '#f59e0b'

  const radialData = [{ value: Math.round(score01 * 100), fill: color }]

  return (
    <div style={styles.tabContent}>
      <div style={styles.row}>
        {/* Gauge */}
        <div style={styles.card}>
          <span style={styles.cardLabel}>Overall Sentiment</span>
          <div style={{ position: 'relative', width: '100%', height: 130 }}>
            <ResponsiveContainer width="100%" height={130}>
              <RadialBarChart innerRadius="65%" outerRadius="90%" data={radialData} startAngle={210} endAngle={-30} cx="50%" cy="65%">
                <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#1e2130' }}>
                  {radialData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </RadialBar>
              </RadialBarChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color }}>{sentiment.label}</span>
            </div>
          </div>
          <ScoreBar value={sentiment.score} min={-1} max={1} label={`Score: ${sentiment.score > 0 ? '+' : ''}${sentiment.score.toFixed(2)}`} color={color} />
        </div>

        {/* Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <MetricTile label="Confidence" value={`${(sentiment.confidence * 100).toFixed(0)}%`} sub="model certainty" color="var(--indigo)" />
          <MetricTile label="Subjectivity" value={`${(sentiment.subjectivity * 100).toFixed(0)}%`} sub="opinion density" color="var(--amber)" />
          <MetricTile label="Polarity" value={sentiment.score > 0 ? '+' + sentiment.score.toFixed(3) : sentiment.score.toFixed(3)} sub="−1 to +1 scale" color={color} />
        </div>
      </div>
    </div>
  )
}

/* ─── Readability ─── */
function ReadabilityTab({ readability }: { readability: Analytics['readability'] }) {
  const barData = [
    { name: 'Flesch RE', value: readability.flesch_reading_ease, fill: '#6366f1', max: 100 },
    { name: 'FK Grade', value: readability.flesch_kincaid_grade, fill: '#f59e0b', max: 20 },
    { name: 'Fog Index', value: readability.gunning_fog, fill: '#f43f5e', max: 20 },
  ]

  return (
    <div style={styles.tabContent}>
      <div style={styles.card}>
        <span style={styles.cardLabel}>Readability Scores</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0 2px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
            {readability.level}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {barData.map(b => (
            <div key={b.name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{b.name}</span>
                <span style={{ fontSize: 11, color: b.fill, fontFamily: 'var(--font-mono)' }}>{b.value.toFixed(1)}</span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (b.value / b.max) * 100)}%`, background: b.fill, borderRadius: 99, transition: 'width 0.6s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={styles.row}>
        <MetricTile label="Avg Sentence" value={`${readability.avg_sentence_length} words`} sub="per sentence" color="var(--indigo)" />
        <MetricTile label="Complexity" value={`${(readability.complex_word_ratio * 100).toFixed(1)}%`} sub="3+ syllable words" color="var(--rose)" />
      </div>
    </div>
  )
}

/* ─── Vocabulary ─── */
function VocabularyTab({ word_stats }: { word_stats: Analytics['word_stats'] }) {
  const top8 = word_stats.top_words.slice(0, 10)
  return (
    <div style={styles.tabContent}>
      <div style={styles.row}>
        <MetricTile label="Total Words" value={word_stats.total_words.toLocaleString()} sub="in document" color="var(--indigo)" />
        <MetricTile label="Unique Words" value={word_stats.unique_words.toLocaleString()} sub="vocabulary size" color="var(--emerald)" />
        <MetricTile label="Lexical Density" value={`${(word_stats.unique_ratio * 100).toFixed(0)}%`} sub="unique/total" color="var(--amber)" />
      </div>
      <div style={styles.card}>
        <span style={styles.cardLabel}>Top Keywords</span>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={top8} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="word" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'var(--indigo-glow)' }} />
            <Bar dataKey="count" fill="var(--indigo)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ─── Sentences ─── */
function SentencesTab({ sentences }: { sentences: Analytics['sentence_sentiments'] }) {
  const data = sentences.slice(0, 30).map((s, i) => ({ idx: i + 1, score: s.score, text: s.text }))
  return (
    <div style={styles.tabContent}>
      <div style={styles.card}>
        <span style={styles.cardLabel}>Sentence-level Sentiment</span>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="idx" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} label={{ value: 'Sentence', position: 'insideBottom', fill: 'var(--text-muted)', fontSize: 9, dy: 8 }} />
            <YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, maxWidth: 240 }}
              formatter={(val: number) => [val.toFixed(3), 'Score']}
              labelFormatter={(i: number) => data[i - 1]?.text || `Sentence ${i}`}
            />
            <Line type="monotone" dataKey="score" stroke="var(--indigo-bright)" strokeWidth={1.5} dot={{ r: 2, fill: 'var(--indigo)' }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={styles.sentenceList}>
        {sentences.slice(0, 12).map((s, i) => {
          const c = s.score > 0.15 ? 'var(--emerald)' : s.score < -0.15 ? 'var(--rose)' : 'var(--text-muted)'
          return (
            <div key={i} style={styles.sentenceRow}>
              <div style={{ ...styles.sentenceDot, background: c }} />
              <span style={styles.sentenceText}>{s.text}</span>
              <span style={{ ...styles.sentenceScore, color: c }}>{s.score > 0 ? '+' : ''}{s.score.toFixed(2)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Shared sub-components ─── */
function MetricTile({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ ...styles.metricTile, borderColor: color + '44' }}>
      <span style={{ ...styles.metricValue, color }}>{value}</span>
      <span style={styles.metricLabel}>{label}</span>
      <span style={styles.metricSub}>{sub}</span>
    </div>
  )
}

function ScoreBar({ value, min, max, label, color }: { value: number; min: number; max: number; label: string; color: string }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Negative</span>
        <span style={{ fontSize: 10, color }}>{label}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Positive</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: '50%', width: 1, height: '100%', background: 'var(--border-bright)', zIndex: 1 }} />
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.6s' }} />
      </div>
    </div>
  )
}

const TABS = [
  { id: 'sentiment', label: 'Sentiment', Icon: TrendingUp },
  { id: 'readability', label: 'Readability', Icon: BookOpen },
  { id: 'vocabulary', label: 'Vocabulary', Icon: Hash },
  { id: 'sentences', label: 'Sentences', Icon: BarChart2 },
]

const styles: Record<string, React.CSSProperties> = {
  empty: { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  tabs: { display: 'flex', padding: '8px 12px 0', gap: 4, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' },
  tab: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s', borderBottom: '2px solid transparent' },
  tabActive: { color: 'var(--indigo-bright)', borderBottom: '2px solid var(--indigo)' },
  content: { flex: 1, overflowY: 'auto', padding: 12 },
  tabContent: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  card: { background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 },
  cardLabel: { fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  metricTile: { flex: 1, minWidth: 90, background: 'var(--bg-elevated)', border: '1px solid', borderRadius: 'var(--radius-md)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 },
  metricValue: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 },
  metricLabel: { fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 },
  metricSub: { fontSize: 10, color: 'var(--text-muted)' },
  sentenceList: { display: 'flex', flexDirection: 'column', gap: 4 },
  sentenceRow: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 8px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' },
  sentenceDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 4 },
  sentenceText: { flex: 1, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 },
  sentenceScore: { fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0 },
}
