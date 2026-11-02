# Backtest results · spec

The **results area of the Backtest tab**, below the setup row. It replaces today's 4-number `ResultsPanel` with the full results page.

| File | Contents |
|---|---|
| `reference/bt-results.html` / `.jpg` | The full page, top to bottom, with real data |
| `reference/bt-results-states.html` / `.jpg` | Every state: page states, filters, chart hover, heatmap, Monte Carlo, trades table |
| `reference/algotest-results-source.pdf` | The current AlgoTest results page this was designed from (same data, old layout) |
| `mock-results.json` | All the data the page needs, ready to import |

**Extend, don't replace.**
- `src/features/backtest/ResultsPanel.tsx` already handles empty, running, outdated (faded) and failed. Keep that logic.
- Grow the "current" state into the full page below.
- Use tokens from `src/styles/tokens.css` and the shared `components/ui` parts.
- Numbers use `font-variant-numeric: tabular-nums`. ₹ uses Indian grouping (`toLocaleString('en-IN')`). Negatives are written `−₹24,700` (true minus sign).

---

## Page structure (main column, top to bottom, gap 14)

### 1. Results header
- **Left:**
  - "Results" (18/600)
  - meta line below: "NIFTY · 1Y · 03 Nov 2025 – 30 Oct 2026 · 246 trades" (12.5, muted)
- **Right:**
  - VIX filter chip
  - "Download report" (secondary button)

### 2. Headline numbers
- One card, a 6-column grid with 1px dividers.
- Each cell:
  - label: 12, muted, optional ⓘ
  - value: 22/600, coloured by sign (green above 0, red below 0, neutral otherwise)
  - sub-line: 11.5, muted

| Label | Value | Sub-line |
|---|---|---|
| Net P&L | −₹24,700 | −₹100.41 per trade |
| Win rate | 47.1% | 116 of 246 trades won |
| Max drawdown | −₹51,061 | over 194 days, peak to bottom |
| Return / Max DD ⓘ | −0.49 | Above 1 is healthy |
| Reward : Risk | 1.03 | Avg win ÷ avg loss |
| Expectancy ⓘ | −0.04 | Per ₹1 risked |

### 3. Equity curve (one card, one chart, shared time axis)

This replaces the PDF's two separate charts.

- **Top pane (~210px):**
  - cumulative P&L: `--color-brand`, 2px
  - NIFTY: grey `#9AA1AB`, 1.4px, on its own scale ("NIFTY scaled to the same chart")
  - y-axis in ₹K
- **Bottom pane (~96px), under a divider labelled "Drawdown":**
  - red line plus red area at 14% opacity
- **Max drawdown marker:**
  - a dot and the label "Max −₹51,061" at the bottom point;
  - a light red band and a bracket from 07 Nov 2025 to 19 May 2026: "Max drawdown · peak to bottom · 194 days".
- **Legend** in the card header: Cumulative P&L, NIFTY, Drawdown.
- **Hover:**
  - one dashed crosshair through both panes;
  - one tooltip showing the date, cumulative P&L, NIFTY, drawdown and day P&L.
- **When the in/out-sample split is set:** the out-of-sample part gets a `--color-brand-tint` background, with a dashed divider and the labels "In-sample" / "Out-of-sample".
- **Build it with Lightweight Charts**, as in the existing `PriceChart`, if two synced panes are practical. Otherwise use SVG.

### 4. Year-wise returns (heatmap)
- **Layout:** a table with Year, Jan–Dec, Total and Max DD columns.
- **Month cells:** 34px tall, radius 6, value written as "+20.1K" / "−14.5K" (12/600).
- **Cell colours:** three intensity steps by |value| ÷ the largest month.

  | | Light | Medium | Strong | Text |
  |---|---|---|---|---|
  | Profit | `#E3F4E8` | `#BFE5CB` | `#86CF9F` | `#1C6B37` |
  | Loss | `#F8DCDD` | `#F2B9BB` | `#EE9C9E` | `#9B1C1C` |

- **Months with no trades:** "–" on `#F7F8FA`, never "0".
- **Legend** in the card header.
- **Hover on a cell:** a tooltip with the month, its full ₹ value, trade count and win rate.

### 5. Detailed statistics ("All 17 numbers, grouped")

