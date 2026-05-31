import { createClient } from 'genlayer-js'
import { studionet, testnetBradbury } from 'genlayer-js/chains'
import { TransactionStatus } from 'genlayer-js/types'

const CHAINS = {
  studionet,
  bradbury: testnetBradbury,
}

const CONNECT_NAME = {
  studionet: 'studionet',
  bradbury:  'testnetBradbury',
}

const RECEIPT_CONFIG = {
  studionet: { retries: 120, interval: 4000 },
  bradbury:  { retries: 240, interval: 6000 },
}

const CHAIN_CONFIGS = {
  bradbury: {
    chainId: '0x107D',
    chainName: 'GenLayer Bradbury',
    rpcUrls: ['https://rpc.bradbury.genlayer.com'],
    nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
    blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
  },
  studionet: {
    chainId: '0xF22F',
    chainName: 'GenLayer StudioNet',
    rpcUrls: ['https://studio.genlayer.com/api'],
    nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
    blockExplorerUrls: ['https://explorer-studio.genlayer.com'],
  },
}

// The fix: after wallet_addEthereumChain succeeds, explicitly switch to it.
// Previously we added the chain but never switched — so the wallet was still
// on the old chain when the transaction was sent, causing the "Review alert"
// and transaction failures on Bradbury.
async function ensureChain(networkId) {
  const cfg = CHAIN_CONFIGS[networkId]
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: cfg.chainId }],
    })
  } catch (switchErr) {
    if (switchErr.code === 4902) {
      // Chain not in wallet — add it first
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [cfg],
      })
      // Then switch to it explicitly
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: cfg.chainId }],
      })
    } else if (switchErr.code === -32002) {
      // Request already pending in wallet UI — give user time to respond
      await sleep(3000)
    } else {
      throw switchErr
    }
  }
}

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

export async function glRead(networkId, contractAddress, functionName, args) {
  if (!args) args = []
  const client = getReadClient(networkId)
  const result = await client.readContract({
    address: contractAddress,
    functionName,
    args,
  })
  if (typeof result === 'string') return result
  return JSON.stringify(result)
}

export async function glWrite(networkId, address, contractAddress, functionName, args) {
  if (!args) args = []
  await ensureChain(networkId)
  const client = getWriteClient(networkId, address)
  await client.connect(CONNECT_NAME[networkId])
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName,
    args,
    value: BigInt(0),
  })
  return txHash
}

export async function glDeploy(networkId, address, code, args) {
  if (!args) args = []
  await ensureChain(networkId)
  const client = getWriteClient(networkId, address)
  await client.connect(CONNECT_NAME[networkId])
  const txHash = await client.deployContract({
    code,
    args,
    leaderOnly: false,
  })
  return txHash
}

export async function waitForReceipt(networkId, txHash) {
  const client = getReadClient(networkId)
  const cfg = RECEIPT_CONFIG[networkId]
  try {
    const receipt = await client.waitForTransactionReceipt({
      hash:     txHash,
      status:   TransactionStatus.ACCEPTED,
      retries:  cfg.retries,
      interval: cfg.interval,
    })
    return receipt
  } catch (err) {
    const base = networkId === 'bradbury'
      ? 'https://explorer-bradbury.genlayer.com/tx/'
      : 'https://explorer-studio.genlayer.com/tx/'
    const e = new Error('Consensus taking longer than expected. Check explorer: ' + base + txHash)
    e.txHash = txHash
    e.isTimeout = true
    throw e
  }
}

export function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms) }) }
