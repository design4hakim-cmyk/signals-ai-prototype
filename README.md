# Signals AI · Prototype

A working frontend prototype of **Signals AI** (AlgoTest). Dummy data, no backend.
Design source: the "Signals AI · All flows" canvas. Every screen here maps to a board there.

## The stack, in plain words

| Tool | What it does for us |
|---|---|
| **React + TypeScript** | React builds the UI from components (like Figma components). TypeScript checks we pass the right "props" into them. |
| **Vite** | Runs the app on your laptop and bundles it for the web. |
| **Tailwind** | Styling with small classes (`bg-brand`, `rounded-card`). All values come from our tokens. |
| **Zustand** | Shared state: instrument, timeframe, chart open/closed. Like prototype variables. |
| **Lightweight Charts** | TradingView's candlestick chart. |
| **dnd-kit** | Drag and drop for canvas blocks (from phase 2). |
| **Storybook** | A workshop that shows each component alone, in all its states. |
| **Mock data** (`src/mock`) | Fake candles and Copilot content, so nothing needs a server. |

## Where things live

```
src/
  styles/tokens.css     ← design tokens (edit colours, type, radius here)
  components/ui/        ← shared building blocks (Button, icons)
  features/             ← product areas: workspace, canvas, chart, copilot, bottom-bar
  mock/                 ← dummy data
  store/                ← shared state (Zustand)
  types/                ← names and shapes of our data
```

## Run it on your laptop

1. Install **Node.js** (LTS) from nodejs.org. One time only.
2. Open the project folder in a terminal (or VS Code → Terminal).
3. `npm install` – downloads the libraries (one time, and after new ones are added).
4. `npm run dev` – opens the app at http://localhost:5173. Edits show up instantly.
5. `npm run storybook` – opens Storybook at http://localhost:6006.

Stop either one with `Ctrl + C`.

## Phases

- **Phase 0** ✅ Repo, tokens, first page live: board *01 · Empty state · chart open* (+ chart collapse, board 02)
- **Phase 1** ✅ Context bar: Instrument, Chart data (Spot / Option / Perpetual / Synthetic / Combined premium), Timeframe — boards K01–K10
- **Phase 1.5** ✅ Top nav (zones, save/rename, ⋯, mode switch, period, running trades, trade dialogs) · Bottom bar (chart/signals, Update chart, log, limits, all states) · Backtest setup block (5 layers, states, popovers)
- Phase 2: Canvas builder by hand (conditions, AND/OR, edit, group, drag)
- Phase 3: Copilot flow (understood → question → building → applied), edge cases
- Phase 4: Prove the signals: Update chart, counts, limits, signal log
- Phase 5: Backtest + setup tabs · Phase 6: Forward test / Live · Phase 7: My Strategies

## Reviewing states: the ◐ Scenarios button

Top right of the Copilot header (prototype only). It jumps the app into states from the component sheets: Top nav A–K, Bottom bar 1–9, Setup block 1–9. It exists because the canvas builder isn't coded yet.

## Design rules carried from the canvas

- Primary blue `#0782DA`, one main action per screen.
- Copilot / AI uses the same blue family. **No purple** (the canvas boards still show it; code overrides).
- BUY = green, SELL = red.
- Same components everywhere; plain language.
