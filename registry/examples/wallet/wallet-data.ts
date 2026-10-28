import type { PortfolioHolding, PortfolioRange } from "@/components/blocks/portfolio"

// Fixtures for the wallet example: what it holds, how the total moved, what
// happened lately and what waits on the person. Replace with your API.

export const ACCOUNT = { name: "Main wallet", address: "0x7a3f9c41e2b8d05a6f13c9e7b2d4a8f61c0e3d0c" }

export const HOLDINGS: PortfolioHolding[] = [
  {
    id: "eth",
    name: "Ethereum",
    symbol: "ETH",
    price: 3246.2,
    change: 0.0214,
    networks: [
      { id: "eth-base", name: "Base", amount: 2.1 },
      { id: "eth-mainnet", name: "Ethereum", amount: 1.742 },
    ],
  },
  { id: "usdc", name: "USD Coin", symbol: "USDC", price: 1, change: 0, networks: [{ id: "usdc-base", name: "Base", amount: 5210.4 }] },
  { id: "sol", name: "Solana", symbol: "SOL", price: 182.4, change: -0.013, networks: [{ id: "sol", name: "Solana", amount: 18.25 }] },
  { id: "link", name: "Chainlink", symbol: "LINK", price: 17.86, change: 0.0062, networks: [{ id: "link", name: "Ethereum", amount: 142.6 }] },
  { id: "usdt", name: "Tether", symbol: "USDT", price: 1, change: 0, networks: [{ id: "usdt", name: "Arbitrum", amount: 1050 }] },
  // No market prices these: listed on request, never counted.
  { id: "qp", name: "Quest Points", symbol: "QP", price: null, networks: [{ id: "qp", name: "Base", amount: 1200 }] },
  { id: "mpass", name: "Mint Pass", symbol: "MPASS", price: null, networks: [{ id: "mpass", name: "Ethereum", amount: 1 }] },
  { id: "dcat", name: "Degen Cat", symbol: "DCAT", price: null, networks: [{ id: "dcat", name: "Base", amount: 420000 }] },
  { id: "busdc", name: "Bridge Receipt", symbol: "bUSDC", price: null, networks: [{ id: "busdc", name: "Arbitrum", amount: 12.5 }] },
]

/** Small deterministic PRNG so the fixture is the same on every load. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const NOW = Date.UTC(2026, 9, 28, 13, 42)
const HOUR = 3_600_000

/** A walk that ends at `total`: the history is drawn backwards from now. */
function walk(seed: number, n: number, step: number, drift: number, vol: number, total: number) {
  const r = rng(seed)
  const vs = [total]
  for (let i = 1; i < n; i++) vs.unshift(vs[0] * (1 - drift - (r() - 0.5) * vol))
  return vs.map((v, i) => ({ t: NOW - (n - 1 - i) * step, v }))
}

export function ranges(total: number): PortfolioRange[] {
  return [
    { id: "1d", label: "1D", since: "24 h ago", points: walk(3, 48, HOUR / 2, 0.0002, 0.006, total) },
    { id: "1w", label: "1W", since: "7 days ago", points: walk(7, 84, 2 * HOUR, 0.0008, 0.014, total) },
    { id: "1m", label: "1M", since: "30 days ago", points: walk(11, 60, 12 * HOUR, 0.002, 0.03, total) },
    { id: "1y", label: "1Y", since: "Oct 2025", points: walk(19, 52, 168 * HOUR, 0.006, 0.07, total) },
    { id: "all", label: "All", since: "Mar 2022", points: walk(23, 56, 720 * HOUR, 0.012, 0.12, total) },
  ]
}

export function formatTime(t: number, range: string) {
  const d = new Date(t)
  return range === "1d" || range === "1w"
    ? d.toLocaleString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
    : d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: range === "1m" ? undefined : "numeric" })
}

export type Tx = {
  id: string
  time: string
  kind: "Swap" | "Send" | "Receive" | "Approve" | "Claim"
  what: string
  network: string
  /** In the display currency; signed when money left or came in. */
  value?: number
  status: "pending" | "confirmed" | "failed"
}

export const ACTIVITY: Tx[] = [
  { id: "t6", time: "Today 09:12", kind: "Receive", what: "Received 500 USDC from 0x91c4…7e02", network: "Base", value: 500, status: "confirmed" },
  { id: "t5", time: "Yesterday 18:40", kind: "Swap", what: "Swapped 0.5 ETH for 1,618.35 USDC", network: "Base", value: 1623.1, status: "confirmed" },
  { id: "t4", time: "Yesterday 11:05", kind: "Send", what: "Sent 2 SOL to 7xKq…9mPa", network: "Solana", value: -364.8, status: "confirmed" },
  { id: "t3", time: "Oct 25 16:22", kind: "Approve", what: "Allowed app.swapr.xyz to spend 1,000 USDC", network: "Base", status: "confirmed" },
  { id: "t2", time: "Oct 24 08:50", kind: "Send", what: "Sent 0.2 ETH to 0x5b0e…a1d9", network: "Ethereum", value: -649.24, status: "failed" },
  { id: "t1", time: "Oct 22 14:31", kind: "Claim", what: "Claimed 18.40 USDC in staking rewards", network: "Base", value: 18.4, status: "confirmed" },
]

export type Approval = {
  id: string
  kind: string
  subject: string
  title: string
  description: string
  details: [string, string][]
  allowLabel: string
  denyLabel: string
  /** What the record says once it's settled. */
  allowed: string
  denied: string
}

export const APPROVALS: Approval[] = [
  {
    id: "rebalance",
    kind: "Rebalance",
    subject: "ETH",
    title: "Assistant wants to swap 0.40 ETH for USDC",
    description: "ETH grew to 51% of the wallet; your rule keeps it under 45%. This brings it to 45.6%.",
    details: [
      ["Pay", "0.40 ETH on Base"],
      ["Receive at least", "1,291.80 USDC"],
      ["Network cost", "$0.03"],
      ["Rule", "Keep ETH under 45%"],
    ],
    allowLabel: "Swap 0.40 ETH",
    denyLabel: "Not now",
    allowed: "Swapped 0.40 ETH for USDC",
    denied: "Left as it is",
  },
  {
    id: "allowance",
    kind: "Allowance",
    subject: "app.swapr.xyz",
    title: "app.swapr.xyz wants to spend your USDC",
    description: "It asked for an unlimited allowance. 1,000 USDC covers the order you started there.",
    details: [
      ["Asked for", "Unlimited USDC"],
      ["Allowing", "1,000 USDC, once"],
      ["Contract", "0x3fc9…12ab · verified"],
    ],
    allowLabel: "Allow 1,000 USDC",
    denyLabel: "Deny",
    allowed: "Allowed 1,000 USDC",
    denied: "Denied",
  },
  {
    id: "claim",
    kind: "Rewards",
    subject: "USDC",
    title: "Assistant wants to claim 42.10 USDC in staking rewards",
    description: "They've waited 9 days; claiming costs $0.02 today.",
    details: [
      ["Rewards", "42.10 USDC"],
      ["Network cost", "$0.02"],
    ],
    allowLabel: "Claim 42.10 USDC",
    denyLabel: "Later",
    allowed: "Claimed 42.10 USDC",
    denied: "Left for later",
  },
]
