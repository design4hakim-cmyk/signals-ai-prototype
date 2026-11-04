# Copilot · build fixes (from the PR #12 review, 3 Nov)

PR #12 ("All in one") built the Copilot panel from this kit, but the cards don't match the design yet. Each fix below has a screenshot of the build next to the design: open `reference/cp-build-fixes.html` (or `.jpg`). **Fix these before new Copilot or Pine work.**

Done means the panel matches `reference/cp-components.html`, `cp-components-2.html` and the flow boards pixel-for-pixel in spacing, type and colour. Check it with Playwright screenshots at 1600×1000, panel 440w, and compare against the boards.

| # | Problem in the build | Fix |
|---|---|---|
| 1 | **Status icons are black.** Done, Failed and Needs-you render black. `StatusIcon` builds the class at runtime (`map.bg.replace('bg-', 'fill-')`), so Tailwind never generates `fill-success` / `fill-error`. | Write the full class names literally: `{ done: 'fill-success', failed: 'fill-error', needs: 'fill-warn-dot' }`. Search the codebase for any other `.replace(` or template-built Tailwind class and fix it the same way. |
| 2 | **Condition rows don't line up.** A fixed label column pushes the first row inward, "EXIT" sits on its own line with an indented row, and the rows are about 36px apart. | No label column. Section label on its own line: ENTRY / EXIT at 10.5/600, letter-spacing .06em, `--color-text-subtle`, with the timing chip beside it. The **first row is flush left at 12px**. Later rows start with the joiner word inline ("ALL OF", 10.5/600), then the chips. Row: `padding: 5px 12px; gap: 6px; flex-wrap: wrap`. Value chips 22px. |
| 3 | **"Added to canvas" is said twice** (title + footer). "Custom logic is line 5 · Open" floats between the proof and the footer. | The footer **never repeats the title**. It is one row: a muted note (12px, flex 1), a tertiary link, then Undo (secondary 28px). The default is "Pine Script updated · View code · Undo". For custom logic: "Custom logic is line 5 in Pine Script · Open · Undo". This changes the kit: see "Applied" in `COMPONENTS.md`. |
| 4 | **The failure is split into two cards.** "Entry added · 3 conditions" is a cut-off card with no body. | One error card. What was kept is a grey row inside it (`--color-surface-hover`, radius 8, margin `0 12px 10px`): ✓ + "Entry added · 3 conditions" + Undo. Then "Details for support", then the actions: Try again (outlined blue) · Add it on canvas · Skip exit (tertiary). |
| 5 | **The Code-only badge stretches across the card.** "Check on chart" is a text link. | Fit badges are inline (20px, radius 5, 11/600) on the **right of the card header**. Actions: Open code (outlined blue) · Check on chart (**secondary button**). |
| 6 | **The code font is used for UI labels:** the "Pine Script" toggle and the "On candle close" assumed chip. | Only the `</>` glyph is JetBrains Mono. Labels are IBM Plex Sans: the toggle at 12.5/400, assumed chips at 10.5/400 with a dashed 1px `#B3B8BF` edge, no letter-spacing, no bold. |
| 7 | **The canvas toast has no ✦, and Undo is a text link.** | Toast: ✦ (13px) + text 13px + **Undo as a secondary button** (28px). Radius 10, 1px border, shadow. There is **no** toast after a Pine Script Run (see `design/pine-editor/COMPONENTS.md`): changed blocks glow once instead. |
| 8 | **The review impact line has no strip.** "Entries in 1Y: 45 → 8" is plain text. | Put it in a grey strip: `--color-surface-hover`, radius 8, margin `6px 12px 12px`, padding `8px 10px`. |
| 9 | **The old Pine view** (read-only lines, "Discard changes" as a blue link, "Apply to strategy"). | Replace it with the Pine Script editor from `design/pine-editor/COMPONENTS.md`. "Apply to strategy" goes: **Run** is what moves code into the canvas. |

## Also check while you're there
- **Every Copilot action button is outlined blue.** The only filled-blue button in the panel is Send (with text) or Run (in the Pine view).
- **Card padding:** header `10px 12px`; body rows `5px 12px`; footer `8px 12px` with a 1px `#F0F1F3` top border. Radius 12, 1px `--color-border-control`.
- **The blue "changed since update" dot** on canvas blocks (`ChangedDot`) sits at the top-right; the ✦ badge sits at the top-left. Make sure they never overlap on narrow blocks.
