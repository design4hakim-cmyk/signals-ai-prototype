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
- Component sheets (the spec for shared parts): `TopNav-Components`, `K12-bottom-bar-states`, `SetupBlock-Unified`, `Builder-Atoms`, `Builder-Atoms-2`, `Builder-Behaviour`, `Builder-Behaviour-2`, `ST-Components`, `ST-Behaviour`, `BT-Results`, `BT-Results-States`, `CP-Components`, `CP-Components-2`, `CP-Flows`, `CP-Flows-2`, `CP-Build-Fixes`, `PN-Components`, `PN-Components-2`, `PN-Flows`, `PN-Flows-2`, `PN-Errors`, `CP-Conversations`.
- **Canvas builder kit: `design/canvas-builder/`.** Read `COMPONENTS.md` there before any canvas builder work. It is the written spec for the `Builder-Atoms` and `Builder-Behaviour` sheets, with reference images and a token mapping. It supersedes the older `B`/`E` boards where they differ (e.g. All of / Any of / None of instead of AND/OR, checkbox selection instead of ⋯ → Select). **Key rule: every canvas element has two layers — its own look (grey / red error / violet Copilot / dashed empty) and a separate Figma-like editor layer of blue rings outside the border (hover, pressed, selected, focus, drop target). Interaction never changes the element's own fill or border. Preview mode hides the editor layer.**
- **My Strategies panel kit: `design/strategies-panel/`.** Read `COMPONENTS.md` there before any work on the saved-strategies side panel. It supersedes `ST-S03`–`ST-S12` where they differ (no dates, no Draft chip, Live / FT counts, Trade on hover, rename, delete).
- **Backtest results kit: `design/backtest-results/`.** Read `COMPONENTS.md` there before any work on the backtest results area. It grows the existing `ResultsPanel` into the full results page (headline numbers, equity + drawdown chart, year-wise heatmap, grouped statistics, robustness checks, trades table) and comes with `mock-results.json`.
- **Copilot kit: `design/copilot/`.** Read `COMPONENTS.md` there before any Copilot work. It supersedes the `CP-*` boards where they differ (one AI card that changes state in place, violet only for what Copilot made, outlined-blue card actions, review before changing user blocks, fit decided before building). **`design/copilot/FIXES.md` lists what the current build gets wrong; fix those first.** Chat history and how chats map to strategies: `design/copilot/CONVERSATIONS.md` (decided 4 Nov: a chat belongs to one strategy; reopening a strategy opens its last chat; the clock icon is chat history, there is no strategy version history).
- **Pine Script editor kit: `design/pine-editor/`.** Read `COMPONENTS.md` there before any Pine Script work. Pine Script is the source; the canvas and chart are views of the last code that ran. It stays inside the Copilot panel (Pine Script view). Canvas edits patch code silently; code edits reach the canvas only on Run; Discard throws away only what hasn't run; no bars or toasts, a status line instead. It supersedes the `PN-*` boards and the read-only Pine view.
- "Parking" boards are superseded. Ignore them.
- Boards can be 100–150 KB. Don't read them raw: save the HTML, then run `python3 -I scripts/board-outline.py <file.html>` to get text + key styles. List the unique text first; it contains the designer's annotations.

## Non-negotiable design rules
- **Brand blue `#0782DA`.** Violet is reserved for **Copilot provenance only** (✦ badge + violet on things Copilot added or changed), never for hover, focus or decoration (decided 2 Nov after the design-system review; this replaces the earlier "no purple" rule). Update `--color-ai-*` in `tokens.css` to the violet set in `design/canvas-builder/atom-states.ts` when you next touch Copilot UI.
- **One filled-blue button on screen at a time.** Secondary = outlined blue. Navigation = segmented control (never filled blue).
- BUY = green, SELL = red. Used only on numbers, markers and position chips.
- Plain language in UI copy. Same components everywhere.
- Indian markets: NSE hours Mon–Fri 09:15–15:30 IST; ₹ with Indian grouping (`toLocaleString('en-IN')`). BTCUSD trades 24/7.

## Tokens and styling
- **All values live in `src/styles/tokens.css`** (Tailwind v4 `@theme`). Each token becomes a class: `--color-brand` → `bg-brand`, `--radius-card` → `rounded-card`.
- Tailwind's default palette is switched off (`--color-*: initial`). Add a token before using a new colour; never hard-code hex in components (the chart reads tokens via `getComputedStyle`).
- Fonts: IBM Plex Sans (UI), JetBrains Mono (code).

## Stack
React 19 + TypeScript + Vite · Tailwind v4 · Zustand · TradingView Lightweight Charts v5 · dnd-kit (canvas builder, upcoming) · Storybook 10 · oxlint.

## Where things live
```
src/
  styles/tokens.css        design tokens (edit here first)
  components/ui/           shared parts: Button, Popover, Select, SegmentedControl, Modal/Toast, icons
  features/
    top-nav/               TopNav-Components sheet
    context-bar/           K01–K10 (instrument, chart data dialog, timeframe)
    canvas/                strategy canvas (static preview until the builder phase)
    bottom-bar/            K11–K12 (chart/signals tabs, update chart, log, limits)
    chart/PriceChart.tsx   Lightweight Charts wrapper (+ entry/exit markers)
    backtest/              SetupBlock-Unified sheet
    copilot/               Copilot panel
    scenarios/             ◐ Scenarios switcher. PROTOTYPE ONLY review helper
  store/                   Zustand stores: workspace (chart + context), strategy (lifecycle, trades, mode), backtest (setups)
  mock/                    dummy data: seeded candles, instruments, Copilot starters
  lib/                     pure logic: signals (EMA 9×21 + limits), describeChartData
```

## Behaviour already decided (keep consistent)
- **Chart pauses on any change** (strategy, instrument, chart data, timeframe, period). Only **Update chart · N changes** refreshes it. Limits apply instantly. (`applied` vs current inputs in `store/workspace.ts`.)
- Trade button is filled only when backtest results are current; otherwise outlined.
- Editing a setup outdates only that tab; a change on Build outdates every setup that ran.
- Run status and saved status never share a button (Run lives in the tab row, Save/Update setup in the header).
- Perpetual Future is crypto-only (disabled for indices with "Only for crypto").
- Mock data is seeded: same inputs → same chart and results.
- Add new review states to `features/scenarios/ScenarioPanel.tsx`, since many states can't be reached by clicking until the canvas builder exists.

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
- ⬜ 2 · Canvas builder by hand: build from `design/canvas-builder/COMPONENTS.md` (atoms, blocks, All of / Any of / None of groups, checkbox selection, menus, drag with dnd-kit). B02–B08 and E01–E09 show the flow; the kit wins where they differ.
- ⬜ 3 · Copilot flow: build from `design/copilot/COMPONENTS.md` (understood → question → building → applied; refine and sync; edge cases). CP-* boards keep the copy; the kit wins where they differ.
- ⬜ 4 · Pine Script editor: build from `design/pine-editor/COMPONENTS.md` (real code editor, two-way sync with the canvas, session Discard, errors fixed in place with AI, code the canvas can't draw). First apply `design/copilot/FIXES.md`.
- ⬜ 5 · Update chart flow polish (U01–U06)
- ⬜ 6 · Backtest screens (BT-*) + saved setups as tabs. Results area: build from `design/backtest-results/COMPONENTS.md`.
- ⬜ 7 · Go live safely (ST-S14–S22: forward test first, then live)
- ⬜ 8 · My Strategies panel: build from `design/strategies-panel/COMPONENTS.md` (ST-S03–S12 show the flow; the kit wins where they differ)
