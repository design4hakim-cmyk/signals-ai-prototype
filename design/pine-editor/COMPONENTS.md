# Pine Script editor · spec

The source of truth is the five canvas boards in `reference/`. Each comes as `.html` (open it in a browser) and `.jpg`.

| File | Contents |
|---|---|
| `pn-components.html` | 0 How it stays in sync · 1 Atoms · 2 Molecules |
| `pn-editor-and-canvas.html` | 3 The editor in every state · 4 What your code turns into on the canvas |
| `pn-sync-flows.html` | Edit → Run → canvas · build by hand → code follows silently · Copilot in code · Discard changes |
| `pn-cant-draw-and-edge-cases.html` | Partly fits → Custom logic block · code only · closed before running · conflict · nothing to update · no entry |
| `pn-errors-fixed-in-place.html` | 1A typo · 1B fixed + Undo · 1C needs you · 2A many problems · 2B review all · 2C one by one · 3 not supported |

This replaces the `PN-*` boards (PN-Main, PN-S1-*, PN-S2-*, PN-S3-*) and the read-only Pine view in `design/copilot`. The PN boards keep their copy; this kit wins where they differ.

**Extend, don't replace.**
- `src/features/copilot/PineView.tsx` becomes the editor.
- `src/lib/pine.ts` already writes code from the canvas. Keep it as the canvas → code direction. Add the code → canvas direction (see "Parsing").
- Canvas pieces come from `design/canvas-builder`. Copilot pieces come from `design/copilot`.

---

## 0 · The sync model (read this first)

There is one strategy and three views of it. **The Pine Script is the source.** The canvas and the chart are views of the last code that ran.

| When | What happens |
|---|---|
| **You build on the canvas** (add, edit, delete, move, group) | The matching code is written straight away, **silently**: no bar, no toast, no highlight, no log line. If the editor is open, the lines just appear. The status stays "In sync with canvas". Use `pine.ts` as it is: All of → `and`, Any of → `or`, None of → `not (…)`. |
| **You type in the editor** | Only the code changes. The status turns "Edited · not run". Edited lines get a 2px `--color-brand-border` bar at the gutter. Discard and Run turn on. Canvas and chart wait. |
| **You press Run** (or ⌘↵) | The code compiles. **No errors:** the canvas redraws to match the code (blocks added, changed, removed), the chart refreshes, the status goes back to "In sync", and the log says "Canvas and chart updated · 1 block changed". The canvas shows a toast "Updated from your code · …" + Undo, with the `</>` icon (not ✦, because you made this change). **Errors:** nothing moves, and the AI fixes appear in place (section 4). |
| **Code the canvas can't draw** | This is decided at Run, line by line. Lines that fit become normal blocks. A line that doesn't fit becomes one grey **Custom logic** block: "RSI was below 40 in the last 10 candles · Open line 7". If the structure itself can't be drawn (memory between candles: `var`, `:=`), the canvas shows one **Runs from Pine Script** card instead of blocks, and adding blocks by hand is turned off. It is never shown as an error. |
| **Copilot changes things** (from the chat, or the Ask box under the editor) | Canvas and code change together. Copilot's lines get the violet fill + 2px `--color-ai` bar, a "Copilot changed 2 lines · volume filter · Undo" bar shows, and the code runs by itself. The Copilot rules still apply: adds apply straight away; changes to your blocks wait for Apply. |
| **Discard changes** | Goes back to exactly how the strategy was **when you opened the editor**. That covers your typing, AI fixes and Copilot changes made since then; canvas, code and chart all follow. It is off until something has changed since opening. It shows the toast "Discarded 3 changes · Back to when you opened the editor" + Undo. |
| **You close the editor** | Code that ran stays. Code that hasn't run is kept as a draft, and the Pine Script toggle shows a 6px blue dot ("Code not run yet"). Reopening shows the draft with the banner "Draft · not run yet". |

