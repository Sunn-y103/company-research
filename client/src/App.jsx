import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Hexagon, Search, AlertCircle, FileText, Target, Package, Zap, Sparkles, Lightbulb, Swords, Link as LinkIcon, Globe, Download, MapPin, Phone, CheckCircle2, ChevronRight, Loader2, ChevronDown, Check } from 'lucide-react'
import * as RadixSelect from '@radix-ui/react-select'
import apiClient from './api/client'
import './App.css'

// ── Model Select (Radix UI) ───────────────────────────────────────────────────
function ModelSelect({ models, value, onChange, disabled }) {
  const selected = models.find((m) => m.id === value)
  return (
    <RadixSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
      <RadixSelect.Trigger
        id="model-select"
        className="model-select-trigger"
        aria-label="AI Model"
      >
        <RadixSelect.Value asChild>
          <span className="model-select-value">
            {selected ? (
              <>
                <span className="model-select-label">{selected.label}</span>
                {selected.description && (
                  <span className="model-select-desc"> — {selected.description}</span>
                )}
              </>
            ) : (
              'Select model…'
            )}
          </span>
        </RadixSelect.Value>
        <RadixSelect.Icon className="model-select-icon">
          <ChevronDown size={14} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          className="model-select-content"
          position="popper"
          sideOffset={6}
          avoidCollisions
        >
          <RadixSelect.Viewport className="model-select-viewport">
            {models.map((m) => (
              <RadixSelect.Item
                key={m.id}
                value={m.id}
                className="model-select-item"
              >
                <RadixSelect.ItemText asChild>
                  <span>
                    <span className="model-item-label">{m.label}</span>
                    {m.description && (
                      <span className="model-item-desc"> — {m.description}</span>
                    )}
                  </span>
                </RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="model-item-check">
                  <Check size={13} />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    ok: { color: '#00D084', label: 'Backend Online' },
    error: { color: '#FF4D67', label: 'Backend Offline' },
    loading: { color: '#f59e0b', label: 'Connecting…' },
  }
  const { color, label } = map[status] ?? map.loading
  return (
    <span className="status-badge" style={{ '--dot': color }}>
      <span className="status-dot" />
      {label}
    </span>
  )
}

// ── Source card ───────────────────────────────────────────────────────────────
function SourceCard({ source, index }) {
  return (
    <a href={source.link} target="_blank" rel="noopener noreferrer" className="source-card">
      <span className="source-index">{index + 1}</span>
      <div className="source-body">
        <p className="source-title">{source.title}</p>
        <p className="source-snippet">{source.snippet}</p>
        <p className="source-link">{source.link}</p>
      </div>
    </a>
  )
}

// ── Competitor card ───────────────────────────────────────────────────────────
function CompetitorCard({ competitor, index }) {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']
  const color = colors[index % colors.length]
  return (
    <div className="competitor-card">
      <div className="competitor-avatar" style={{ '--c': color }}>
        {competitor.name.charAt(0).toUpperCase()}
      </div>
      <div className="competitor-body">
        <p className="competitor-name">
          {competitor.website
            ? <a href={competitor.website.startsWith('http') ? competitor.website : `https://${competitor.website}`}
              target="_blank" rel="noopener noreferrer">{competitor.name}</a>
            : competitor.name}
        </p>
        <p className="competitor-desc">{competitor.description}</p>
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [query, setQuery] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [models, setModels] = useState([])
  const [backendStatus, setBackendStatus] = useState('loading')
  const [loading, setLoading] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  // ── Fetch health + model list on mount ────────────────────────────────────
  useEffect(() => {
    apiClient.get('/health')
      .then(() => setBackendStatus('ok'))
      .catch(() => setBackendStatus('error'))

    apiClient.get('/models')
      .then(({ data }) => {
        setModels(data.models ?? [])
        setSelectedModel(data.default ?? '')
      })
      .catch(() => {/* models list unavailable — selector stays empty */ })
  }, [])

  // ── Research handler ──────────────────────────────────────────────────────
  const handleResearch = useCallback(async (e) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return

    setLoading(true)
    setError('')
    setReport(null)
    setProgressMsg('Initializing research...')

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, model: selectedModel || undefined }),
      })

      if (!response.ok) {
        let errText = 'Failed to fetch report';
        try {
          const errData = await response.json();
          errText = errData.error || errText;
        } catch (e) { }
        throw new Error(errText);
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let finalResult = null

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            if (data.status) setProgressMsg(data.status)
            if (data.result) finalResult = data.result
            if (data.error) throw new Error(data.error)
          } catch (e) {
            // ignore parse errors for partial chunks
          }
        }
      }

      setReport(finalResult)
    } catch (err) {
      setError(err.message || 'Research failed. Is the server running?')
    } finally {
      setLoading(false)
      setProgressMsg('')
    }
  }, [query, selectedModel])

  // ── PDF download handler ──────────────────────────────────────────────────
  const handleDownloadPdf = useCallback(async () => {
    if (!report) return
    setPdfLoading(true)
    try {
      const response = await apiClient.post('/pdf', report, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${report.companyName.replace(/\s+/g, '_')}_research.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('PDF generation failed. Please try again.')
    } finally {
      setPdfLoading(false)
    }
  }, [report])

  return (
    <div className="app">
      {/* ── Video Background ── */}
      <div className="video-background-container">
        <video autoPlay loop muted playsInline className="video-background">
          <source src="/videos/background.mp4" type="video/mp4" />
        </video>
        <div className="video-overlay" />
      </div>

      {/* ── Header ── */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <Hexagon className="logo-icon" size={24} />
            <span className="logo-text">Research AI</span>
          </div>
          <StatusBadge status={backendStatus} />
        </div>
      </header>

      <main className="main">
        {/* ── Hero ── */}
        <section className="hero">
          <h1 className="hero-title">
            Research any company,<br />
            <span className="gradient-text">Powered by AI</span>
          </h1>
          <p className="hero-sub">
            Enter any company name to get an instant research report — executive
            summary, products, pain points, competitors, and sourced references.
          </p>

          {/* ── Search form ── */}
          <form className="search-form" onSubmit={handleResearch} id="research-form">
            <div className="search-row">
              <Search size={20} style={{ color: 'var(--text-muted)' }} />
              <input
                id="company-query"
                type="text"
                className="search-input"
                placeholder="Search for a company..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
                autoFocus
              />
              <button
                id="research-btn"
                type="submit"
                className="btn btn-primary"
                disabled={loading || !query.trim()}
              >
                {loading ? <><Loader2 className="spinner-icon" size={18} /> Researching…</> : <>Research <ChevronRight size={18} /></>}
              </button>
            </div>

            {/* ── Model selector ── */}
            {models.length > 0 && (
              <div className="model-row">
                <label className="model-label" htmlFor="model-select">AI Model</label>
                <ModelSelect
                  models={models}
                  value={selectedModel}
                  onChange={setSelectedModel}
                  disabled={loading}
                />
              </div>
            )}
          </form>

          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="error-box" role="alert">
              <AlertCircle size={18} /> {error}
            </motion.div>
          )}

          {/* ── Feature Cards (Static) ── */}
          {!report && !loading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="hero-features">
              <div className="hero-feature">
                <div className="hf-icon"><Search size={20} /></div>
                <div>
                  <h4>Instant Discovery</h4>
                  <p>Gather comprehensive data on any public company effortlessly.</p>
                </div>
              </div>
              <div className="hero-feature">
                <div className="hf-icon"><Zap size={20} /></div>
                <div>
                  <h4>AI Summarization</h4>
                  <p>Leverage cutting-edge models to extract the most critical insights.</p>
                </div>
              </div>
              <div className="hero-feature">
                <div className="hf-icon"><Target size={20} /></div>
                <div>
                  <h4>SWOT & Competitors</h4>
                  <p>Automatically identify strengths, weaknesses, and key rivals.</p>
                </div>
              </div>
              <div className="hero-feature">
                <div className="hf-icon"><Download size={20} /></div>
                <div>
                  <h4>Export Ready</h4>
                  <p>Download clean, professional PDF reports for your meetings.</p>
                </div>
              </div>
            </motion.div>
          )}
        </section>

        {/* ── Loading skeleton ── */}
        {loading && (
          <section className="skeleton-section">
            <div className="progress-msg">
              <Loader2 className="spinner-icon" size={20} /> {progressMsg}
            </div>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-line wide" />
                <div className="skeleton-line" />
                <div className="skeleton-line narrow" />
              </div>
            ))}
          </section>
        )}

        {/* ── Report ── */}
        {report && !loading && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="report" id="report-section"
          >
            {/* ── Report header ── */}
            <div className="report-header">
              <div>
                <h2 className="report-company">{report.companyName}</h2>
                <div className="report-meta">
                  {report.industry && <span className="tag">{report.industry}</span>}
                  {report.founded && <span className="tag">Founded {report.founded}</span>}
                  {report.headquarters && <span className="tag"><MapPin size={12} /> {report.headquarters}</span>}
                  {report.officialWebsite && (
                    <a className="tag tag-link" href={report.officialWebsite} target="_blank" rel="noopener noreferrer">
                      <Globe size={12} /> Website <ChevronRight size={12} />
                    </a>
                  )}
                  {report.phone && <span className="tag"><Phone size={12} /> {report.phone}</span>}
                  {report._model && <span className="tag tag-model">⚙ {report._model.split('/')[1]?.replace(/:.*/, '') ?? report._model}</span>}
                  {report.mock && <span className="tag tag-mock">🧪 Mock</span>}
                </div>
              </div>
              <button
                id="download-pdf-btn"
                className="btn btn-outline"
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
              >
                {pdfLoading ? <><Loader2 className="spinner-icon" size={18} /> Generating…</> : <><Download size={18} /> Download PDF</>}
              </button>
            </div>

            <div className="report-grid">
              {/* ── Executive Summary ── */}
              {report.summary && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="card card-full stagger-1">
                  <h3 className="card-title"><span className="card-icon"><FileText size={16} /></span> Executive Summary</h3>
                  <p className="card-text">{report.summary}</p>
                </motion.div>
              )}

              {/* ── SWOT Analysis ── */}
              {report.swot && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="card card-full stagger-2 swot-card">
                  <h3 className="card-title"><span className="card-icon"><Target size={16} /></span> SWOT Analysis</h3>
                  <div className="swot-grid">
                    <div className="swot-box strength">
                      <h4>Strengths</h4>
                      <ul>{report.swot.strengths?.map((s, i) => <li key={i}>{s}</li>) || <li>None found</li>}</ul>
                    </div>
                    <div className="swot-box weakness">
                      <h4>Weaknesses</h4>
                      <ul>{report.swot.weaknesses?.map((w, i) => <li key={i}>{w}</li>) || <li>None found</li>}</ul>
                    </div>
                    <div className="swot-box opportunity">
                      <h4>Opportunities</h4>
                      <ul>{report.swot.opportunities?.map((o, i) => <li key={i}>{o}</li>) || <li>None found</li>}</ul>
                    </div>
                    <div className="swot-box threat">
                      <h4>Threats</h4>
                      <ul>{report.swot.threats?.map((t, i) => <li key={i}>{t}</li>) || <li>None found</li>}</ul>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Products & Services ── */}
              {report.productsServices?.length > 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="card">
                  <h3 className="card-title"><span className="card-icon"><Package size={16} /></span> Products &amp; Services</h3>
                  <ul className="product-list">
                    {report.productsServices.map((p, i) => (
                      <li key={i} className="product-item">
                        <span className="product-name">{p.name}</span>
                        <span className="product-desc">{p.description}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* ── Pain Points ── */}
              {report.painPoints?.length > 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="card">
                  <h3 className="card-title"><span className="card-icon"><Zap size={16} /></span> Pain Points</h3>
                  <ul className="point-list">
                    {report.painPoints.map((pt, i) => (
                      <li key={i} className="point-item">
                        <span className="point-bullet pain"><AlertCircle size={12} /></span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* ── Key Highlights ── */}
              {report.keyPoints?.length > 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="card">
                  <h3 className="card-title"><span className="card-icon"><Sparkles size={16} /></span> Key Highlights</h3>
                  <ul className="point-list">
                    {report.keyPoints.map((pt, i) => (
                      <li key={i} className="point-item">
                        <span className="point-bullet">{i + 1}</span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* ── Recommendations ── */}
              {report.recommendations?.length > 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="card">
                  <h3 className="card-title"><span className="card-icon"><Lightbulb size={16} /></span> Recommendations</h3>
                  <ul className="point-list">
                    {report.recommendations.map((rec, i) => (
                      <li key={i} className="point-item">
                        <span className="point-bullet rec"><ChevronRight size={12} /></span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* ── Competitors ── */}
              {report.competitors?.length > 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="card card-full">
                  <h3 className="card-title"><span className="card-icon"><Swords size={16} /></span> Competitors</h3>
                  <div className="competitors-grid">
                    {report.competitors.map((c, i) => (
                      <CompetitorCard key={i} competitor={c} index={i} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Sources ── */}
              {report.sources?.length > 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="card card-full">
                  <h3 className="card-title"><span className="card-icon"><LinkIcon size={16} /></span> Sources</h3>
                  <div className="sources-grid">
                    {report.sources.slice(0, 6).map((src, i) => (
                      <SourceCard key={i} source={src} index={i} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Crawled pages ── */}
              {report.crawledPages?.length > 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="card card-full">
                  <h3 className="card-title"><span className="card-icon"><Globe size={16} /></span> Pages Crawled</h3>
                  <div className="crawled-grid">
                    {report.crawledPages.map((pg, i) => (
                      <a key={i} href={pg.url} target="_blank" rel="noopener noreferrer" className="crawled-pill">
                        <span className="crawled-path">{pg.path}</span>
                        <span className="crawled-title">{pg.title}</span>
                      </a>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            <p className="report-timestamp">
              Report generated: {new Date(report.timestamp).toLocaleString()}
            </p>
          </motion.section>
        )}
      </main>

      <footer className="footer">
        <p>Company Research Assistant • Version 1.0.0 © 2026 Swarnadeep Singh. All Rights Reserved.</p>
      </footer>
    </div>
  )
}
