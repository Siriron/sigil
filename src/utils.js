export function verdictPillClass(verdict) {
  const v = (verdict || 'pending').toLowerCase()
  if (v === 'passed')   return 'passed'
  if (v === 'failed')   return 'failed'
  if (v === 'partial')  return 'partial'
  if (v === 'analysis') return 'analysis'
  return 'pending'
}

export function shortAddr(addr) {
  if (!addr) return '—'
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

export function fmtDate(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) }
  catch { return ts }
}

export function scoreColor(score) {
  const s = parseInt(score) || 0
  if (s >= 75) return 'var(--green)'
  if (s >= 40) return 'var(--yellow)'
  return 'var(--red)'
}
