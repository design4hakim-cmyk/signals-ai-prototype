# CLAUDE.md · Signals AI prototype

Read this first. It's the brief for every session on this repo.

## What this is
A **frontend-only, high-fidelity prototype** of **Signals AI** (AlgoTest): a canvas strategy builder where traders build an entry/exit (by hand, with Copilot, or in Pine Script), prove the signals on a chart, backtest, then forward test and go live.
Dummy data only. **No backend, no real APIs, no auth.**

- Live: https://signals-ai-prototype.vercel.app (deploys from `main`)
- Every branch/PR gets its own Vercel preview link (posted on the PR by the vercel bot)

## Who you're working with
Hakim, lead product designer. **Not a developer.**
- Explain Git and code in plain words, with designer analogies (branch = duplicated page, commit = named version, PR = share for review).
- Make design decisions yourself. List them for review in the PR; don't block on questions.
- Be concise. Report what changed, the preview link, and what to check.

## Design source of truth
Canvas artifact **"Signals AI · All flows"**: https://claude.ai/artifact/6vqCncptxzd5mdqLviriWT
- Read its **Read me** notes first (in `project/canvas.json` → `notes`: `readme`, `rm0`–`rm4`).
- Board prefixes: `ST-` strategies & trade · `CP-` Copilot · `PN-` Pine panel · `BT-` backtest · `K` context + bottom bar · `U` update chart · `B`/`E` canvas builder.
- Component sheets (the spec for shared parts): `TopNav-Components`, `K12-bottom-bar-states`, `SetupBlock-Unified`.
- "Parking" boards are superseded. Ignore them.
- Boards can be 100–150 KB. Don't read them raw: save the HTML, then run `python3 -I scripts/board-outline.py <file.html>` to get text + key styles. List the unique text first; it contains the designer's annotations.

## Non-negotiable design rules
- **Brand blue `#0782DA`. NO PURPLE anywhere.** The canvas still shows purple for Copilot; the code overrides it. Copilot/AI tokens (`--color-ai-*`) use the blue family.
- **One filled-blue button on screen at a time.** Secondary = outlined blue. Navigation = segmented control (never filled blue).
- BUY = green, SELL = red. Used only on numbers, markers and position chips.
- Plain language in UI copy. Same components everywhere.
- Indian markets: NSE hours Mon–Fri 09:15–15:30 IST; ₹ with Indian grouping (`toLocaleString('en-IN')`). BTCUSD trades 24/7.

## Tokens and styling
- **All values live in `src/styles/tokens.css`** (Tailwind v4 `@theme`). Each token becomes a class: `--color-brand` → `bg-brand`, `--radius-card` → `rounded-card`.
- Tailwind's default palette is switched off (`--color-*: initial`). Add a token before using a new colour; never hard-code hex in components (the chart reads tokens via `getComputedStyle`).
- Fonts: IBM Plex Sans (UI), JetBrains Mono (code).

## Stack
React 19 + TypeScript + Vite · Tailwind v4 · Zustand · TradingView Lightweight Charts v5 · dnd-kit (canvas drag and drop) · Storybook 10 · oxlint.

## Where things live
```
src/
  styles/tokens.css        design tokens (edit here first)
  components/ui/           shared parts: Button, Popover, Select, SegmentedControl, Modal/Toast, icons
  features/
    top-nav/               TopNav-Components sheet
    context-bar/           K01–K10 (instrument, chart data dialog, timeframe)
    canvas/                canvas builder: blocks, AND/OR tree, menus, drag and drop (B02–B08, E01–E09)
    bottom-bar/            K11–K12 (chart/signals tabs, update chart, log, limits)
    chart/PriceChart.tsx   Lightweight Charts wrapper (+ entry/exit markers)
    backtest/              SetupBlock-Unified sheet
    copilot/               Copilot panel
    scenarios/             ◐ Scenarios switcher. PROTOTYPE ONLY review helper
  store/                   Zustand stores: canvas (conditions, selection, undo), workspace (chart + context), strategy (lifecycle, trades, mode), backtest (setups)
  mock/                    dummy data: seeded candles, instruments, example strategies, Copilot starters
  lib/                     pure logic: indicators (maths + labels), conditions (tree edits), signals (evaluates the tree + limits), describeChartData
```

## Behaviour already decided (keep consistent)
- **Chart pauses on any change** (strategy, instrument, chart data, timeframe, period). Only **Update chart · N changes** refreshes it. Limits apply instantly. (`applied` vs current inputs in `store/workspace.ts`.)
- Trade button is filled only when backtest results are current; otherwise outlined.
- Editing a setup outdates only that tab; a change on Build outdates every setup that ran.
- Run status and saved status never share a button (Run lives in the tab row, Save/Update setup in the header).
- Perpetual Future is crypto-only (disabled for indices with "Only for crypto").
- Mock data is seeded: same inputs → same chart and results.
- Every canvas edit goes through `commit` in `store/canvas.ts`: one change on Update chart, Saved → edited, ran setups outdated, Undo kept. A new block counts as ONE change however many slots you fill.
- The chart and counts use `useCanvas().applied` (the conditions at the last Update chart), never the live canvas.
- Add new review states to `features/scenarios/ScenarioPanel.tsx` so reviewers can jump straight to them.

## Workflow
1. Never commit to `main` directly. Create a branch (lowercase-with-hyphens, e.g. `phase-2-canvas-builder`), or keep adding to the open review branch if Hakim says so.
2. Small, named commits. End commit messages with the attribution lines your harness provides.
3. Push, then open or update the PR with: what's in it, **design decisions to review**, and how to review (preview link + which Scenarios to try).
4. Hakim reviews on the Vercel preview and merges. Don't merge for him unless asked.
5. **Only touch this repo.** Never push to his other repos (e.g. `Portfolio-website-V2`, `hakimsingh`).

Before pushing: `npm run build` (type-check + build) and `npx oxlint src` must pass. Click through changed flows in a browser (Playwright is available in cloud sessions) and look at screenshots.

## Commands
```
npm install            # once, and after adding libraries
npm run dev            # app at http://localhost:5173 (live reload)
npm run build          # type-check + production build
npm run storybook      # components at http://localhost:6006
npx oxlint src         # lint
```

## Phase plan
- ✅ 0 · Setup, tokens, first page (ST-Main)
- ✅ 1 · Context bar (K01–K10)
- ✅ 1.5 · Top nav, bottom bar, backtest setup block (component sheets)
- ✅ 2 · Canvas builder by hand (B02–B08, E01–E09: conditions, AND/OR, edit, group, drag with dnd-kit)
- ⬜ 3 · Copilot flow (CP-*: understood → question → building → applied; refine; edge cases)
- ⬜ 4 · Pine Script panel (PN-*: errors fixed in place)
- ⬜ 5 · Update chart flow polish (U01–U06)
- ⬜ 6 · Backtest screens (BT-*) + saved setups as tabs
- ⬜ 7 · Go live safely (ST-S14–S22: forward test first, then live)
- ⬜ 8 · My Strategies panel (ST-S03–S12)
