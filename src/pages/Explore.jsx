import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNetwork } from '../App'
import { glRead } from '../hooks/useGenLayer'
import { NETWORKS } from '../config/networks'
import { shortAddr } from '../utils'

const FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'active',  label: 'With Milestones' },
  { key: 'passing', label: 'Passing 75%+' },
  { key: 'recent',  label: 'Recent' },
]

export default function Explore() {
  const { network } = useNetwork()
  const navigate    = useNavigate()
  const addrs       = NETWORKS[network].contracts

  const [all,     setAll]     = useState([])
  const [leaders, setLeaders] = useState([])
  const [filter,  setFilter]  = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      glRead(network, addrs.registry, 'get_projects',         [50]).then(r => JSON.parse(r)).catch(() => []),
      glRead(network, addrs.registry, 'get_projects_by_score',[10]).then(r => JSON.parse(r)).catch(() => []),
    ]).then(([p, l]) => { setAll(p); setLeaders(l) })
      .finally(() => setLoading(false))
  }, [network])

  const filtered = (() => {
    if (filter === 'active')  return all.filter(p => parseInt(p.milestone_count) > 0)
    if (filter === 'passing') return all.filter(p => parseInt(p.completion_rate) >= 75)
    if (filter === 'recent')  return [...all].slice(-12).reverse()
    return all
  })()

  return (
    <>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:'-1px', marginBottom:8 }}>Explore Projects</h1>
        <p style={{ color:'var(--text-2)', fontSize:15 }}>All registered projects across the Sigil network.</p>
      </div>

      <div className="filter-bar">
        {FILTERS.map(f => (
          <button key={f.key} className={'filter-btn' + (filter === f.key ? ' active' : '')}
            onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>

      {loading
        ? <Loader />
        : filtered.length
          ? <div className="projects-grid">
              {filtered.map(p => <ProjectCard key={p.contract} p={p} navigate={navigate} />)}
            </div>
          : <Empty text="No projects match this filter." />
      }

      <div style={{ marginTop: 56 }}>
        <h2 className="section-title" style={{ marginBottom: 20 }}>Leaderboard</h2>
        {loading
          ? <Loader />
          : leaders.length
            ? <div className="lb-list">
                {leaders.map((p, i) => {
                  const rankClass = i === 0 ? ' lb-rank--gold' : i === 1 ? ' lb-rank--silver' : i === 2 ? ' lb-rank--bronze' : ''
                  return (
                    <div key={p.contract} className="lb-row" onClick={() => navigate(`/project/${p.contract}`)}>
                      <div className={'lb-rank' + rankClass}>#{i + 1}</div>
                      <div>
                        <div className="lb-name">{p.project_name}</div>
                        <div style={{ fontSize:12, color:'var(--text-3)' }}>{shortAddr(p.owner)}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div className="lb-rate">{p.completion_rate}%</div>
                        <div style={{ fontSize:11, color:'var(--text-3)' }}>pass rate</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            : <Empty text="No data yet." />
        }
      </div>
    </>
  )
}

function ProjectCard({ p, navigate }) {
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

function Loader() { return <div className="loader"><div className="loader-bar" /><p>Loading...</p></div> }
function Empty({ text }) { return <div className="empty"><div className="empty__icon">◈</div><div className="empty__text">{text}</div></div> }
