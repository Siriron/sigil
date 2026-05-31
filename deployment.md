# Sigil — Deployment Guide

## Live Deployment

| | |
|---|---|
| **Live App** | https://sigil-genlayer.vercel.app |
| **GitHub** | https://github.com/Siriron/sigil |
| **Platform** | Vercel |
| **Framework** | React + Vite |

---

## Deployed Contracts

### StudioNet

| Contract | Address | Explorer |
|---|---|---|
| ProjectRegistry | `0x47FB5751b83510F517494709e776eb81386cc9C2` | [TX](https://explorer-studio.genlayer.com/tx/0xda5c733d396e2411b50acc91e023736ad9c4b6f4db750bfc52235211f5ab8e37) |
| AuditLog | `0xC16f4f3e0f713e6Be0B20E6fB5Ba1ba4006B34e2` | [TX](https://explorer-studio.genlayer.com/tx/0x9bf6aa696304155b7f89489c9822d28f9183c5178cc72946b0df016beecd4672) |
| MilestoneContract | `0x46cD4DB021B115Bd67183c035DC8b33E4c6E6775` | [TX](https://explorer-studio.genlayer.com/tx/0xdb8ab141c88b5177543dda12d7b1daeb7827616ba1532a8ee6b0f996d8096f0c) |

### Bradbury Testnet

| Contract | Address | Explorer |
|---|---|---|
| ProjectRegistry | `0x04454AEB3B6e8B46e999a6Fb9EBA17242f43Cb8D` | [TX](https://explorer-bradbury.genlayer.com/tx/0xf8fbf366e575db927df0f05dc0d53e25845f7a19cb45cca1a37536fffa55c5ae) |
| AuditLog | `0xA9a45927B1912a5329241157CF51E91468024bED` | [TX](https://explorer-bradbury.genlayer.com/tx/0xa0fa35a32ed2d4cd434e372f225bd98f3d4be3c7185de70b228a9ceee825c778) |
| MilestoneContract | `0xBd2735655fCE9059Cb0FfBB0B0C4d456384EB157` | [TX](https://explorer-bradbury.genlayer.com/tx/0xbc09e3ff4c3be2edced381813c4c9682cccb62f0824984da350c8a778453b568) |

---

## Contract Deployment Process

### Prerequisites

- GenLayer Studio account at [studio.genlayer.com](https://studio.genlayer.com)
- MetaMask with GenLayer StudioNet or Bradbury network added
- Testnet GEN tokens from [testnet-faucet.genlayer.foundation](https://testnet-faucet.genlayer.foundation)

### Step 1 — Deploy ProjectRegistry

1. Open [studio.genlayer.com](https://studio.genlayer.com)
2. Upload `contracts/registry.py`
3. No constructor arguments required
4. Click **Deploy** and wait for ACCEPTED status
5. Copy the contract address

### Step 2 — Deploy AuditLog

1. Upload `contracts/auditlog.py`
2. No constructor arguments required
3. Click **Deploy** and wait for ACCEPTED status
4. Copy the contract address

### Step 3 — Deploy MilestoneContract

1. Upload `contracts/milestone.py`
2. Fill constructor arguments:

| Argument | Value |
|---|---|
| `registry_address` | Address from Step 1 |
| `auditlog_address` | Address from Step 2 |
| `owner_address` | Your wallet address |
| `project_name` | Your project name |
| `project_description` | Your project description |
| `bridge_out_address` | `0x0000000000000000000000000000000000000000` |
| `treasury_address` | `` (empty string) |
| `relayer_address` | `0x0000000000000000000000000000000000000000` |

3. Click **Deploy** and wait for ACCEPTED status
4. Copy the contract address

### Step 4 — Update Frontend Config

Edit `src/config/networks.js` with your deployed addresses:

```js
export const NETWORKS = {
  bradbury: {
    contracts: {
      registry:  'YOUR_BRADBURY_REGISTRY_ADDRESS',
      auditlog:  'YOUR_BRADBURY_AUDITLOG_ADDRESS',
      milestone: 'YOUR_BRADBURY_MILESTONE_ADDRESS',
    },
  },
  studionet: {
    contracts: {
      registry:  'YOUR_STUDIONET_REGISTRY_ADDRESS',
      auditlog:  'YOUR_STUDIONET_AUDITLOG_ADDRESS',
      milestone: 'YOUR_STUDIONET_MILESTONE_ADDRESS',
    },
  },
}
```

---

## Frontend Deployment

### Local Development

```bash
git clone https://github.com/Siriron/sigil
cd sigil
npm install
npm run dev
```

App runs at `http://localhost:3000`.

### Vercel Deployment

1. Fork or clone the repository to your GitHub account
2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import the GitHub repository
4. Set **Framework Preset** to **Vite**
5. Leave **Root Directory** as `/`
6. No environment variables required
7. Click **Deploy**

Vercel automatically rebuilds on every push to `main`.

---

## Network Configuration

### StudioNet

| Setting | Value |
|---|---|
| RPC URL | `https://studio.genlayer.com/api` |
| Chain ID | `61999` (`0xF22F`) |
| Currency | GEN |
| Explorer | https://explorer-studio.genlayer.com |

### Bradbury Testnet

| Setting | Value |
|---|---|
| RPC URL | `https://rpc-bradbury.genlayer.com` |
| Chain ID | `4221` (`0x107D`) |
| Currency | GEN |
| Explorer | https://explorer-bradbury.genlayer.com |
| Faucet | https://testnet-faucet.genlayer.foundation |

---

## Adding a Project (User Flow)

1. Open the app and connect MetaMask
2. Select network (StudioNet or Bradbury) via the header toggle
3. Go to **+ New Project**
4. Deploy `milestone.py` from GenLayer Studio with your details
5. Enter the deployed contract address in the registration form
6. Submit — the project is registered in the global ProjectRegistry

## Adding Milestones

1. Open your project page
2. Click **+ Add Milestone** (owner only)
3. Enter title, success criteria, deadline, evidence URLs
4. Confirm the transaction in MetaMask
5. Wait for ACCEPTED consensus

## Triggering Verification

1. Open any milestone on your project page
2. Click **Verify**
3. Confirm in MetaMask
4. GenLayer AI validators fetch your evidence URLs live
5. Consensus is reached — verdict recorded onchain
6. Score, reasoning, and verdict visible immediately

---

## Contract Linting

All contracts pass the GenVM linter before deployment:

```bash
pip install genvm-linter
genvm-lint check contracts/milestone.py
genvm-lint check contracts/registry.py
genvm-lint check contracts/auditlog.py
```

Expected output: `exit 0` for all three files.
