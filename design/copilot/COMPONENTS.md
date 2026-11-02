# Signals Copilot · component spec

The source of truth is the four canvas boards in `reference/`. Each comes as `.html` (open it in a browser) and `.jpg`.

| File | Contents |
|---|---|
| `cp-components.html` | 0 Principles · 1 Atoms · 2 Molecules |
| `cp-components-2.html` | 3 The AI card (all states) · 4 On the canvas · 5 The panel |
| `cp-main-flow.html` | 3a · With Copilot: idea → understood → on canvas → check on chart (6 steps) |
| `cp-refine-edge-cases.html` | 3a · Refine and stay in sync (3 steps) · Copilot edge cases (6 cases) |

This replaces the `CP-*` boards (CP-Main, CP-A02–A05, CP-B06–B08, CP-C09–C13) where they differ. The copy on those boards is kept.

**Extend, don't replace.**
- `src/features/copilot/CopilotPanel.tsx` and `src/mock/copilot.ts` exist. Grow them into this spec.
- Canvas pieces (blocks, All of / Any of nodes, editor rings) come from `design/canvas-builder/COMPONENTS.md`. Don't redraw them.
- Use tokens from `src/styles/tokens.css` and the shared `components/ui` parts.

---

## Colour (the one big change)

**Violet = made by Copilot. Nothing else.** This applies the 2 Nov rule in `CLAUDE.md`.

1. Update the `--color-ai-*` tokens in `tokens.css` to the violet set (it's in `design/canvas-builder/atom-states.ts`):

   | Token | Value | Used for |
   |---|---|---|
   | `--color-ai` | `#6E56CF` | ✦ mark, highlighted-code bar |
   | `--color-ai-border` | `#B9A8F7` | Copilot-made block edge, ghost dashed edge |
   | `--color-ai-tint` | `#EFEAFF` | Copilot-made block fill, highlighted code lines, "Copilot changed code" bar |
   | `--color-ai-border-soft` | `#D6CBFA` | ✦ badge border |

2. **Violet is used only on:**
   - the ✦ mark;
   - blocks Copilot made, until you edit them;
   - ghost blocks being placed;
   - code lines Copilot changed.

   **Not** on the input box, progress, spinners, buttons, focus or hover.
3. **Activity is blue:** progress bar, spinner, focus ring.
4. **Card actions are outlined blue** (Check on chart, Apply changes, Build anyway, Try again). The page keeps its one filled-blue button.
5. **Warnings** use the existing warn tokens (`--color-warn-dot` `#E5A000`, `--color-warn-tint`, `--color-warn-text`).
6. **Errors** use the error tokens; **success** uses green.

## Principles (the behaviour every part follows)

| Rule | What it means |
|---|---|
| One card per request | Each request gets one AI card that changes state **in place**: Understood → (Question) → Building → Applied. Never stack a new card per step. No plans, summaries or closing essays. |
| Ask little | Ask only what changes when trades fire. At most 2 questions per request, always as tappable options with one marked Suggested. Small details Copilot decides itself and shows as dashed "assumed" chips. |
| Add, then undo | Adding to the canvas happens straight away, with Undo. Anything that **changes or removes a block the user made** is previewed first and needs Apply. |
| Proof, not promises | Every build ends with signal counts and "Check on chart". |
| Decide fit before building | Fits / Partly fits / Code only is decided **before** anything is placed, never shown as an error afterwards. |
| Quiet retries | Retries are silent. Only a final failure shows: one line, what was kept, and two ways forward. |
| Vague in, choices out | A vague prompt gets 3 directions as taps. Never invent a strategy; never promise profit. |

## Atoms

| Atom | Spec |
|---|---|
| User message | Right-aligned, max 330w. `--color-surface-selected` bg, radius `12 12 4 12`, padding 10 12, 13/19. Copilot never speaks in bubbles, only in cards. |
| ✦ mark | 4-point star in `--color-ai`, at 12 / 14 / 16px. |
| Value chip | Read-only part of a sentence ("EMA 9", "50"). 22px, radius 5, grey chip bg, 12/500. |
| Context chip | Instrument / chart data / timeframe. 24px pill, white, 1px `#E4E6EA`, 11.5. Hover border `#9CC8EE`; open = `#0782DA` border + 1px ring. Opens the existing context pickers. |
| Assumed chip | Something Copilot decided ("length 14 · assumed", "On candle close"). 20px pill, **dashed** 1px `#B3B8BF`, 10.5. Hover border `#9CC8EE`. Tooltip "Copilot chose this. Click to change." Click opens the setting. |
| Answer option | Full width, min 38px, radius 8, 1px `#DFE1E5`, 12.5. Hover `#F7F8FA` + `#B9C0C9`; pressed `#E9EBEE`. **Suggested:** blue border + 1px ring + "Suggested" tag (11/500 blue). **Chosen:** `#EEF5FC` bg, blue border, `#0A5FA3` text, ✓. **Disabled** (after answering): `#F7F8FA` / `#ECECEF`, text `#A1A6AD`. An option can have a 2nd line (12, muted). |
| Follow-up chip | 30px pill, 1px `#DFE1E5`, 12. Hover/pressed/focus as options. Sends the chip's text as the next message. |
| Status icons | Done (green check circle), Working (blue spinner), Needs you (warn triangle `#E5A000`), Failed (red circle !). 16px. |
| Signal counts | `▲ 14 entries` green, `▼ 13 exits` red, 13/600, tabular nums. After a change: `▲ ~~14~~ → 9 entries` (old count struck through, muted). |
| Diff marks | 18px square, radius 5. `+` Added (green on green tint) · `~` Changed (blue on blue tint) · `−` Removed (red on red tint). Have `aria-label`. |
| Fit badges | 20px, radius 5, 11/600. **Fits canvas** (green tint) · **`</>` Custom logic** (warn tint + `--color-warn-text`) · **`</>` Code only** (grey). |
| Card action | Outlined blue button (secondary shape, blue border + blue text). Full state set: hover, pressed, focus ring. |
| Undo / Stop | Secondary buttons. Undo is 28px tall inside cards. |
| Input box | 1px `#E4E6EA` (hover `#B9C0C9`), focus = the standard focus ring. Bottom row: model select ("Fast"), mic, Send. **Send** is grey until there's text, then filled blue (it's the only filled button in the panel). **While building:** placeholder "Copilot is building… you can still type", Send becomes a **Stop** secondary button. **Voice:** "● Listening… 0:04" in red, mic button red-tinted. Disclaimer under it: "AI-generated strategies can contain bugs. Check them on the chart." (11, faint, centred). |

