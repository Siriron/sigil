import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNetwork, useWalletCtx } from '../App'
import { useToast } from '../components/Layout'
import { glDeploy, glWrite, waitForReceipt } from '../hooks/useGenLayer'
import { NETWORKS } from '../config/networks'

export default function Create() {
  const { network } = useNetwork()
  const { address, connect } = useWalletCtx()
  const toast    = useToast()
  const navigate = useNavigate()
  const addrs    = NETWORKS[network].contracts

  const [name,   setName]   = useState('')
  const [desc,   setDesc]   = useState('')
  const [status, setStatus] = useState('')
  const [busy,   setBusy]   = useState(false)

  async function handleDeploy(e) {
    e.preventDefault()

    // Ensure wallet connected
    let wallet = address
    if (!wallet) {
      wallet = await connect()
      if (!wallet) { toast('Connect your wallet first', 'error'); return }
    }

    if (!name.trim() || !desc.trim()) {
      toast('Fill in all fields', 'error')
      return
    }

    setBusy(true)
    setStatus('Fetching contract code...')

    try {
      // Fetch milestone.py from public folder
      const codeRes = await fetch('/contracts/milestone.py')
      if (!codeRes.ok) throw new Error('Could not load contract code')
      const code = await codeRes.text()

      setStatus('Deploying MilestoneContract — confirm in MetaMask...')

      const txHash = await glDeploy(network, wallet, code, [
        addrs.registry,                                        // registry_address
        addrs.auditlog,                                        // auditlog_address
        wallet,                                                // owner_address
        name.trim(),                                           // project_name
        desc.trim(),                                           // project_description
        '0x0000000000000000000000000000000000000000',          // bridge_out_address
        '',                                                    // treasury_address
        '0x0000000000000000000000000000000000000000',          // relayer_address
      ])

      setStatus('Waiting for AI consensus (this takes ~30–60s)...')

      const receipt = await waitForReceipt(network, txHash, 120, 5000)

      // Extract contract address from receipt
      const contractAddress =
        receipt?.data?.contract_address ||
        receipt?.contractAddress ||
        receipt?.to

      if (!contractAddress) throw new Error('Could not get contract address from receipt')

      // Register in global registry
      setStatus('Registering in ProjectRegistry...')
      const regTx = await glWrite(
        network, wallet,
        addrs.registry,
        'register_project',
        [wallet, name.trim()]
      )
      await waitForReceipt(network, regTx, 60, 5000)

      toast('Project deployed successfully!', 'success')
      setStatus('Redirecting...')
      setTimeout(() => navigate(`/project/${contractAddress}`), 1000)

    } catch (err) {
      console.error(err)
      toast(err.message || 'Deploy failed', 'error')
      setStatus('')
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:'-1px', marginBottom:8 }}>
        Register Project
      </h1>
      <p style={{ color:'var(--text-2)', fontSize:15, marginBottom:32 }}>
        Deploy a MilestoneContract on GenLayer. AI validators will verify your deliverables automatically.
      </p>

      <div className="card" style={{ marginBottom:24 }}>
        <form onSubmit={handleDeploy}>
          <div className="form-group">
            <label className="form-label">Project Name</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Grant Project"
              required
              disabled={busy}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Project Description</label>
            <textarea
              className="form-textarea"
              rows={4}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Describe what you are building and what this grant aims to fund..."
              required
              disabled={busy}
            />
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:16, marginTop:28 }}>
            <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
              {busy ? 'Deploying...' : 'Deploy Project Contract'}
            </button>
            {busy && <div className="spinner" />}
          </div>

          {status && (
            <p className="form-hint" style={{ marginTop:12, color:'var(--accent-2)' }}>
              {status}
            </p>
          )}
        </form>
      </div>

      <div className="card" style={{ borderColor:'rgba(108,99,255,0.2)' }}>
        <h3 style={{ fontSize:15, fontWeight:700, marginBottom:14, color:'var(--accent-2)' }}>
          What happens when you click Deploy?
        </h3>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[
            ['①', 'milestone.py is fetched and deployed on GenLayer via genlayer-js SDK'],
            ['②', 'MetaMask signs the deployment transaction — no private key stored anywhere'],
            ['③', 'AI validators reach consensus (~30–60s) and the contract is live'],
            ['④', 'Your project is registered in the global ProjectRegistry'],
            ['⑤', 'You are redirected to your project page to add milestones'],
          ].map(([n, t]) => (
            <p key={n} style={{ fontSize:14, color:'var(--text-2)', lineHeight:1.6 }}>
              <span style={{ color:'var(--accent-2)', fontWeight:700 }}>{n}</span> {t}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
