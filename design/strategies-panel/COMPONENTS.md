# My Strategies panel · component spec

The source of truth is the two canvas boards in `reference/`. Each comes as `.html` (open it in a browser) and as `.jpg`.

| File | Contents |
|---|---|
| `st-components.html` | 0 Analysis (decisions and why) · 1 Atoms · 2 Molecules · 3 Panel variants |
| `st-behaviour.html` | 1 Behaviour flows · 2 Edge cases · keyboard |

This replaces the older `ST-S03`–`ST-S12` boards where they differ. Those boards still show the overall flow: peek, pin, open a strategy. Use the same tokens as the rest of the app (`src/styles/tokens.css`); the colours below already exist there or in `design/canvas-builder/atom-states.ts`.

---

## What changed from the old panel
- **Removed:**
  - dates (created and last updated);
  - the "Draft" chip, since everything in this panel is saved.
- **Added:**
  - running counts;
  - a Trade button on hover;
  - a ⋯ menu;
  - inline rename;
  - delete with a confirmation, blocked while anything is running.
- **Rows are rounded and inset.** Every row has its own radius and sits 6px inside the panel, so hover, pressed and focus fills follow the corner curve and never run square into a rounded edge.
- **An expanded index is a soft tinted card.** There are no connecting lines or dots between strategies, because they are independent and lines would read as a sequence.

## Layout
- **Panel:** width 290 (unchanged).
- **Header (56px):** folder icon, "My Strategies" (15/600), and pin/unpin icon button.
- **Search bar:** padding 12 14; field 38px tall, radius 8.
- **List:** padding 6, gap 2.
- **Footer:** "+ New strategy" secondary button, full width, 34px.
- **Modes:**

  | Mode | Look |
  |---|---|
  | Pinned | 1px `#ECECEF` border, sits beside the builder |
  | Peek | Opens on hovering the folder icon; floats with shadow `16px 0 40px rgba(20,22,28,.16)` |

## Atoms

| Atom | Spec |
|---|---|
| Index icon | 30×30, radius 7. The instrument's own **logo** from instrument data (AlgoTest's icon set). Fallback: the first letter, 12/700, on the symbol's tint (NIFTY `#E8EEFC`/`#2F4FB8`, SENSEX `#E6EEFB`/`#2B5FB0`, ETH `#1D1F24`/`#FFF`, BTC `#FDEEDD`/`#B45309`, GROWW `#E3F5EE`/`#1C7A5A`, ASIANPAINT `#FDE8EA`/`#B4232F`). |
| Running chip · Live | `● N Live`: 18px tall, radius 5, `#EAF6EE` bg, `#2F8A4E` text and dot, 11/600. **Information only: no hover, no click.** |
| Running chip · FT | `N FT` (forward test): `#EEF5FC` bg, `#0A5FA3` text. Tooltip: "N forward test(s) running". Short form is for this panel only. |
| Trade button | 26px, radius 6, outlined blue: white bg, 1px `#0782DA`, blue 12/600 text. Hover `#F4F8FD`; pressed `#E6F3FB` + `#05609F`; focus ring; disabled grey. Outlined so it never competes with the page's one filled-blue action. |
| ⋯ button | 26px, transparent. Hover `#F1F2F4`, pressed `#E9EBEE`, open `#E6F3FB` + blue, focus ring. |
| Search field | 38px, radius 8, 1px `#E4E6EA`. Hover `#B9C0C9`; focus ring. A clear (×) button appears once there's text. |
| Name field (rename) | 28px, radius 6, focus ring, hint "Enter to save · Esc to cancel". Errors: "A NIFTY strategy already has this name" / "Name can't be empty". Red field + icon + message. |

## Molecules

### Strategy row
- **Content:** the name (13/500, wraps to 2 lines, then "…" with the full name on hover).
- **Running chips** go underneath, only when something runs.
- **Not running:** the name only.
- **Layout:** radius 6, min-height 40, padding `7 8 7 48` (44 inside an expanded card), so names line up with the index name.
- **Trade and ⋯** sit on the name line, at the right. The chips get the full width below.

| State | Look |
|---|---|
| Default | Transparent |
| Hover | `#F1F2F4` + Trade + ⋯ |
| Pressed | `#E9EBEE` |
| Focused (keyboard) | `inset 0 0 0 2px #0782DA` (follows the radius) + Trade + ⋯ |
| Open in builder | `#EEF5FC` bg, name in `#0A5FA3` |
| Open + hover | The same, plus Trade + ⋯ |
| Open · unsaved changes | + 6px blue dot after the name |
| ⋯ open | Hover look, ⋯ in its open state |
| Renaming | `#F1F2F4` bg, name field in place of the name |
| Rename error | The same, with the field's error state |

### Index row
- **Content:** icon, symbol (14/500; 600 when expanded), "N Strategies" / "1 Strategy" (12, `#7D838C`), chevron.
- **Layout:** radius 8, padding `10 8`.
- **States:** hover `#F1F2F4`, pressed `#E9EBEE`, focused inset ring, expanded.

### Expanded index
- **Card:** `#F7F8FA` bg, radius 8.
- **Header:** the index row.
- **Strategy rows** below it in a padding `0 4 4` list (gap 2), last edited first.
- **Several indexes** can be open at once.

### ⋯ menu (popover, 220w)
- Open in builder ↵
- Trade…
- —
- Rename F2
- Duplicate ⌘D
- —
- Delete ⌫ (red)

**While anything is running:** Delete is disabled, with "Stop its N running trades first".

### Delete confirm (popover, 250w, anchored to ⋯)
- **Title:** "Delete "{name}"?"
- **Body:** "Its saved setups and backtest results go too. This can't be undone."
- **Buttons:** Cancel (secondary) · Delete (destructive).

### Toasts
- "Renamed to "…"" · Undo
- "Deleted "…""
- "Duplicated as "… copy""
- "Live trade started · {name}"

## Panel variants
- Pinned
- Peek
- Search results: indexes with matches open by themselves; the match is **bold**, never a blue fill.
- No results: "No strategy called "xyz"" + hint.
- Empty: "No saved strategies yet".
- Loading: skeleton rows.

## Behaviour
- **Expand or collapse:** click the index row, or → / ←.
- **Trade:**
  1. Use the row's Trade button or ⋯ → Trade….
  2. It opens the **existing Trade popup** (Live / Forward test, choose setups), the same one as the top nav's Trade.
  3. It also works on a strategy that already runs, adding one more.
  4. Afterwards the counts update and a toast confirms.
- **Rename:**
  - Start from ⋯ → Rename, F2, or a double-click on the name.
  - Enter saves; Esc or clicking away cancels.
  - Names must be unique within an index; empty is refused.
  - Renaming the open strategy updates the builder title at once.
- **Delete:**
  1. Start from ⋯ → Delete or ⌫.
  2. Confirm in the popover.
  3. The row goes and the index count updates.
  4. Deleting the last strategy of an index removes the index row.
  5. Blocked while live or forward tests run.
- **Open in builder:** click the name. The row turns blue; a peeking panel closes, a pinned one stays.
- **Running counts are live:** starting or stopping a trade anywhere updates the chips at once. A chip disappears at 0.
- **Keyboard:**
  - ↑ ↓ move
  - → ← expand or collapse
  - Enter opens
  - F2 renames
  - ⌘D duplicates
  - ⌫ deletes (with the confirm)
  - / focuses search

## Data needed (mock)
`Strategy { id, name, indexSymbol, updatedAt (for ordering only, not shown), live: number, forwardTests: number }` and `Index { symbol, logoUrl? }`.
