# uia

Design system for AI products (shadcn + Base UI). This repo is the source of
the components, the shadcn registry and the agent skill.

## UI: uia design system

Before building or changing any UI, read `skills/uia/SKILL.md` and follow it.
Start every screen from the closest example in `registry/examples/`.

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
- Layout: `registry/` is everything that ships (one shadcn registry item per
  piece), `playground/` is the demo app. Imports keep the consumer's paths
  (`@/components/ui/…` → `registry/ui/…`, `@/lib/…`, `@/examples/…`), mapped in
  `tsconfig*.json` and `vite.config.ts`.
- Nothing in `registry/` (outside `registry/examples/`) imports from
  `registry/examples/`; widgets take data via props, examples are fixtures.
- Prefer shadcn components (`bunx shadcn add <name>` lands in `registry/ui/`);
  customise the copied file when the look or motion must stay ours, and list
  it in `UI_OVERRIDES` in `scripts/registry.ts` so it ships as ours.