### The session snapshot (Discard)
- **Opening the editor** (turning on the Pine Script toggle) saves a snapshot: `{ code, canvas tree, chart applied state }`.
- **Discard changes is on** when anything differs from that snapshot, whatever made the change (you, an AI fix, Copilot, or the canvas while the editor was open).
- **Discard restores the snapshot**, as one undo step. Undo in the toast brings the changes back.
- **The snapshot resets** only when you close and reopen the editor. Run does not reset it: after Run, Discard still goes back to the moment you opened the editor.
- **Hover tooltip:** "Back to when you opened the editor · N changes".

### Status chip (editor toolbar, always the current truth)

| Chip | Colours | When |
|---|---|---|
| **In sync with canvas** | Green tint (`--color-success-bg` / `--color-success`) + check | After Run, or when nothing has been typed |
| **Edited · not run** | Grey chip + 6px blue dot | You typed and haven't run |
| **Running…** | Blue tint + spinner | Compiling |
| **N errors** | Error tint + ! | Errors the AI can fix |
| **N needs you** | Warn tint + ▲ | A fix that changes when trades fire |
| **Not supported yet** | Warn tint + info | Valid code that AlgoTest can't run yet |
| **Runs from code** | Grey + `</>` | The code-only strategy |
| **Copilot changed 2 lines** | AI tint + ✦ | Right after a Copilot change |

## 1 · Atoms

