import React, { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useNetwork, useWalletCtx } from '../App'
import { useToast } from '../components/Layout'
import { glRead, glWrite, waitForReceipt, sleep } from '../hooks/useGenLayer'
import { NETWORKS } from '../config/networks'
import { verdictPillClass, shortAddr, fmtDate, scoreColor } from '../utils'

export default function Project() {
  const { address: contractAddress } = useParams()
  const { network }  = useNetwork()
  const { address: wallet, connect } = useWalletCtx()
  const toast = useToast()
  const addrs = NETWORKS[network].contracts

  const [project,    setProject]    = useState(null)
  const [milestones, setMilestones] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [busy,       setBusy]       = useState({})

  const isOwner = wallet && project &&
    wallet.toLowerCase() === (project.owner || '').toLowerCase()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [projRaw, mRaw] = await Promise.all([
        glRead(network, contractAddress, 'get_project',        []),
        glRead(network, contractAddress, 'get_all_milestones', []),
      ])
      setProject(JSON.parse(projRaw))
      setMilestones(JSON.parse(mRaw))
    } catch (err) {
      toast('Failed to load project: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [network, contractAddress])

  useEffect(() => { load() }, [load])

  const tally = milestones.reduce(
    (acc, m) => {
      if (m.last_verdict === 'passed')  acc.passed++
      if (m.last_verdict === 'partial') acc.partial++
      if (m.last_verdict === 'failed')  acc.failed++
      return acc
    },
    { passed:0, partial:0, failed:0 }
  )

  async function ensureWallet() {
    if (wallet) return wallet
    const w = await connect()
    if (!w) { toast('Connect your wallet first', 'error'); return null }
    return w
  }

  async function handleVerify(milestoneId) {
    const w = await ensureWallet()
    if (!w) return
    setBusy(b => ({ ...b, [milestoneId]: 'verifying' }))
    try {
      const txHash = await glWrite(network, w, contractAddress, 'verify', [milestoneId])
      toast('Verification tx sent — waiting for AI consensus...', '')
      await waitForReceipt(network, txHash, 120, 5000)
      toast('Verified!', 'success')
      await sleep(1200)
      load()
    } catch (err) {
      toast('Verify failed: ' + err.message, 'error')
    } finally {
      setBusy(b => ({ ...b, [milestoneId]: false }))
    }
  }

  async function handleAnalyze(milestoneId) {
    const q = prompt('What do you want to analyze about this milestone?')
    if (!q) return
    const w = await ensureWallet()
    if (!w) return
    setBusy(b => ({ ...b, [milestoneId]: 'analyzing' }))
    try {
      const txHash = await glWrite(network, w, contractAddress, 'analyze', [milestoneId, q])
      toast('Analysis tx sent — waiting...', '')
      await waitForReceipt(network, txHash, 120, 5000)
      toast('Analysis complete!', 'success')
      await sleep(1200)
      load()
    } catch (err) {
      toast('Analyze failed: ' + err.message, 'error')
    } finally {
      setBusy(b => ({ ...b, [milestoneId]: false }))
    }
  }

  async function handleFlag(milestoneId) {
    const reason = prompt('Reason for flagging?')
    if (!reason) return
    const w = await ensureWallet()
    if (!w) return
    try {
      const txHash = await glWrite(network, w, contractAddress, 'flag', [milestoneId, reason])
      toast('Flag tx sent...', '')
      await waitForReceipt(network, txHash, 60, 5000)
      toast('Milestone flagged.', 'success')
      load()
    } catch (err) {
      toast('Flag failed: ' + err.message, 'error')
    }
  }

  if (loading) return (
    <div className="loader"><div className="loader-bar" /><p>Loading project...</p></div>
  )
  if (!project) return (
    <div className="empty">
      <div className="empty__icon">◈</div>
      <div className="empty__text">Project not found.</div>
    </div>
  )

  return (
    <>
      {/* Project Hero */}
      <section className="card proj-hero">
        <div className="proj-hero__top">
          <div>
            <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:4 }}>
              {NETWORKS[network].label} ·{' '}
              <code style={{ color:'var(--accent-2)', fontSize:11 }}>
                {contractAddress}
              </code>
            </div>
            <div className="proj-hero__title">{project.project_name}</div>
            <div className="proj-hero__desc">{project.project_description}</div>
          </div>
          <div className="proj-hero__meta">
            <div className="stat-pill stat-pill--pass">
              <span className="stat-pill__val" style={{ color:'var(--green)' }}>{tally.passed}</span>
              <span className="stat-pill__lbl">Passed</span>
            </div>
            <div className="stat-pill stat-pill--warn">
              <span className="stat-pill__val" style={{ color:'var(--yellow)' }}>{tally.partial}</span>
              <span className="stat-pill__lbl">Partial</span>
            </div>
            <div className="stat-pill stat-pill--fail">
              <span className="stat-pill__val" style={{ color:'var(--red)' }}>{tally.failed}</span>
              <span className="stat-pill__lbl">Failed</span>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'var(--text-3)' }}>
            Owner: {shortAddr(project.owner)}
          </span>
          <span style={{ fontSize:12, color:'var(--text-3)' }}>
            Created: {fmtDate(project.created_at)}
          </span>
          <span style={{ fontSize:12, color:'var(--text-3)' }}>
            {project.milestone_count} milestones
          </span>
        </div>
      </section>

      {/* Milestones */}
      <section style={{ marginBottom:32 }}>
        <div className="section-hd">
          <h2 className="section-title">Milestones</h2>
          {isOwner && (
            <button className="btn btn--primary btn--sm" onClick={() => setShowModal(true)}>
              + Add Milestone
            </button>
          )}
        </div>

        {milestones.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">◈</div>
            <div className="empty__text">
              No milestones yet.{isOwner ? ' Add your first milestone.' : ''}
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {milestones.map((m, i) => (
              <MilestoneItem
                key={i} m={m} id={i}
                busy={busy[i]}
                onVerify={() => handleVerify(i)}
                onAnalyze={() => handleAnalyze(i)}
                onFlag={() => handleFlag(i)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Add Milestone Modal */}
      {showModal && (
        <AddMilestoneModal
          network={network}
          contractAddress={contractAddress}
          wallet={wallet}
          connect={connect}
          toast={toast}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load() }}
        />
      )}
    </>
  )
}

