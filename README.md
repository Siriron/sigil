# Sigil — AI-Powered Onchain Milestone Verification

**Live App:** https://sigil-genlayer.vercel.app  
**GitHub:** https://github.com/Siriron/sigil  
**Network:** GenLayer StudioNet + Bradbury Testnet

---

## What is Sigil?

Sigil is a decentralized grant milestone verification platform built on GenLayer. It solves a fundamental problem in grant programs: milestone verification is currently manual, slow, subjective, and doesn't scale.

With Sigil, project teams register their milestones onchain with verifiable evidence criteria. When a milestone deadline is reached, GenLayer AI validators automatically fetch the evidence URLs — a live GitHub repository, a deployed frontend, documentation — evaluate them against the registered success criteria, and render a binding verdict: **passed**, **partial**, or **failed**. No human reviewer required. No bottleneck. No subjectivity.

This is not a quest game or content evaluator. Sigil is infrastructure — a new primitive for trustless, autonomous, milestone-gated program management.

---

## Why GenLayer?

Traditional blockchains can't do this. They can't fetch a live GitHub repo, read its contents, and reason about whether it meets specific criteria. GenLayer can — natively, through its nondet execution model and AI validator consensus.

Sigil uses every core GenLayer capability:

- **`gl.nondet.web.request()`** — fetches live evidence URLs (GitHub repos, live apps, documentation) at verification time
- **`gl.nondet.exec_prompt()`** — AI evaluates fetched content against milestone criteria and produces a structured verdict
- **`gl.vm.run_nondet(leader_fn, validator_fn)`** — multiple independent validators reach consensus on the verdict
- **`gl.get_contract_at()`** — MilestoneContract calls the global ProjectRegistry and AuditLog after each verification
- **`TreeMap`, `DynArray`, `@allow_storage`** — persistent onchain storage of all verdicts and snapshots

GenLayer's Optimistic Democracy consensus means no single validator controls the outcome. The verdict is only recorded when multiple independent validators agree — making it trustless and manipulation-resistant.

---

## How It Works

### For Project Teams

1. Deploy a `MilestoneContract` from GenLayer Studio with your project details
2. Register it in the global ProjectRegistry via the Sigil frontend
3. Add milestones with success criteria and evidence URLs (GitHub repo, live app, docs)
4. When ready — click **Verify** in the frontend
5. GenLayer AI validators fetch your evidence URLs live, evaluate against your criteria, and record the verdict onchain

### For Grant Programs

Sigil provides a public registry of all projects, their milestones, verdicts, and completion rates. The Audit Log is an immutable, append-only record of every AI verdict across every project — permanently queryable onchain.

### Verdict Types

| Verdict | Score | Meaning |
|---|---|---|
| **Passed** | 75–100 | All critical criteria demonstrably met |
| **Partial** | 40–74 | Some criteria met, gaps exist |
| **Failed** | 0–39 | Critical criteria unmet or evidence unreachable |

---

## Smart Contracts

### Architecture

Sigil uses three intelligent contracts deployed on both StudioNet and Bradbury:

**`MilestoneContract.py`** — Deployed per project. Stores project details, milestone definitions, evidence URLs, and verification history. The AI verification logic lives here. Core functions: `verify()`, `refresh()`, `analyze()`, `compare()`, `flag()`, `archive()`, `add_milestone()`.

**`ProjectRegistry.py`** — Pre-deployed global registry. Indexes all projects and milestones across the platform. Provides leaderboard sorted by completion rate, recent verdicts, and per-project milestone history. Called automatically by MilestoneContract after each verification.

**`AuditLog.py`** — Pre-deployed append-only audit trail. Every AI verdict is permanently logged here with timestamp, project name, milestone title, score, and reasoning. Supports cross-project AI comparison via `compare()`.

### Deployed Addresses

#### StudioNet

