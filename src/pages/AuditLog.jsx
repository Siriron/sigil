import React, { useEffect, useState } from 'react'
import { useNetwork } from '../App'
import { glRead } from '../hooks/useGenLayer'
import { NETWORKS } from '../config/networks'
import { verdictPillClass, shortAddr, fmtDate, scoreColor } from '../utils'

export default function AuditLog() {
  const { network } = useNetwork()
  const addrs = NETWORKS[network].contracts

  const [entries,     setEntries]     = useState([])
  const [comparisons, setComparisons] = useState([])
  const [stats,       setStats]       = useState(null)
  const [tab,         setTab]         = useState('entries')
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      glRead(network, addrs.auditlog, 'get_entries',     [30]).then(r => JSON.parse(r)).catch(() => []),
      glRead(network, addrs.auditlog, 'get_comparisons', [10]).then(r => JSON.parse(r)).catch(() => []),
      glRead(network, addrs.auditlog, 'get_stats',       []).then(r  => JSON.parse(r)).catch(() => null),
    ]).then(([e, c, s]) => { setEntries(e); setComparisons(c); setStats(s) })
      .finally(() => setLoading(false))
  }, [network])

  return (
    <>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:'-1px', marginBottom:8 }}>Audit Log</h1>
        <p style={{ color:'var(--text-2)', fontSize:15 }}>
          Immutable onchain record of all AI verdicts. Every verification is permanent and queryable.
        </p>
      </div>

      {stats && (
        <div className="stats-bar" style={{ marginBottom: 32 }}>
          <div className="stat-card"><div className="stat-card__val">{stats.total_entries}</div><div className="stat-card__lbl">Total Entries</div></div>
          <div className="stat-card"><div className="stat-card__val" style={{ color:'var(--green)' }}>{stats.passed}</div><div className="stat-card__lbl">Passed</div></div>
          <div className="stat-card"><div className="stat-card__val" style={{ color:'var(--yellow)' }}>{stats.partial}</div><div className="stat-card__lbl">Partial</div></div>
          <div className="stat-card"><div className="stat-card__val" style={{ color:'var(--red)' }}>{stats.failed}</div><div className="stat-card__lbl">Failed</div></div>
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginBottom:24 }}>
        {['entries','comparisons'].map(t => (
          <button key={t} className={'filter-btn' + (tab === t ? ' active' : '')}
            onClick={() => setTab(t)}
            style={{ textTransform:'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : tab === 'entries' ? (
        entries.length
          ? <div className="audit-list">
              {entries.map(e => (
                <div key={e.entry_id} className="audit-entry">
                  <div className="audit-dot" style={{ background: dotColor(e.verdict) }} />
                  <div>
                    <div className="audit-project">{e.project_name}</div>
                    <div className="audit-milestone">Milestone #{e.milestone_id}: {e.milestone_title}</div>
                    <div className="audit-reasoning">{e.reasoning}</div>
                    <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>
                      {fmtDate(e.timestamp)} · {shortAddr(e.triggered_by)}
                    </div>
                  </div>
                  <div>
                    <span className={`pill pill--${verdictPillClass(e.verdict)}`}>{e.verdict}</span>
                    <div className="audit-score-val" style={{ color: scoreColor(e.score) }}>{e.score}</div>
                    <div className="audit-score-lbl">/ 100</div>
                  </div>
                </div>
              ))}
            </div>
          : <Empty text="No audit entries yet." />
      ) : (
        comparisons.length
          ? <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {comparisons.map(c => (
                <div key={c.entry_id} className="card" style={{ padding:'18px 22px' }}>
                  <div style={{ display:'flex', gap:16, alignItems:'flex-start', flexWrap:'wrap' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:6 }}>Comparison #{c.entry_id} · {fmtDate(c.timestamp)}</div>
                      <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>
                        Project A: {shortAddr(c.project_a)} — <span className={`pill pill--${verdictPillClass(c.verdict_a)}`}>{c.verdict_a}</span> ({c.score_a}/100)
                      </div>
                      <div style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>
                        Project B: {shortAddr(c.project_b)} — <span className={`pill pill--${verdictPillClass(c.verdict_b)}`}>{c.verdict_b}</span> ({c.score_b}/100)
                      </div>
                      <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.6 }}>{c.comparison_summary}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          : <Empty text="No comparisons yet." />
      )}
    </>
  )
}

function dotColor(v) {
  if (v === 'passed')  return 'var(--green)'
  if (v === 'failed')  return 'var(--red)'
  if (v === 'partial') return 'var(--yellow)'
  return 'var(--text-3)'
}

function Loader() { return <div className="loader"><div className="loader-bar" /><p>Loading...</p></div> }
function Empty({ text }) { return <div className="empty"><div className="empty__icon">◈</div><div className="empty__text">{text}</div></div> }
