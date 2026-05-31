import { createClient } from 'genlayer-js'
import { studionet, testnetBradbury } from 'genlayer-js/chains'
import { TransactionStatus } from 'genlayer-js/types'

// ── Chain map ──────────────────────────────────────────────
const CHAINS = {
  studionet,
  bradbury: testnetBradbury,
}

// Network name for client.connect()
const CONNECT_NAME = {
  studionet: 'studionet',
  bradbury:  'testnetBradbury',
}

// ── Clients ────────────────────────────────────────────────
function getReadClient(networkId) {
  return createClient({ chain: CHAINS[networkId] })
}

function getWriteClient(networkId, address) {
  return createClient({
    chain:    CHAINS[networkId],
    account:  address,
    provider: window.ethereum,
  })
}

// ── Read contract ──────────────────────────────────────────
// Always returns a JSON string so callers can do JSON.parse(result)
export async function glRead(networkId, contractAddress, functionName, args = []) {
  const client = getReadClient(networkId)
  const result = await client.readContract({
    address: contractAddress,
    functionName,
    args,
  })
  // readContract may return: string, object, number, etc.
  if (typeof result === 'string') return result
  return JSON.stringify(result)
}

// ── Write contract ─────────────────────────────────────────
export async function glWrite(networkId, address, contractAddress, functionName, args = []) {
  const client = getWriteClient(networkId, address)
  // MUST call connect before writeContract — switches MetaMask to correct chain
  await client.connect(CONNECT_NAME[networkId])
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName,
    args,
    value: BigInt(0),
  })
  return txHash
}

// ── Deploy contract ────────────────────────────────────────
export async function glDeploy(networkId, address, code, args = []) {
  const client = getWriteClient(networkId, address)
  // MUST call connect before deployContract
  await client.connect(CONNECT_NAME[networkId])
  const txHash = await client.deployContract({
    code,
    args,
    leaderOnly: false,
  })
  return txHash
}

// ── Wait for receipt (ACCEPTED status) ────────────────────
export async function waitForReceipt(networkId, txHash, retries = 120, interval = 5000) {
  const client = getReadClient(networkId)
  const receipt = await client.waitForTransactionReceipt({
    hash:     txHash,
    status:   TransactionStatus.ACCEPTED,
    retries,
    interval,
  })
  return receipt
}

// ── Helper ─────────────────────────────────────────────────
export function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
