import React, { useState, useCallback, createContext, useContext, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useNetwork, useWalletCtx } from '../App'

// ── Toast Context ──────────────────────────────────────────
export const ToastCtx = createContext(null)
export function useToast() { return useContext(ToastCtx) }

export default function Layout() {
  const { network, setNetwork } = useNetwork()
  const { address, shortAddress, connect, connecting } = useWalletCtx()
  const [toasts, setToasts] = useState([])

  const toast = useCallback((msg, type = '') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  return (
    <ToastCtx.Provider value={toast}>
      <header className="header">
        <div className="container header__inner">
          <NavLink to="/" className="logo">
            <span className="logo__icon">◈</span>
            <span className="logo__text">Sigil</span>
          </NavLink>

          <nav className="nav">
            <NavLink to="/"        className={({isActive}) => 'nav__link' + (isActive ? ' active' : '')}>Projects</NavLink>
            <NavLink to="/explore" className={({isActive}) => 'nav__link' + (isActive ? ' active' : '')}>Explore</NavLink>
            <NavLink to="/audit"   className={({isActive}) => 'nav__link' + (isActive ? ' active' : '')}>Audit Log</NavLink>
            <NavLink to="/create"  className={({isActive}) => 'nav__link' + (isActive ? ' active' : '')} style={{color:'var(--accent-2)'}}>+ New Project</NavLink>
          </nav>

          <div className="net-toggle">
            <button
              className={'net-toggle__btn' + (network === 'bradbury'  ? ' active' : '')}
              onClick={() => setNetwork('bradbury')}
            >Bradbury</button>
            <button
              className={'net-toggle__btn' + (network === 'studionet' ? ' active' : '')}
              onClick={() => setNetwork('studionet')}
            >StudioNet</button>
          </div>

          <button
            className={'btn btn--wallet' + (address ? ' connected' : '')}
            onClick={connect}
            disabled={connecting}
          >
            {connecting ? 'Connecting…' : address ? shortAddress : 'Connect Wallet'}
          </button>
        </div>
      </header>

      <main className="page-wrap">
        <div className="container">
          <Outlet />
        </div>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <p>© 2026 Sigil — AI-powered milestone verification on GenLayer.</p>
          <p>Built on GenLayer · The Court of the Internet.</p>
        </div>
      </footer>

      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast${t.type ? ` toast--${t.type}` : ''}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
