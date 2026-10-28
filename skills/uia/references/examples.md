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
| Purchase orders + Filter | `example-purchase-orders` | **PurchaseOrders:** status `Segmented` with mono counts (a `Select` on phones), removable date chip, supplier `Select`, search that opens from an icon; rows as a schedule — placed → delivery, `brand` fill as far as billed, dashed outline while pending, a ring for delivery, one dashed "Today" line and week lines drawn once behind the rows, legend under it; checkboxes turn the footer into bulk actions. **BillsFilter:** due-date chips that read "Sep 1" over the native picker, an amount range over its histogram (bars lit inside the range, sqrt scale), "Overdue only" switch, document types with counts, "Show N bills" counting live, Reset once changed | any list of records over time with bulk actions; any filter panel (show the distribution you are cutting, count the result on the button) |
| Koi pond | `example-koi-pond` | an ASCII backdrop: koi as small blocks in the ink with patches in one colour, eyes punched out, whiskers and fins as strokes, swimming on a cell grid under a typed line; click drops food, rings spread in ASCII and the nearest koi turn for it; the corner counts what was eaten | landing and empty pages, a hero behind a short line; never inside a widget |
| Ocean | `example-ocean` | an ASCII backdrop of predators and prey: bait fish as single strokes that school and scatter, predators shaded with a glyph ramp (sparse where the light falls, dense in shadow); sharks are shaded tiles (a few in the shark's own muted hues, shifting slowly) with a tail wave, swept-back pectorals, a dorsal line, gill slits and a forked tail, every second one a hammerhead, turning wide and lunging at stragglers; a piranha pack with fins in one colour; click drops a school for the sharks, or blood for the piranhas, which go into a frenzy and tear through it; the corner counts what was eaten | the same places as the koi pond: landing, empty and error pages, behind a short line |
| Merge conflicts | `example-merge-conflicts` | a pull request behind its base: branches as a commit graph drawn row by row (one lane per branch, curves only where a branch forks or merges, so lines stay aligned as rows arrive), the base commit that touched the same lines tagged, conflicting files as a list linked to the graph (hover dims the other commits), each file opening to both sides with a bar in its branch colour, then the resolved lines coloured by origin; one verb at a time in the footer (Merge main and resolve → Merge pull request); the merge commit arrives dashed and shimmering, files resolve one by one. Also answered in the Assistant (`?scenario=merge`) at `size="sm"` | code review, CI, any agent that fixes something in the person's repo and needs a go-ahead; any history with branches |
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