// ── Milestone Item ─────────────────────────────────────────
function MilestoneItem({ m, id, busy, onVerify, onAnalyze, onFlag }) {
  const [showReason, setShowReason] = useState(false)
  const score = parseInt(m.last_score) || 0

  return (
    <div className="milestone-item">
      <div className="milestone-item__head">
        <div className="milestone-item__title">{m.title}</div>
        <span className={`pill pill--${verdictPillClass(m.last_verdict)}`}>
          {m.last_verdict || 'pending'}
        </span>
        {m.last_verdict !== 'pending' && (
          <span style={{ fontSize:13, fontWeight:700, color: scoreColor(score) }}>
            {score}/100
          </span>
        )}
        {m.is_flagged === 'True' && (
          <span className="pill" style={{ background:'var(--red-dim)', color:'var(--red)' }}>
            ⚑ Flagged
          </span>
        )}
      </div>

      <div className="milestone-item__criteria">{m.criteria}</div>

      {m.evidence && m.evidence.length > 0 && (
        <div className="milestone-item__evidence">
          {m.evidence.map((e, i) => (
            <a
              key={i} className="evidence-tag"
              href={e.url} target="_blank" rel="noopener noreferrer"
            >
              🔗 {e.description || e.url}
            </a>
          ))}
        </div>
      )}

      <div className="milestone-item__foot">
        <span style={{ fontSize:12, color:'var(--text-3)' }}>
          Deadline: {m.deadline || '—'}
        </span>
        <span style={{ fontSize:12, color:'var(--text-3)' }}>
          Verified {m.verification_count}×
        </span>
        <div className="milestone-item__actions">
          {m.last_reasoning && (
            <button className="btn btn--ghost btn--sm" onClick={() => setShowReason(r => !r)}>
              {showReason ? 'Hide Reasoning' : 'AI Reasoning'}
            </button>
          )}
          <button
            className="btn btn--verify btn--sm"
            disabled={!!busy}
            onClick={onVerify}
          >
            {busy === 'verifying' ? 'Verifying…' : 'Verify'}
          </button>
          <button
            className="btn btn--ghost btn--sm"
            disabled={!!busy}
            onClick={onAnalyze}
          >
            {busy === 'analyzing' ? 'Analyzing…' : 'Analyze'}
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={onFlag}
            style={{ color:'var(--red)', fontSize:12 }}
          >
            ⚑
          </button>
        </div>
      </div>

      {showReason && m.last_reasoning && (
        <div className="reasoning">
          <div style={{
            fontSize:11, fontWeight:700, color:'var(--text-3)',
            textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8
          }}>
            AI Reasoning
          </div>
          {m.last_reasoning}
        </div>
      )}

      {showReason && m.snapshots && m.snapshots.length > 0 && (
        <div style={{ marginTop:12 }}>
          <div style={{
            fontSize:12, fontWeight:700, color:'var(--text-3)',
            textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8
          }}>
            History ({m.snapshots.length})
          </div>
          <div className="snap-list">
            {[...m.snapshots].reverse().map((s, i) => (
              <div key={i} className="snap-item">
                <div className={`snap-dot snap-dot--${verdictPillClass(s.verdict)}`} />
                <div>
                  <div className="snap-meta">
                    {s.verdict} · Score {s.score} · {fmtDate(s.timestamp)} · {shortAddr(s.verified_by)}
                  </div>
                  <div className="snap-text">{s.reasoning}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Add Milestone Modal ────────────────────────────────────
function AddMilestoneModal({ network, contractAddress, wallet, connect, toast, onClose, onSuccess }) {
  const [title,    setTitle]    = useState('')
  const [criteria, setCriteria] = useState('')
  const [deadline, setDeadline] = useState('')
  const [urls,     setUrls]     = useState('')
  const [descs,    setDescs]    = useState('')
  const [busy,     setBusy]     = useState(false)
  const [status,   setStatus]   = useState('')

  async function submit() {
    let w = wallet
    if (!w) {
      w = await connect()
      if (!w) { toast('Connect wallet first', 'error'); return }
    }
    if (!title.trim() || !criteria.trim()) {
      toast('Title and criteria are required', 'error')
      return
    }

    const urlList  = urls.split('\n').map(s => s.trim()).filter(Boolean)
    const descList = descs.split('\n').map(s => s.trim()).filter(Boolean)

    setBusy(true)
    setStatus('Confirm in MetaMask...')
    try {
      const txHash = await glWrite(
        network, w, contractAddress,
        'add_milestone',
        [title.trim(), criteria.trim(), deadline, urlList, descList]
      )
      setStatus('Waiting for consensus...')
      await waitForReceipt(network, txHash, 120, 5000)
      toast('Milestone added!', 'success')
      onSuccess()
    } catch (err) {
      toast('Failed: ' + err.message, 'error')
      setStatus('')
      setBusy(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-box">
        <div className="modal-title">Add Milestone</div>

        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Deploy smart contracts" disabled={busy} />
        </div>

        <div className="form-group">
          <label className="form-label">Success Criteria</label>
          <textarea className="form-textarea" rows={4} value={criteria}
            onChange={e => setCriteria(e.target.value)}
            placeholder="The GitHub repo must contain verified contract addresses..."
            disabled={busy} />
        </div>

        <div className="form-group">
          <label className="form-label">Deadline</label>
          <input className="form-input" type="date" value={deadline}
            onChange={e => setDeadline(e.target.value)} disabled={busy} />
        </div>

        <div className="form-group">
          <label className="form-label">Evidence URLs (one per line)</label>
          <textarea className="form-textarea" rows={3} value={urls}
            onChange={e => setUrls(e.target.value)}
            placeholder={'https://github.com/you/repo\nhttps://yourapp.vercel.app'}
            disabled={busy} />
          <div className="form-hint">
            These URLs will be fetched live by GenLayer AI validators during verification.
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Evidence Descriptions (one per line)</label>
          <textarea className="form-textarea" rows={2} value={descs}
            onChange={e => setDescs(e.target.value)}
            placeholder={'GitHub repository\nLive frontend'}
            disabled={busy} />
        </div>

        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy ? 'Adding...' : 'Add Milestone'}
          </button>
          {busy && <div className="spinner" />}
        </div>
        {status && (
          <p className="form-hint" style={{ marginTop:10, color:'var(--accent-2)' }}>
            {status}
          </p>
        )}
      </div>
    </div>
  )
}