## Molecules (live inside the AI card)

| Molecule | Spec |
|---|---|
| Card | White, 1px `#E4E6EA`, radius 12, overflow hidden. Header: status icon or ✦ + title (13/600) + optional sub-line (12, muted). Optional footer: 1px `#F0F1F3` top border, padding 10 12, buttons. Error card border `#E5A3A0`. |
| What I understood | Context chips (NIFTY · Spot · 15m) → `ENTRY` label + assumed timing chip → each condition as a sentence of value chips → `ALL OF` / `ANY OF` label for joined rows → `EXIT` the same. **Hovering a row** gives it a `#F7F8FA` fill and "Shown on canvas" (blue, 11) on the right, and the matching block on the canvas shows its **hover ring** (editor layer, from the builder kit). |
| Question | Grey inset (`#F7F8FA`, radius 10): question (13/500) + optional "1 of 2" counter (only when there are 2) + options. After answering, the chosen option stays visible and the others go disabled. |
| Building | Spinner + "Adding entry conditions to canvas…" (13/600) + "1 of 2 placed" + Stop. A 3px progress bar under it: blue on blue tint. |
| Applied | Footer: green check + "Added to canvas" + Undo. |
| Proof | Grey inset: "Signals in the last 1Y" (11, muted) + signal counts + optional note ("Volume filter removed 5 weak signals") + **Check on chart** (outlined blue). |
| Next steps | Follow-up chips after the last card: "Looks right · Run backtest" · "Fewer signals, please" · "Why no trade on 15 Mar?". |
| Review a change | Title "2 changes to blocks you made" + warn icon. Diff rows (diff mark + sentence; a changed value shows ~~50~~ → 60). Impact strip: "Entries in 1Y: 9 → 6". Footer: Cancel (left) · Apply changes (outlined blue, right). |
| Fit check | Title "1 of 2 conditions needs custom logic" + warn icon. One row per condition with its fit badge. A non-fitting row explains why in one plain sentence. Footer: Build anyway (outlined blue) · Simplify so it fits. |
| Failure | Error card: "Couldn't add the 15:15 time exit" / "Your entry is saved. Nothing else changed." + collapsible "Details for support" (mono: reason + `ref #A41-7C`). Footer: Try again (outlined blue) · Add it on canvas · Skip exit (tertiary). |
| Vague prompt | "Which style do you want to trade?" + 3 two-line options (Follow the trend / Catch breakouts / Buy the dip) + "I'll describe my own idea" + "No strategy is guaranteed to profit. The backtest shows how it did in the past." |
| Pine sync bar | Above the code in Pine view. Changed: `--color-ai-tint` bar, ✦ + "Copilot changed 2 lines · volume filter" + Undo. Synced: green tint, check + "In sync with canvas". |
| Code view | Mono 11.5/19, line numbers in faint grey. Lines Copilot changed: `--color-ai-tint` fill + 2px `--color-ai` bar on the left. |
| Prompt starters | Empty state only. Bordered list, each row = title (13/500) + description (12, muted). The whole row is the button; hover `#F7F8FA` + a round blue-tint arrow on the right. |

## The AI card · states (one card, changes in place)

