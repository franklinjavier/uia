# Examples

Complete, working widgets built by the designer. **Before building anything,
open the closest one and copy its structure**: anatomy, panel split,
spacing, which `ds/` pieces carry the data, how the list links to the
visual. Then change the content. Matching an example is how a new screen
ends up looking like the same person made it.

Install them (they land in `src/examples/`, with every piece they use):

```bash
npx shadcn@latest add franklinjavier/uia/examples            # all five
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
| Model router | `example-model-router` | number + `Segmented` policy, flow graph linked to a list, inline controls in a sentence (Fallback if … retry on …), deploy with states | configuration with a preview, routing, A/B, policies |
| Agent runtime | `example-agent-runtime` | small number of things with state, illustration that highlights the focused thing, list rows with badge + countdown, select → act | resources with lifecycle (jobs, agents, sandboxes, workers) |
| Assistant | `example-assistant` | agent chat in a widget: thread + composer in one panel, scripted tools, questions → draft → approval | any chat, assistant or generative-UI surface |

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
