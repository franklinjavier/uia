import * as React from "react"

import {
  MergeConflicts,
  type MergeBranch,
  type MergeCommit,
  type MergeConflictFile,
  type MergeConflictsProps,
  type MergeConflictsState,
} from "@/components/blocks/merge-conflicts"

// Example: the MergeConflicts widget over a pull request whose base moved
// on. The widget is a pure view; this file is the fixture: three branches,
// Lena's key rotation landing on main after the PR opened, two files with
// the same lines changed, and a simulated merge that resolves them one by
// one, then merges the pull request.

export const BRANCHES: MergeBranch[] = [
  { id: "main", name: "main" },
  { id: "feat", name: "feat/session-refresh" },
  { id: "analytics", name: "feat/checkout-analytics" },
]

export const COMMITS: MergeCommit[] = [
  {
    sha: "5be27d",
    message: "Rotate session keys",
    author: "Lena",
    time: "6m",
    branch: "main",
    parents: ["4a7d21"],
  },
  {
    sha: "7e0c3b",
    message: "Add session refresh tests",
    author: "You",
    time: "12m",
    branch: "feat",
    parents: ["d29f50"],
  },
  {
    sha: "4a7d21",
    message: "Merge feat/checkout-analytics",
    author: "Sam",
    time: "20m",
    branch: "main",
    parents: ["9c2d4a", "c70a92"],
  },
  {
    sha: "d29f50",
    message: "Refresh sessions near expiry",
    author: "You",
    time: "24m",
    branch: "feat",
    parents: ["e83c51"],
  },
  {
    sha: "c70a92",
    message: "Add analytics consent banner",
    author: "Sam",
    time: "32m",
    branch: "analytics",
    parents: ["1f8e3b"],
  },
  {
    sha: "e83c51",
    message: "Read session expiry from the token",
    author: "You",
    time: "38m",
    branch: "feat",
    parents: ["9c2d4a"],
  },
  {
    sha: "1f8e3b",
    message: "Track checkout funnel events",
    author: "Sam",
    time: "52m",
    branch: "analytics",
    parents: ["9c2d4a"],
  },
  {
    sha: "9c2d4a",
    message: "Bump next to 16.3",
    author: "Lena",
    time: "3h",
    branch: "main",
    parents: ["62b0e4"],
  },
]

export const FILES: MergeConflictFile[] = [
  {
    path: "src/lib/auth.ts",
    ours: "d29f50",
    theirs: "5be27d",
    outcome: "Combined",
    note: "Sessions are verified with the rotated keys, then refreshed near expiry and signed with the current key.",
    hunks: [
      {
        ours: [
          "  const session = await verify(token, env.SESSION_KEY)",
          "  if (expiresSoon(session)) return refresh(session)",
        ],
        theirs: [
          "  const key = await keys.current()",
          "  const session = await verify(token, key, { previous: keys.previous() })",
        ],
        result: [
          { text: "  const key = await keys.current()", from: "theirs" },
          {
            text: "  const session = await verify(token, key, { previous: keys.previous() })",
            from: "theirs",
          },
          {
            text: "  if (expiresSoon(session)) return refresh(session)",
            from: "ours",
          },
        ],
      },
      {
        ours: [
          "  return sign({ ...session, exp: inHours(12) }, env.SESSION_KEY)",
        ],
        theirs: ["  return sign(session, await keys.current())"],
        result: [
          {
            text: "  return sign({ ...session, exp: inHours(12) }, await keys.current())",
            from: "new",
          },
        ],
      },
    ],
  },
  {
    path: "src/middleware.ts",
    ours: "e83c51",
    theirs: "5be27d",
    outcome: "Kept both",
    note: "Reads the session with rotation on and still sends the expiry header.",
    hunks: [
      {
        ours: [
          "  const session = await readSession(cookie)",
          '  res.headers.set("x-session-exp", String(session.exp))',
        ],
        theirs: [
          "  const session = await readSession(cookie, { rotate: true })",
        ],
        result: [
          {
            text: "  const session = await readSession(cookie, { rotate: true })",
            from: "theirs",
          },
          {
            text: '  res.headers.set("x-session-exp", String(session.exp))',
            from: "ours",
          },
        ],
      },
    ],
  },
]

export const PULL_REQUEST = {
  number: 128,
  title: "Refresh sessions in the auth middleware",
  head: "feat",
  base: "main",
  additions: 482,
  deletions: 37,
  branches: BRANCHES,
  commits: COMMITS,
  files: FILES,
} satisfies Omit<MergeConflictsProps, "state">

type PullRequest = typeof PULL_REQUEST

/**
 * The host side of the widget: merge the base in (a pending merge commit,
 * files resolved one at a time), then merge the pull request (a merge
 * commit on the base). Starts at `from` when the story already happened.
 */
export function useMergeSimulation(
  pr: Pick<
    PullRequest,
    "number" | "head" | "base" | "commits" | "files" | "branches"
  >,
  {
    from = "conflict",
    onMerged,
  }: { from?: MergeConflictsState; onMerged?: () => void } = {}
) {
  const name = (id: string) => pr.branches.find((b) => b.id === id)?.name ?? id
  const tip = (id: string) => pr.commits.find((c) => c.branch === id)?.sha ?? ""
  const resolveCommit: MergeCommit = {
    sha: "b41e07",
    message: `Merge ${name(pr.base)} into ${name(pr.head)}`,
    author: "You",
    time: "now",
    branch: pr.head,
    parents: [tip(pr.head), tip(pr.base)],
  }
  const mergeCommit: MergeCommit = {
    sha: "f08a3d",
    message: `Merge pull request #${pr.number} from ${name(pr.head)}`,
    author: "You",
    time: "now",
    branch: pr.base,
    parents: [tip(pr.base), resolveCommit.sha],
  }
  const all = pr.files.map((f) => f.path)

  const [state, setState] = React.useState<MergeConflictsState>(from)
  const [resolved, setResolved] = React.useState<string[]>(
    from === "conflict" ? [] : all
  )
  const timers = React.useRef<number[]>([])
  React.useEffect(() => () => timers.current.forEach(window.clearTimeout), [])
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const commits =
    state === "conflict"
      ? pr.commits
      : state === "merged"
        ? [mergeCommit, resolveCommit, ...pr.commits]
        : [{ ...resolveCommit, pending: state === "resolving" }, ...pr.commits]

  const resolve = () => {
    setState("resolving")
    all.forEach((_, i) =>
      later(1100 * (i + 1), () => setResolved(all.slice(0, i + 1)))
    )
    later(1100 * all.length + 400, () => setState("resolved"))
  }
  const merge = () => {
    setState("merging")
    later(900, () => {
      setState("merged")
      onMerged?.()
    })
  }

  return { state, commits, resolved, resolve, merge }
}

export function MergeConflictsExample() {
  const sim = useMergeSimulation(PULL_REQUEST)
  return (
    <MergeConflicts
      {...PULL_REQUEST}
      state={sim.state}
      commits={sim.commits}
      resolved={sim.resolved}
      onResolve={sim.resolve}
      onMerge={sim.merge}
    />
  )
}