1. **Understood + question:** what I understood + `EXIT` + Question. Entry is queued; the canvas shows skeletons.
2. **Building:** what I understood + Building. Blocks appear one by one.
3. **Applied · entry:** check + "Added 2 entry conditions" / "14 entries in the last 1Y" + rows + Proof + Applied footer.
4. **Strategy ready:** after the exit is answered: "Strategy ready" / "Entry and exit on canvas" + Entry + Exit + Proof (entries and exits) + Applied footer. Next-step chips follow the card.

**Refine:**
- **Add only** → applies at once: "Added 1 condition to Entry" + diff row + Proof (14 → 9) + footer "Pine Script updated · View code · Undo".
- **Touches user blocks** → Review a change (nothing changes until Apply).
- **After Apply** → "Applied 2 changes"; the removed row is struck through; Undo stays.

**Stopped:** "Stopped · 1 of 2 placed" (grey stop icon) + rows + Continue (outlined blue) · Undo. What's placed stays.

## On the canvas

| Piece | Spec |
|---|---|
| Skeleton | Block-sized (40px, radius 10) `--color-ai-tint` with dashed `--color-ai-border`. Shown for queued conditions. |
| Ghost | The real block's atoms inside a dashed `--color-ai-border` edge, 85% opacity. Shown while being placed. |
| Placeholder | Dashed violet edge with "Waiting for your answer in Copilot" (12, violet). Shown where a question is still open (e.g. Exit). |
| Copilot block | Normal block with the **violet look** (tint fill, violet border) and a ✦ badge on its top-left corner. Editor rings work as usual, outside the border. |
| User edits a Copilot block | It becomes a normal grey block (✦ and violet go). Provenance is "who touched it last". |
| Linked hover | Hovering a row in the card shows that block's hover ring on the canvas, and the other way round. |
| Pending change | The user's block, unchanged, with a **dashed blue outline** 3px outside (like the drop-target ring). The value shows ~~50~~ 60. |
| Pending removal | Dashed red edge, red-tint fill, 80% opacity, red text, "Will be removed" (11/600 red). |
| Custom logic block | One block: `</>` square + the rule in plain words ("RSI was below 40 in the last 10 candles") + "Open line 6" (blue link → opens Pine view at that line). Violet look + ✦ when Copilot made it. |
| Code only | Replaces the blocks: card "Runs from Pine Script" + Code only badge + why ("uses memory between candles (lines 6, 10–12)…") + Open code (outlined blue) · Check on chart. |
| Toast | Bottom of the canvas: ✦ + "Added 2 entry conditions" + Undo. |

## The panel

- **Size and layout:** 440w, right of the builder.
- **Header (56px):**
  - ✦ + "Signals Copilot" (14/600);
  - **Pine Script** toggle (28px, `</>`; active = brand-tint bg + blue border and text);
  - New chat (+) and History icon buttons.
- **Thread:** padding 18 16, gap 14, scrolls.
- **Input:** pinned at the bottom.
- **Variants:**
  - **Empty:** "What should we build, Hakim?" (22/600) + "Describe entry and exit in plain words. I'll build it on the canvas." + starters.
  - **Conversation.**
  - **Building:** the input shows Stop.
  - **Pine Script view:** sync bar + code + footer "Discard changes · Apply to strategy (outlined blue)". The input stays, with the placeholder "Ask about the code, or describe a change…".

## Flows

The flow boards show each step as panel + canvas. Use them for the order and copy.

- **Main (6 steps):**
  1. Describe it.
  2. Understood + one question (canvas: skeletons).
  3. Building (ghosts).
  4. Applied (Copilot blocks + toast).
  5. Hover a row → its block rings.
  6. Exit answered → Check on chart. This opens the chart with ▲ entry / ▼ exit markers, using the existing `PriceChart` markers and the "Update chart" rule.
- **Refine (3 steps):**
  1. Add only → applied.
  2. Touches your blocks → review, with the canvas preview.
  3. Pine view stays in sync.
- **Edge cases (6):**
  1. Partly fits → tell before building. Simplify offers "RSI was below 40 on the previous candle".
  2. Build anyway → a custom logic block on the canvas (▲ 11 ▼ 11).
  3. Code only.
  4. Build failed, partly: the entry was kept, the time exit failed.
  5. Vague prompt.
  6. Stopped mid-build.

## Mock data

Extend `src/mock/copilot.ts`. It's all scripted, with no real AI.
- **Match the prompt by keywords** to one of these scripted replies:
  - EMA/RSI main flow
  - volume refine
  - "stricter / drop" review
  - "at least once in the last" → partly fits
  - "re-arm" → code only
  - "VWAP … 3:15" → partial failure
  - "profitable" → vague
- **Fake timing:**
  - Understood: about 600ms.
  - Each block placed: about 500ms.
- **Signal counts** come from the existing seeded signal logic where possible; otherwise use the numbers on the boards.

## Review states

Add to `features/scenarios/ScenarioPanel.tsx`:
- Copilot: empty
- question open
- building
- applied
- strategy ready
- refine add
- refine review
- Pine synced
- partly fits
- custom block
- code only
- failed
- vague
- stopped
