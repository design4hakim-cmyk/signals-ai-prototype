# Pine Script editor · spec (v2, 4 Nov)

This is the build brief for the Pine Script editor. **Read all of it before writing code.** It replaces v1 of this file and the `PN-*` boards (PN-Main, PN-S1-*, PN-S2-*, PN-S3-*). The PN boards keep their copy; this file wins where they differ.

**Sources** (open the HTML in a browser and screenshot it; don't read it raw):

| File | Contents |
|---|---|
| `reference/pn-components.html` | 0 The sync rules · 1 Atoms (syntax, line states, **status line**, Run, Discard, log, Ask box) · 2 Molecules (autocomplete, hover doc, find, AI fix cards, many problems, feedback without toasts, conflict banner) |
| `reference/pn-editor-and-canvas.html` | 3 The editor in every state · 4 What code turns into on the canvas |
| `reference/pn-sync-flows.html` | Edit → Run → canvas · build by hand → code follows silently · Copilot from the Ask box · Discard |
| `reference/pn-cant-draw-and-edge-cases.html` | Partly fits · code only · draft from earlier · conflict · nothing to update · no entry |
| `reference/pn-errors-fixed-in-place.html` | 1A typo · 1B fixed · 1C needs you · 2A many problems · 2B review all · 2C one by one · 3 not supported |

**The thinking behind it** (read it, it explains every rule): the Claude Doc "Pine Script editor · system map" (https://claude.ai/artifact/Bje3CKpj5DedgEuuFU5qbu): model, change-source matrix, undo, status, mapping, 5 journeys, 53 scenarios.

**Extend, don't replace:**
- `src/features/copilot/PineView.tsx` becomes the editor.
- `src/lib/pine.ts` (canvas → code) stays; add code → canvas parsing.
- Canvas pieces come from `design/canvas-builder`; Copilot pieces from `design/copilot`.

---

## What changed since v1 (do these exactly)

1. **The editor stays where it is**: the Pine Script view inside the Copilot panel. The toggle in the Copilot header switches the panel between Chat and code. The canvas stays on the left. **Do not move it.**
2. **No notification bars or toasts in the Pine flow.** Remove:
   - the canvas toast "Updated from your code · Undo"
   - the "Copilot changed 2 lines · Undo" bar in the editor
   - the "Discarded 3 changes" toast
   - the "Fixed line 15 · Undo" toast
   - the "Ran · canvas updated" toast
   - the "Draft · not run yet" banner
3. **A status line replaces the toolbar status chip.** It is 28px, at the foot of the code, like a code editor's status bar. All feedback goes there.
4. **Run is the simple button again:** "Run ▸", filled blue, 32px. Nothing else inside it; ⌘↵ goes in the tooltip only.
5. **Discard changes means "throw away what hasn't run".** The draft goes back to the last code that ran. v1's "back to when you opened the editor" is gone.
6. **There is no strategy version history.** The clock icon in the Copilot header is **chat history** (see `design/copilot/CONVERSATIONS.md`).
7. **The Ask box under the editor stays.** It's how you talk to Copilot while the panel shows code. It uses the same conversation as the chat.
8. **Changed blocks glow once (1s) after a Run.** That replaces the canvas toast.

## 0 · The model

There are two things, never mixed up:

1. **Draft**: the text in the editor right now. It can be half-typed or broken.
2. **Last run**: the last strategy that compiled. The canvas, chart and backtest only ever show the last run, never the draft.

| When | What happens |
|---|---|
| **You build on the canvas** (add, edit, delete, move, group) | It commits straight away, and its lines are **patched** into the draft **silently**: no bar, toast, highlight or log line. Only that block's lines change; the coder's names, comments, spacing and order stay. The caret and scroll never move. The status stays "In sync". |
| **You type in the editor** | Only the draft changes. The status line says "3 lines changed · not run". Edited lines get a 2px `--color-brand-border` gutter bar. Discard and Run turn on. Canvas and chart wait. |
| **Live check** | 600ms after typing stops, syntax and names are checked. Only squiggles and the status count change. Nothing commits, and **AI fix cards don't open by themselves while typing**. |
| **Run** (button, ⌘↵, or ⌘S with the editor focused) | Compiles the whole draft. **Compiles:** the canvas redraws to match, the changed blocks glow once (1s), the chart refreshes (Run counts as Update chart), the backtest goes out of date, and the status line says "In sync · 1 block changed · 16:04". **Errors:** nothing commits; the editor jumps to the first error and opens its AI fix card. Never a partial commit. |
| **Code the canvas can't draw** | Decided at Run. A term with no block becomes one grey **Custom logic** block ("Open line 7"). If the structure can't be drawn (`var`, `:=`, loops, stateful functions), the canvas shows one **Runs from Pine Script** card, and adding blocks by hand is off. Never an error. |
| **Copilot, asked from the Ask box** | A text edit in the draft, then it runs by itself. ⌘Z takes it back (then Run). Copilot's lines get the violet gutter mark until you edit them. No bar. The change's card is also saved in the chat. |
| **Copilot, asked from the Chat view** | Canvas and code change together. Lines are patched in silently, with the same violet marks. Undo lives in the Copilot chat card. |
| **Changes to your work** | Lines you typed count as your work, like blocks you built. Copilot adds apply straight away; changes or deletions of your lines wait for Apply, shown in place in the editor as a diff with Apply / Cancel. |
| **Discard changes** | Throws away only un-run text: the draft goes back to the last run. Off when there is nothing un-run. **No confirm and no toast:** it is one step on the editor's undo stack, so ⌘Z brings it back. It never touches the canvas, Copilot changes or the chart. Tooltip: "Throw away 3 lines that haven't run". |
| **Switching to Chat / closing with un-run code** | The draft is kept for that strategy. The Pine Script toggle shows an 8px blue dot. Coming back, the status line says "Draft from 16:10 · not run". |
| **Conflict** | Only when the canvas changes a block whose lines have un-run edits. Banner under the toolbar: "The canvas changed lines you're editing" + **Keep my code** · **Use the canvas version**. This is the only banner. |
| **Context** (instrument, chart data, timeframe, period) | Never changes the code. The chart pauses as today. |

### Undo: three ways back, each where the change was made
1. **⌘Z / ⇧⌘Z in the editor:** your typing, pastes, accepted AI fixes, Ask-box changes, and Discard. It does **not** include lines patched in by the canvas or by Copilot from the Chat view: the stack rebases around external patches, the way collaborative editors do.
2. **⌘Z on the canvas:** block edits (as today). The code follows silently.
3. **Undo in a Copilot chat card:** for changes made from the Chat view.

These undo stacks last for the session only. There is no version list.

### Status line (one line, always true)
The left side shows the icon, the state and a detail; the right side shows `Ln 9, Col 43` in mono 10.5, faint.

| State | Text | Colour | Run | Discard |
|---|---|---|---|---|
| In sync | ✓ In sync · last run 16:04 | success | off | off |
| Just ran | ✓ In sync · 1 block changed · 16:04 | success | off | off |
| Ran, nothing to update | ✓ In sync · nothing to update | success | off | off |
| Edited | ● 3 lines changed · not run | text-secondary, brand dot | on | on |
| Running | spinner · Running… | brand-text | spinner | off |
| Errors | ! 3 errors · F8 to jump | error | on | on |
| Needs you | ▲ 1 needs your choice | warn-text | on | on |
| Not supported | ⓘ Line 7 isn't supported yet | warn-text | on | on |
| Partly drawn | ✓ In sync · 1 custom block | success | off | off |
| Code only | ✓ In sync · runs from code | success | off | off |
| Copilot writing | ✦ Copilot is editing… (about 1s; the editor is read-only) | text-primary | off | off |
| Draft from earlier | ● Draft from 16:10 · not run | text-secondary, brand dot | on | on |

Clicking an error count jumps to the first error.

## 1 · Atoms

| Atom | Spec |
|---|---|
| Code text | JetBrains Mono 11.5/20. The gutter is 30px (number, right-aligned) + a 16px marker column. Tab = 4 spaces. No soft wrap by default (⌥Z toggles it). |
| Syntax (existing tokens; add `--color-code-*` aliases) | **Keyword / function:** `#0A5FA3` (brand-text). **Built-in:** `#0782DA` (brand). **String:** `#2F8A4E` (buy-text). **Number:** `#855400` (warn-text). **Comment:** `#7D838C` (text-muted). **Selection:** `#C4DFF5`. |
| Line: current | `--color-surface-hover` background; the number turns primary/600. |
| Line: edited, not run | 2px `--color-brand-border` bar at the gutter edge. |
| Line: Copilot changed | `--color-ai-tint` fill, 2px `--color-ai` bar and a violet number, until you edit the line. |
| Line: error (AI can fix) | Error-bg fill, red number, red 7px gutter dot, wavy 1.5px `--color-sell` underline. |
| Line: needs you | Warn-tint fill, amber dot, amber wavy underline. |
| Line: not supported | Warn-tint fill, amber info icon, amber underline. Never red. |
| Line: just fixed | Buy-tint fill + 2px `--color-buy` bar for 2s, with a `#C9EDD5` highlight on the fixed token. |
| Run | Filled brand, 32px, radius 6, "Run ▸". States: disabled (nothing new), default, hover, pressed, focus ring, running (spinner + "Running…"). **The only filled-blue button in the panel.** |
| Discard changes | Secondary 32px. Off when there's nothing un-run. Tooltip: "Throw away N lines that haven't run". |
| Log line | Mono 11: time + message. A success line is green. An error line has a tag ("Error 15:27"), then the compiler message **exactly as written**, then "Fix with AI". The log strip collapses. |
| Problem tags | Typo / Garbled paste / Missing bracket: red tint. Needs you: warn tint. Not supported yet: warn tint. |
| Pine Script toggle | In the Copilot header: `</>` (mono) + "Pine Script" in **IBM Plex Sans** 12.5. On = brand tint + blue border and text. Draft dot: 8px blue, white 2px ring. |
| Ask box | 40px, neutral edge, focus ring. ✦ + "Ask Copilot to change or explain the code…" + round Send (filled when there's text). ⌘L puts the selected lines in it as a chip. |

## 2 · Molecules
- **Editor toolbar (44px):** strategy name + Find, Copy, ⋯ (Load example). **No status chip.**
- **Autocomplete:** a 260w popover. Rows: ƒ badge + name + params; a description at the foot; keys ↑↓ ↵ Esc.
- **Hover doc:** signature + one sentence on what it is on the canvas.
- **Find:** ⌘F, a 300w floating bar ("2 of 4", ↑ ↓ ✕).
- **Shortcuts:** ⌘↵ / ⌘S Run · ⌘Z ⇧⌘Z · ⌘/ comment · ⌘F · ⌘. accept the AI fix · F8 next problem · ⌘L ask Copilot · Tab.
- **AI fix card:** sits under the broken line, indented 46px. White, 1px border, radius 10, shadow. ✦ "AI fix · Line 15" + tag.
  - **Typo:** diff + **Fix & run** (outlined blue) · Ignore · ⌘. hint.
  - **Applying:** a spinner + "Fixing and running…".
  - **Needs you:** answer options (the canvas match is Suggested) + "This changes when trades fire, so AI won't pick for you" + Apply & run · I'll edit it.
  - **Not supported:** 3 radio cards (Rebuild with AI · Recommended / Remove it and run / Request this feature) + Continue · Cancel.
- **Fix & run** applies the fix as a normal text edit (⌘Z undoes it), then runs. Feedback: the green line for 2s plus the status line "In sync · fixed line 15". **No toast.**
- **3 or more problems:** one summary bar ("5 problems found", "● 4 AI can fix ● 1 needs you", Fix all 4 · Review one by one). **Fix all** always opens the review first (Cancel · Apply 5 & run). **One by one** = a bottom sheet with ↑ ↓.
- **Conflict banner:** the only banner (see section 0).

## 3 · Editor layout (Pine Script view, inside the Copilot panel)
- **Top to bottom:** Copilot header (56) · toolbar (44) · [conflict banner] · code (scrolls) · log strip (collapsible) · **status line (28)** · footer (56: Discard left, Run right) · Ask box.
- **Width:** 440px; the panel can be dragged to 640px while in code, and goes back to 440 for Chat. The width is remembered per user.
- **Variants** (all in the boards): in sync · edited · running · just ran · Copilot changed · 1 error + fix card · 5 problems + summary bar · needs you · not supported · review AI fixes · one by one · draft from earlier · conflict.

## 4 · On the canvas
- **Custom logic block from your code:** grey (you wrote it) with `</>`, plain words and "Open line 7". It is read-only: a click puts the caret on that line. Its ⋯ menu: Open in code · Delete (which removes its lines and unused variables). The Copilot-made version stays violet + ✦.
- **Runs from Pine Script card:** replaces the blocks. Edit in code (outlined blue) · Check on chart. "+ Add condition" is disabled, with the tooltip "This strategy runs from code. Change it in Pine Script."
- **After Run:** the changed blocks glow once (`0 0 0 4px var(--color-brand-tint)`, fading over 1s). This is not the editor layer, and **there is no toast**.
- **Linked selection:**
  - Clicking a block highlights its lines and scrolls them into view.
  - Putting the caret in a mapped line gives its block the hover ring.
  - A block's ⋯ menu gets "Show in code" while the Pine view is open.

## 5 · Code ↔ canvas mapping (mock)
- **Source map:** every block knows its line range, and every line knows its block (or "code only").
- **Canvas → code patching** (`pine.ts`, made surgical):
  - edit a value → that token only
  - add a block → its term in the entry expression, plus one variable line named like the file's others
  - delete a block → its term, plus its variable if it's unused
  - group → only that expression (`and` / `or` / `not (…)`)
  - never touch comments, `plot()`, colours or inputs
- **Code → canvas at Run:**
  - Parse the subset `pine.ts` writes.
  - `input.int(21, "Slow")` shows 21 on the block; editing it on the canvas changes the input's default.
  - `strategy.short` → a second Entry (Short) section.
  - `strategy.exit` stop/limit and `strategy()` qty/capital → the Backtest setup wins, with a hint on the line: "Set in Backtest setup".
  - `request.security` → Not supported.
  - `indicator()` → Needs you ("Turn its signals into entries?").
  - v4 → Needs you ("Convert to v5?").
- **Round trip:** `parse(pine(tree))` equals `tree`. Add the test.
- **Classify each term:** fits / custom logic (`ta.lowest`, `ta.highest`, `ta.barssince`, range lookbacks) / code only (`var`, `:=`, loops).
- **Demo errors:** unknown arg → Typo · undeclared identifier → Needs you · unbalanced bracket → Missing bracket · bad `ta.` namespace → Garbled paste · `request.security` → Not supported · no `strategy.entry` → Needs you.
- **Timing:** compile about 500ms; each AI fix about 400ms.

## 6 · Strategy-level rules
- **Save with an un-run draft:** ask "Run your 3 lines first?" with Run & save / Save without them.
- **Backtest:** it runs on the last run. The Backtest tab notes "Code has lines that haven't run".
- **Trade or forward test with an un-run draft:** blocked until you Run or Discard. Live always uses committed code.
- **Drafts are kept per strategy.** A strategy row in My Strategies gets the same blue dot.
- **Duplicate** copies the last run, not the draft.

## 7 · Make every state reachable by clicking (there's no Scenarios switcher)
Add `src/mock/pine.ts` with demo scripts, and an editor ⋯ → **Load example** item (With 1 typo · With 5 problems · Unclear value · Not supported · Partly fits · Code only · No entry). Loading one replaces the draft as one undo step.

## Done means
- Every state on the 5 boards can be reached by clicking.
- Playwright screenshots at 1600×1000 match the boards in spacing, type and colour.
- **None of the removed bars or toasts exist.**
- The round-trip test passes.
- `npm run build` and `npx oxlint src` pass.
