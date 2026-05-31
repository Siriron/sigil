import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNetwork } from '../App'
import { glRead } from '../hooks/useGenLayer'
import { NETWORKS } from '../config/networks'
import { verdictPillClass, shortAddr, fmtDate } from '../utils'

export default function Home() {
  const { network } = useNetwork()
  const navigate = useNavigate()
  const addrs = NETWORKS[network].contracts

  const [stats,    setStats]    = useState(null)
  const [projects, setProjects] = useState([])
  const [verdicts, setVerdicts] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      glRead(network, addrs.registry, 'get_stats',          []).then(r => JSON.parse(r)).catch(() => null),
      glRead(network, addrs.registry, 'get_projects',       [6]).then(r => JSON.parse(r)).catch(() => []),
      glRead(network, addrs.registry, 'get_recent_verdicts',[5]).then(r => JSON.parse(r)).catch(() => []),
      glRead(network, addrs.auditlog, 'get_stats',          []).then(r => JSON.parse(r)).catch(() => null),
    ]).then(([s, p, v, as]) => {
      setStats({ ...s, ...calcPassRate(as) })
      setProjects(p)
      setVerdicts(v)
    }).finally(() => setLoading(false))
  }, [network])

  function calcPassRate(s) {
    if (!s) return { passRate: '—' }
    const p = parseInt(s.passed || 0), f = parseInt(s.failed || 0), x = parseInt(s.partial || 0)
    const t = p + f + x
    return { passRate: t > 0 ? Math.round(p * 100 / t) + '%' : '0%' }
  }

  return (
    <>
      <section className="hero">
        <div className="hero__eyebrow">◈ Powered by GenLayer AI Validators</div>
        <h1 className="hero__title">Onchain Milestone<br />Verification</h1>
        <p className="hero__sub">
          AI validators autonomously verify grant milestones by fetching live evidence —
          no human reviewers, no bottlenecks.
        </p>
        <div className="hero__actions">
          <button className="btn btn--primary btn--lg" onClick={() => navigate('/create')}>Register Project</button>
          <button className="btn btn--ghost   btn--lg" onClick={() => navigate('/explore')}>Explore Projects</button>
        </div>
      </section>

      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-card__val">{stats?.total_projects ?? '—'}</div>
          <div className="stat-card__lbl">Projects Registered</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__val">{stats?.total_verifications ?? '—'}</div>
          <div className="stat-card__lbl">AI Verifications</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__val">{stats?.passRate ?? '—'}</div>
          <div className="stat-card__lbl">Pass Rate</div>
        </div>
      </div>

      <section style={{ marginBottom: 48 }}>
        <div className="section-hd">
          <h2 className="section-title">Recent Projects</h2>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/explore')}>View All →</button>
        </div>
        {loading ? <Loader /> : projects.length
          ? <div className="projects-grid">{projects.map(p => <ProjectCard key={p.contract} p={p} network={network} navigate={navigate} />)}</div>
          : <Empty text="No projects yet — be the first to register." />
        }
      </section>

      <section style={{ marginBottom: 64 }}>
        <div className="section-hd">
          <h2 className="section-title">Recent Verdicts</h2>
        </div>
        {loading ? <Loader /> : verdicts.length
          ? <div className="snap-list" style={{ maxWidth: 640 }}>
              {verdicts.map((v, i) => (
                <div key={i} className="snap-item">
                  <div className={`snap-dot snap-dot--${verdictPillClass(v.last_verdict)}`} />
                  <div>
                    <div className="snap-meta">{v.title} · {fmtDate(v.updated_at)}</div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:4 }}>
                      <span className={`pill pill--${verdictPillClass(v.last_verdict)}`}>{v.last_verdict}</span>
                      <span style={{ fontSize:12, color:'var(--text-3)' }}>Score {v.last_score}/100</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          : <Empty text="No verdicts yet." />
        }
      </section>

      <section className="card">
        <h2 style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.5px', marginBottom:12 }}>How It Works</h2>
        <div className="how-grid">
          {[
            ['①', 'Register Project',   'Deploy your MilestoneContract on GenLayer with project details and evidence criteria.'],
            ['②', 'Add Milestones',     'Define deliverables with success criteria and submit evidence URLs when ready.'],
            ['③', 'AI Verifies',        'GenLayer validators independently fetch your evidence URLs and reach consensus on pass / partial / fail.'],
            ['④', 'Verdict Onchain',    'Results are permanently recorded. Passed milestones can signal treasury release automatically.'],
          ].map(([num, title, desc]) => (
            <div key={title} className="how-step">
              <div className="how-step__num">{num}</div>
              <div className="how-step__title">{title}</div>
              <div className="how-step__desc">{desc}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function ProjectCard({ p, network, navigate }) {
  const rate = parseInt(p.completion_rate) || 0
  return (
    <div className="project-card" onClick={() => navigate(`/project/${p.contract}`)}>
      <div className="project-card__name">{p.project_name}</div>
      <div className="project-card__owner">{shortAddr(p.owner)}</div>
      <div className="project-card__foot">
        <div className="comp-bar"><div className="comp-bar__fill" style={{ width: rate + '%' }} /></div>
        <span style={{ fontSize:12, color:'var(--text-3)' }}>{rate}%</span>
        <span style={{ fontSize:12, color:'var(--text-3)' }}>{p.milestone_count} milestones</span>
      </div>
    </div>
  )
}

function Loader() {
  return <div className="loader"><div className="loader-bar" /><p>Loading...</p></div>
}

function Empty({ text }) {
  return <div className="empty"><div className="empty__icon">◈</div><div className="empty__text">{text}</div></div>
}