| Atom | Spec |
|---|---|
| Code text | JetBrains Mono 11.5/20. The gutter is 30px (number, right-aligned) plus a 16px marker column. Tab = 4 spaces. |
| Syntax colours (existing tokens only) | **Keyword / function** (`if`, `and`, `ta.ema`, `strategy.entry`): `--color-brand-text` `#0A5FA3`. **Built-in** (`close`, `volume`, `true`, `strategy.long`): `--color-brand` `#0782DA`. **String:** `--color-buy-text` `#2F8A4E`. **Number:** `--color-warn-text` `#855400`. **Comment:** `--color-text-muted` `#7D838C`. **Other:** `--color-text-primary`. Add them as `--color-code-*` aliases in `tokens.css`. |
| Line: current | Background `--color-surface-hover`; the number turns primary and 600. |
| Line: selection | Background `#C4DFF5` on the selected text (the builder kit's "blue pressed" value in `atom-states.ts`). Add it as `--color-code-selection`. |
| Line: edited since opening, not run | 2px bar `--color-brand-border` at the gutter edge. |
| Line: changed by Copilot | `--color-ai-tint` fill + 2px `--color-ai` bar + violet number. |
| Line: error, AI can fix | `--color-error-bg` fill, red number, red 7px gutter dot. Wavy 1.5px underline `--color-sell` under the broken token. |
| Line: needs you | Warn tint fill, warn-text number, amber dot (`--color-warn-dot`), amber wavy underline. |
| Line: not supported yet | Warn tint fill, amber info icon in the gutter, amber wavy underline. **Never red:** the code is valid. |
| Line: just fixed | Buy tint fill + 2px `--color-buy` bar for 2s, then normal. The fixed token gets a `#C9EDD5` highlight. |
| **Run** | **The panel's one filled-blue button.** 32px, "Run ▸" + a "⌘↵" hint. **Off** when the code already ran (nothing new). **On** when you've typed. **Running:** a spinner + "Running…". Hover, pressed and focus use the standard brand states. |
| **Discard changes** | Secondary, 32px. Off until something changed since opening. Tooltip as above. |
| Log line | Mono 11. Time (faint) + message. Success lines are green; an error shows a red-tint tag "Error 15:27" plus the compiler message, **exactly as the compiler wrote it**, plus a "Fix with AI" link. A needs-you line uses a warn-tint tag. |
| Problem tag | 11/500, radius 4. "Typo", "Garbled paste" and "Missing bracket" are red tint (AI can fix). "Needs you" is warn tint. "Not supported yet" is warn tint. |
| Diff | Mono 11/20, radius 6. The `−` row is error-bg; the `+` row is buy-tint. |
| Pine Script toggle | In the Copilot header: `</>` (mono) + "Pine Script" (**IBM Plex Sans 12.5**). On = brand-tint bg + blue border and text. **Draft dot:** 8px blue dot at the top-right with a 2px white ring. |
| Ask box | Under the editor. 40px tall, neutral edge, focus = the standard ring. ✦ 12 + placeholder "Ask Copilot to change or explain the code…" + round Send (grey until there's text, then filled blue). |

## 2 · Molecules

| Molecule | Spec |
|---|---|
| Editor toolbar (44px) | Strategy name (12.5/500, ellipsis at 170px) + status chip + Find, Copy and ⋯ icon buttons (28px). |
| Autocomplete | A popover (the shared Popover), 260w. Each row: an `ƒ` badge, the name and the params. The current row uses the menu-current colours. A one-line description sits at the bottom. Keys: ↑ ↓ ↵ Esc. |
| Hover doc | A popover with the signature and one plain sentence that says what it is on the canvas ("On the canvas this is "Cross Above""). |
| Find bar | ⌘F. A 300w floating bar: field + "2 of 4" + ↑ ↓ ✕. |
| Shortcuts | ⌘↵ Run · ⌘Z / ⇧⌘Z undo and redo typing · ⌘/ comment · ⌘F find · ⌘. accept the AI fix on this line · F8 next problem · Tab indent. |
| AI fix card | Sits **right under the broken line**, indented to the code column (margin-left 46px). White, 1px `--color-border-control`, radius 10, shadow `0 8px 24px rgba(20,22,28,.10)`. Header: ✦ + "AI fix · Line 15" + problem tag. Body: one plain sentence, with code in grey `code` chips. **Typo:** diff + **Fix & run** (outlined blue) + Ignore + ⌘. hint. **Applying:** a spinner + "Fixing and running…". **Needs you:** the options use the Copilot answer-option atom; the one that matches the canvas is marked Suggested ("21 · matches canvas"), with the note "This changes when trades fire, so AI won't pick for you" and **Apply & run** · I'll edit it. **Not supported:** an amber info header + why, in plain words + 3 radio cards (Rebuild with AI · Recommended / Remove it and run / Request this feature) + Continue · Cancel. |
| Summary bar | 3 or more problems: **one** bar above the log, never a stack of cards. It shows "5 problems found" + "↑ ↓ to step", the counts ("● 4 AI can fix", "● 1 needs you") and **Fix all 4** (outlined blue) · Review one by one. The log collapses to "5 errors · Compiler log collapsed · Show log". |
| Review AI fixes (Fix all) | Replaces the editor body. Header "‹ Review AI fixes · 5 of 5 selected". Each fix is a card with a checkbox (builder kit), "Line 4", a tag and the diff. Needs-you items are amber cards with options and "Skip for now". Footer: Cancel · **Apply 5 & run** (filled). **Nothing changes until Apply.** |
| One by one | A bottom sheet over the code (radius 14 at the top, grab handle): "Problem 1 of 5" + ↑ ↓ ✕, the 1A card content, "Fixed 0 of 5 · the code runs when you finish", then Fix & next · Skip · Fix remaining 3 (tertiary). The current line gets a 2px blue bar. |
| Toasts | Above the footer, never covering Run. White, radius 10. **Fixed:** "Fixed line 15 and re-ran · Compiled · canvas and chart updated" + Undo (10s). **Discarded:** "Discarded 3 changes" + Undo. **Ran:** "Ran · canvas updated · 1 block changed" + Undo. **Nothing to update:** "Ran · nothing to update · Your edit didn't change when trades fire" (no Undo). |
| Banners | Under the toolbar. **Copilot changed code:** AI tint, ✦, text + Undo. **Conflict:** warn tint, "The canvas changed lines you're editing" + Keep my code · Use the canvas version. Show it only when the same lines collide; otherwise canvas changes slot into the draft quietly. **Draft:** brand tint, "Draft · not run yet". |

## 3 · The editor (inside the Copilot panel, 440w)

The layout always runs top to bottom: Copilot header (56) · toolbar (44) · [banner] · code (scrolls, with the scrollbar visible on hover) · log strip (collapsible) · footer (56: Discard on the left, Run on the right) · Ask box.

**Variants:**
- In sync
- Edited · not run
- Running
- Ran
- Copilot changed
- 1 error with the AI fix card
- Many errors with the summary bar
- Needs you
- Not supported
- Review AI fixes
- One by one
- Draft
- Conflict

## 4 · Errors fixed in place (PN 1A–3)
- **The compiler message stays as written**: it is the source of truth. The AI explains it in plain words.
- **1A Typo:** one tap, Fix & run (or ⌘.). "Fix with AI" in the log reopens the card.
- **1B After a fix:** it re-runs by itself, the line goes green for 2s, Undo stays for 10s, and the canvas syncs like any Run.
- **1C Unclear:** the AI asks with choices. It never guesses values that change when trades fire.
- **2A Three or more errors:** one summary bar. Gutter dots: red = AI can fix, amber = needs you.
- **2B Fix all** always opens the review first. Needs-you items stay pinned until they're answered.
- **2C One by one** is the 1A card in a bottom sheet with ↑ ↓.
- **3 Not supported** is amber, not red. Say which line and why, in plain words. Always give 3 ways forward. Feature requests count as demand data.
- **No entry in the code:** valid code that can never trade is "needs you": "There's no strategy.entry, so the strategy never buys. Add one?"

## 5 · On the canvas (from your code)

| Piece | Spec |
|---|---|
| Custom logic block | It is **grey, because you wrote it**: the normal block look, a `</>` square and the rule in plain words, then "Open line 7" (blue 12/500). The same block made by Copilot keeps its violet + ✦ look. It is read-only: a click opens the editor at that line. Its ⋯ menu has Open in code ↵ and Delete ⌫ ("Deleting removes lines 7 and 10"). Editor rings come from the builder kit. |
| Runs from Pine Script | One card replaces the blocks: `</>` + title + "Code only" badge + why (the lines that use memory) + **Edit in code** (outlined blue) · Check on chart. "+ Add condition" is disabled, with the tooltip "This strategy runs from code. Change it in Pine Script." |
| Toast after Run | "Updated from your code · 1 added, 1 changed" + Undo, with the `</>` icon. (Copilot's toast uses ✦.) |

## Parsing (code → canvas), mock

There is no real compiler.
- **Parse the same subset `pine.ts` writes:**
  - `name = ta.<fn>(src, n)` variables
  - one `longOk = …` entry expression with `and` / `or` / `not`
  - `ta.crossover` / `ta.crossunder`
  - `>` `<` `>=` `<=`
  - numbers
  - one exit `if`
- **Round trip:** `parse(pine(tree))` must equal `tree`. Add a test for it.
- **Classify each entry / exit term:**
  - It **fits** (maps to a block).
  - It's **custom logic** (`ta.lowest`, `ta.highest`, `ta.barssince`, `[n]` lookback over a range…). This becomes a Custom logic block holding the line number and a plain-words label from a small lookup.
  - It's **code only** (`var`, `:=`, loops). This turns on code-only mode.
- **Known errors,** for the demo scripts:
  - an unknown argument name → Typo
  - an undeclared identifier → Needs you, with options from the canvas variables
  - unbalanced brackets → Missing bracket
  - a misspelt `ta.` namespace → Garbled paste
  - `request.security` → Not supported
- **Fake timing:** compile about 500ms; each AI fix about 400ms.

## Review states

There's no Scenarios switcher, so make each state reachable by clicking:
1. Open the editor from a strategy.
2. Type a change and Run.
3. Paste the demo script with 5 errors.
4. Type `len` in place of `21`.
5. Add `request.security`.
6. Paste the code-only demo.

Put the demo scripts in `src/mock/pine.ts`, with a "Load example" item in the toolbar ⋯ menu (examples: With 1 typo · With 5 problems · Not supported · Code only).
