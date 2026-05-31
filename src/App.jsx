import React, { createContext, useContext, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useWallet } from './hooks/useWallet'

import Layout from './components/Layout'
import Home from './pages/Home'
import Create from './pages/Create'
import Explore from './pages/Explore'
import AuditLog from './pages/AuditLog'
import Project from './pages/Project'

// ── Network Context ────────────────────────────────────────
export const NetworkCtx = createContext(null)
export function useNetwork() { return useContext(NetworkCtx) }

export const WalletCtx = createContext(null)
export function useWalletCtx() { return useContext(WalletCtx) }

export default function App() {
  const [network, setNetwork] = useState('bradbury')
  const wallet = useWallet()

  return (
    <NetworkCtx.Provider value={{ network, setNetwork }}>
      <WalletCtx.Provider value={wallet}>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="create"  element={<Create />} />
              <Route path="explore" element={<Explore />} />
              <Route path="audit"   element={<AuditLog />} />
              <Route path="project/:address" element={<Project />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WalletCtx.Provider>
    </NetworkCtx.Provider>
  )
}
