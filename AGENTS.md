# uia

Design system for AI products (shadcn + Base UI). This repo is the source of
the components, the shadcn registry and the agent skill.

## UI: uia design system

Before building or changing any UI, read `skills/uia/SKILL.md` and follow it.
Start every screen from the closest example in `src/examples/`.

## Working in this repo

- `bun run dev` — playground with every example (`?bare` hides its chrome).
- After changing or adding a component, an example or the skill: add it to
  `ITEMS` in `scripts/registry.ts` if new, then `bun run registry:build`, and
  commit `registry.json` and `public/r/` with the change.
- Typecheck with `bunx tsc -p tsconfig.app.json --noEmit` (the root tsconfig
  checks nothing) and run `bun run lint`.
- Verify in the browser, light and dark. Example screenshots live in
  `skills/uia/examples/` (`<name>-{light,dark}.png`); retake them when an
  example changes.
- `src/components/` never imports from `src/examples/`.
