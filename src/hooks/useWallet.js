import { useState, useCallback, useEffect } from 'react'

export function useWallet() {
  const [address, setAddress] = useState(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (!window.ethereum) return
    window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
      if (accounts[0]) setAddress(accounts[0])
    })
    const handler = (accounts) => setAddress(accounts[0] || null)
    window.ethereum.on('accountsChanged', handler)
    return () => window.ethereum.removeListener('accountsChanged', handler)
  }, [])

  const connect = useCallback(async () => {
    if (!window.ethereum) return null
    setConnecting(true)
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAddress(accounts[0])
      return accounts[0]
    } catch {
      return null
    } finally {
      setConnecting(false)
    }
  }, [])

  const shortAddress = address
    ? address.slice(0, 6) + '…' + address.slice(-4)
    : null

  return { address, shortAddress, connect, connecting }
}