| Contract | Address | Transaction |
|---|---|---|
| ProjectRegistry | `0x47FB5751b83510F517494709e776eb81386cc9C2` | [View](https://explorer-studio.genlayer.com/tx/0xda5c733d396e2411b50acc91e023736ad9c4b6f4db750bfc52235211f5ab8e37) |
| AuditLog | `0xC16f4f3e0f713e6Be0B20E6fB5Ba1ba4006B34e2` | [View](https://explorer-studio.genlayer.com/tx/0x9bf6aa696304155b7f89489c9822d28f9183c5178cc72946b0df016beecd4672) |
| MilestoneContract (demo) | `0x46cD4DB021B115Bd67183c035DC8b33E4c6E6775` | [View](https://explorer-studio.genlayer.com/tx/0xdb8ab141c88b5177543dda12d7b1daeb7827616ba1532a8ee6b0f996d8096f0c) |

#### Bradbury Testnet

| Contract | Address | Transaction |
|---|---|---|
| ProjectRegistry | `0x04454AEB3B6e8B46e999a6Fb9EBA17242f43Cb8D` | [View](https://explorer-bradbury.genlayer.com/tx/0xf8fbf366e575db927df0f05dc0d53e25845f7a19cb45cca1a37536fffa55c5ae) |
| AuditLog | `0xA9a45927B1912a5329241157CF51E91468024bED` | [View](https://explorer-bradbury.genlayer.com/tx/0xa0fa35a32ed2d4cd434e372f225bd98f3d4be3c7185de70b228a9ceee825c778) |
| MilestoneContract (demo) | `0xBd2735655fCE9059Cb0FfBB0B0C4d456384EB157` | [View](https://explorer-bradbury.genlayer.com/tx/0xbc09e3ff4c3be2edced381813c4c9682cccb62f0824984da350c8a778453b568) |

---

## Frontend

Built with **React + Vite** using the official **genlayer-js SDK**.

### Pages

| Page | Description |
|---|---|
| **/** | Home — live stats, recent projects, recent verdicts, how it works |
| **/create** | Register a new project (deploy MilestoneContract + register in registry) |
| **/explore** | Browse all projects with filters and leaderboard |
| **/audit** | Global audit log — all AI verdicts with scores and reasoning |
| **/project/:address** | Project detail — milestones, verify, analyze, flag, verification history |

### Network Toggle

The app supports both StudioNet and Bradbury via a header toggle. Switching networks reloads all data from the correct chain.

### Key SDK Usage

```js
// Read contract state — no wallet needed
const client = createClient({ chain: studionet })
const result = await client.readContract({ address, functionName, args })

// Write transaction — MetaMask signs
const client = createClient({ chain: testnetBradbury, account: address, provider: window.ethereum })
await client.connect('testnetBradbury')
const txHash = await client.writeContract({ address, functionName, args, value: BigInt(0) })
await client.waitForTransactionReceipt({ hash: txHash, status: TransactionStatus.ACCEPTED })
```

---

## Local Development

```bash
git clone https://github.com/Siriron/sigil
cd sigil
npm install
npm run dev
```

Open `http://localhost:3000` and connect MetaMask to StudioNet or Bradbury.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Intelligent Contracts | Python on GenVM (GenLayer) |
| Frontend Framework | React 18 + Vite 6 |
| Blockchain SDK | genlayer-js |
| Wallet | MetaMask (browser wallet) |
| Deployment | Vercel |
| Networks | GenLayer StudioNet + Bradbury Testnet |

---

## The Vision

Grant programs — including GenLayer's own grants — currently verify milestones manually. A reviewer checks if you delivered what you promised. This is slow, gameable, and doesn't scale.

Sigil is the tool that grant programs should run on. Register milestones. AI verifies delivery. Results recorded permanently onchain. No reviewer bottleneck.

GenLayer calls itself the Court of the Internet. Sigil is one of its first real courtrooms.

---

Built by [@Siriron](https://github.com/Siriron) on GenLayer.