Three cards side by side. Each is a list of rows: label on the left, value on the right (13/600, coloured by sign), 1px separators.

- **Profitability:**
  - Overall profit
  - Average per trade
  - Average win
  - Average loss
  - Best trade
  - Worst trade
- **Consistency:**
  - a win/loss bar (green/red, 8px), with "47.15% won" / "52.85% lost"
  - Trades
  - Longest win streak
  - Longest losing streak
  - Reward : Risk ⓘ
  - Expectancy ⓘ
- **Risk:**
  - Max drawdown
  - Max drawdown period, with "07 Nov 2025 → 19 May 2026" underneath
  - Trades inside a drawdown ⓘ
  - Return / Max DD ⓘ

The ⓘ tooltips explain the jargon in one plain sentence (the copy is in the reference).

### 6. Robustness ("Is this result luck or curve-fitting?")

Two cards side by side.

- **Monte Carlo drawdown:**
  - Contents: an explanation line, a confidence slider (1–99, default 95), and a "Run 10,000 simulations" secondary button.
  - States: idle → running (progress bar, "Simulating… 6,200 of 10,000") → result.
  - The result shows a histogram, with bars beyond the confidence line in red, and a red note: "With 95% confidence the max drawdown stays above −₹68,400, 1.3× the backtest's −₹51,061. Plan capital for the deeper number."
- **In-sample vs out-of-sample:**
  - Contents: an explanation line, a split selector (70 / 30) with the two date ranges, and a 4-row comparison table (Net P&L, Win rate, Max drawdown, Expectancy).
  - A verdict note in `--color-brand-tint`.

### 7. Trades
- **Card header:**
  - "Trades"
  - sub-line: "246 trades · click a trade to see its legs"
  - Sort chip (menu: Date / P&L / VIX, then Oldest first / Newest first)
  - "Download trades"
- **Trade row:** chevron, #, date, entry time, exit time, "2 legs · Short straddle", VIX, P&L (right-aligned, coloured).
  - Hover: `--color-surface-selected`.
- **Expanded trade:** a nested legs table underneath, with columns Type (CE/PE grey chip), Strike, Side (SELL red chip / BUY green chip), Qty, Entry ₹, Exit ₹, Exit time, P&L.
- **Footer:**
  - "Showing 1–10 of 246 trades"
  - Prev / page numbers / Next; the current page uses the menu-current tint.

## VIX filter (replaces "Select VIX range · Re-calculate")
- **Chip:** "Filter · VIX 0 – 150".
- **Popover:**
  - "Only count trades when VIX is between [12] and [20]"
  - a live count: "158 of 246 trades match"
  - Reset (tertiary) · Apply (outlined blue)
- **Applied:** the chip turns blue-tinted ("VIX 12 – 20"), and every number on the page recalculates from the filtered trades, with no re-run.

## Page states (keep the existing ResultsPanel logic)

| State | Look |
|---|---|
| Running | A skeleton of the same layout plus one progress line: "Running backtest · 112 of 246 days". No spinner. |
| Out of date | After an edit on Build or in the setup: the results stay, faded. Banner: "Strategy changed · these results are from the previous version" + **Update backtest** (outlined blue). The top nav's Trade turns outlined (existing rule). |
| No trades | A dashed card: "No trades in this period" + reason + Change period / Go to Build. |
| Failed | A red banner with the reason in words ("data for 12 Mar 2026 is missing. Results stop at 11 Mar.") + Try again. Partial results are kept. |

## Copilot panel (right)

The result card "Backtest ready · Short Straddle" contains:
- a mini summary: Net, Win, Max DD;
- one plain-language insight about the results;
- 3 follow-up chips.

The copy is in the reference.

## Data

Use `mock-results.json`. Its fields:

| Field | Contents |
|---|---|
| `stats` | All 17 statistics |
| `yearWise` | Months, total and max DD per year |
| `equity` | 260 days of cumulative P&L, drawdown, NIFTY and day P&L |
| `trades` | The first 10 trades, with their legs |
| `inOutSample` | Placeholder figures |
| `monteCarlo` | Placeholder figures |
| `vixFilter` | Placeholder figures |

The statistics and trades are the real figures from the PDF. For pages 2–25 of the trades table, generate seeded trades with the same shape.
