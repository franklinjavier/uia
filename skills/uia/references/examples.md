# Examples

Complete, working widgets built by the designer (widgets and one page). **Before building anything,
open the closest one and copy its structure**: anatomy, panel split,
spacing, which `ds/` pieces carry the data, how the list links to the
visual. Then change the content. Matching an example is how a new screen
ends up looking like the same person made it.

Install them (they land in `src/examples/`, with every piece they use):

```bash
npx shadcn@latest add franklinjavier/uia/examples            # all of them
npx shadcn@latest add franklinjavier/uia/example-ai-spend    # one
```

Then render one on a scratch route and look at it, light and dark. That is
your visual reference. Screenshots are also in the uia repo under
`skills/uia/examples/<name>-{light,dark}.png`
(`https://github.com/franklinjavier/uia/tree/main/skills/uia/examples`).

| Example | Item | Shows | Reach for it when building… |
| --- | --- | --- | --- |
| AI spend | `example-ai-spend` | number vs limit, `MeterBar` with markers, projection, alert line with new info, list as legend with hover | budgets, quotas, usage, any "how much of X" |
| Fleet health | `example-fleet-health` | big live number + delta + `Sparkline`, row of three `TickMeter` stats, heatmap with tooltip, view modes (`Segmented`), focus, an action that changes the data | monitoring, infrastructure, live metrics, grids of things |
| Ground station | `example-ground-station` | drag-to-turn wireframe globe with orbits (front solid, back dashed), the night side shaded for volume, satellites as a small glyph along their heading, a recenter button only once turned, "in view" stat, sky plot of the pass (dashed when upcoming, live in `success`), countdown or live Mbps, onboard `MeterBar`, satellites as `WidgetListRow`s with a 3 h pass timeline + `StatusBadge`, station `Select` with mono coordinates, UTC clock ×60 in the footer and a Book CTA that books the next pass (never the one under way); switching station says "Tracking from …" where the clock is, for a moment (no toast); out-of-view rows use a hollow dot; phones drop the timelines | live tracking of things moving over a place (satellites, fleets, deliveries), any widget with a spatial view + a list of upcoming windows |
| Model router | `example-model-router` | number + `Segmented` policy, flow graph linked to a list, inline controls in a sentence (Fallback if … retry on …), deploy with states | configuration with a preview, routing, A/B, policies |
| Agent runtime | `example-agent-runtime` | small number of things with state, illustration that highlights the focused thing, list rows with badge + countdown, select → act | resources with lifecycle (jobs, agents, sandboxes, workers) |
| Model evals (pt-BR) | `example-model-evals` | number vs a baseline *and* a target (`MeterBar` with `min` to zoom), per-row comparison bars with a baseline tick, click a row to filter a second list, re-run with states, Brazilian formatting | quality, scores, A/B results, anything compared to a previous version |
| Bottega (page, pt-BR) | `example-bottega` | a full page: header with scope select, "needs you" strip of `DecisionChip`s, projects by `Stepper`, production with `Sparkline` + health badges, activity log, conversation rail where decisions are answered (`Confirmation` with own labels, `PreviewApproval`), the page reacting to each decision | dashboards, workspaces, any page with an agent beside it |
| davinci (app) | `example-davinci` | an agent coordinator as an app: side nav with counts and route per view, an inbox of decisions grouped Now / Today / Can wait (each card self-contained: context, davinci's pick, "If you go with davinci:" consequence; the urgent one in `tone="attention"`), a pinned "Now" bar, answered cards that sink into "Answered today" while the rest glide up (Undo plays it back), threads per project, projects by `Stepper` that scale to dozens of tasks (busy simulation), "Decided for you" log with why + Undo, rules as switches, task detail in a side panel / sheet. Also the one-chat version it replaced (`davinci.tsx`) for contrast | products where an agent works for someone and needs their judgment: coordinators, ops consoles, review queues, anything with "decisions waiting" |
| davinci, agent-composed | `example-davinci-surface` | the davinci inbox as A2UI messages an agent sends: patterns only (`DecisionCard`, `Confirmation`, `ActivityItem`, `Policy`), every fact bound to the factory data, a host action registry deciding Irreversible/Undo; compare with `example-davinci` (hand-made) | agent products where screens are generated from live data: inboxes, logs, rule lists |
| Agent-built screen | `example-surface` | screens an agent assembles for the moment (A2UI messages against the uia catalog): a cost & quality dashboard (Grid of Sections, Stat, Meter with segments, Sparkline, List template, BarSeries, DecisionCard) and an incident view (Note, Stats, Table, Plan, Confirm); streamed in with skeletons; actions come back as named events; the spec is visible | any screen whose content depends on the question: ad hoc dashboards, reports, comparisons, incident views |
| Assistant | `example-assistant` | full-page agent chat that starts closed as a breathing `ChatPill` and morphs open; scripted tools; scenarios: research (search → sources → approval), draft (questions → editable draft), code, **metrics** (chart in the reply → `Plan` updating in place → `ConnectPrompt` above the composer → error with retry on another model), **deck** (PDF attachment with hover summary → `Findings` with page refs); Search/Think toggles that light while used; Regenerate; New chat; Minimise morphs back to the pill | any chat, assistant or generative-UI surface |

`?scenario=draft` style autostart and `?bare` are playground conveniences;
you don't need them in a real app.

## What to copy, what to change

- **Copy:** the panel split, header/footer anatomy, the order inside the
  hero (label → number → meta → visual), column patterns, interaction
  model, motion, and every class that isn't content.
- **Change:** data, labels, units, which visual (pick from
  `grammar.md` §4 by the question the number answers), the action.
- **Don't add** controls, panels or colours the examples don't have
  unless the request needs them; that's where screens stop looking related.
