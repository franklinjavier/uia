import * as React from "react"

import {
  BillsFilter,
  type BillDocument,
} from "@/components/blocks/bills-filter"
import {
  PurchaseOrders,
  type PurchaseOrder,
} from "@/components/blocks/purchase-orders"

// Example: accounts payable for September. The orders schedule and the
// bills filter, side by side, over seeded data (27 orders, a few placed in
// late August; 196 documents). Approve and Mark billed move the orders on
// after a moment; the filter's button just reports what it would show.

const SUPPLIERS = [
  "Northwind Freight",
  "Haldon Supplies",
  "Lumen Print Co.",
  "Ardent Logistics",
  "Copperline Metals",
  "Fairway Packaging",
  "Kestrel Office",
  "Morrow Electric",
]

/** Small deterministic PRNG so the fixture is the same on every load. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const iso = (d: number) =>
  new Date(Date.UTC(2026, 8, d)).toISOString().slice(0, 10)

function seedOrders(): PurchaseOrder[] {
  const r = rng(7)
  const fixed: PurchaseOrder[] = [
    {
      id: "PO-0418",
      supplier: "Northwind Freight",
      amount: 6120,
      status: "billed",
      ordered: iso(1),
      delivery: iso(17),
      billed: 1,
    },
    {
      id: "PO-0421",
      supplier: "Haldon Supplies",
      amount: 4480,
      status: "approved",
      ordered: iso(1),
      delivery: iso(22),
      billed: 0.4,
    },
    {
      id: "PO-0427",
      supplier: "Lumen Print Co.",
      amount: 1960,
      status: "awaiting",
      ordered: iso(16),
      delivery: iso(30),
      billed: 0,
    },
  ]
  const statuses: PurchaseOrder["status"][] = [
    "billed",
    "approved",
    "approved",
    "billed",
    "draft",
    "billed",
    "approved",
  ]
  const rest = Array.from({ length: 24 }, (_, i): PurchaseOrder => {
    const placed = i < 3 ? -(3 + i * 4) : 1 + Math.floor(r() * 26)
    const status =
      i === 7
        ? "awaiting"
        : i === 11 || i === 19
          ? "draft"
          : statuses[i % statuses.length]
    const billed =
      status === "billed"
        ? 1
        : status === "approved"
          ? Math.round(r() * 8) / 10
          : 0
    return {
      id: `PO-${String(430 + i).padStart(4, "0")}`,
      supplier: SUPPLIERS[Math.floor(r() * SUPPLIERS.length)],
      amount: Math.round((400 + r() * r() * 14000) / 10) * 10,
      status,
      ordered: iso(placed),
      delivery: iso(placed + 7 + Math.floor(r() * 20)),
      billed,
    }
  })
  return [...fixed, ...rest].sort((a, b) => a.ordered.localeCompare(b.ordered))
}

function seedDocuments(): BillDocument[] {
  const r = rng(11)
  return Array.from({ length: 196 }, (_, i) => {
    const kind = i < 184 ? "bill" : "credit"
    // Two soft humps: everyday bills around $1.8k, larger ones around $9k.
    const big = r() < 0.38
    const normal =
      Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r())
    const base = Math.max(120, big ? 9000 + normal * 1700 : 1800 + normal * 650)
    const due = 1 + Math.floor(r() * 45)
    return {
      id: `D-${1000 + i}`,
      kind,
      amount: Math.round((kind === "credit" ? base * 0.4 : base) / 10) * 10,
      due: iso(due),
      overdue: due < 18 && r() < 0.55,
    }
  })
}

const TODAY = iso(18)

export function PurchaseOrdersExample() {
  const [orders, setOrders] = React.useState(seedOrders)
  const [documents] = React.useState(seedDocuments)
  const later = (fn: () => void) =>
    new Promise<void>((done) => window.setTimeout(() => (fn(), done()), 900))

  return (
    <div className="flex w-full flex-wrap items-start justify-center gap-6">
      <PurchaseOrders
        orders={orders}
        defaultSelected={["PO-0421", "PO-0437"]}
        today={TODAY}
        period={{ from: iso(1), to: iso(30), label: "September" }}
        onApprove={(ids) =>
          later(() =>
            setOrders((os) =>
              os.map((o) =>
                ids.includes(o.id) ? { ...o, status: "approved" } : o
              )
            )
          )
        }
        onMarkBilled={(ids) =>
          later(() =>
            setOrders((os) =>
              os.map((o) =>
                ids.includes(o.id) ? { ...o, status: "billed", billed: 1 } : o
              )
            )
          )
        }
      />
      <BillsFilter
        documents={documents}
        defaults={{
          from: iso(1),
          to: iso(30),
          min: 500,
          max: 12000,
          overdue: false,
          kinds: ["bill", "credit"],
        }}
      />
    </div>
  )
}
