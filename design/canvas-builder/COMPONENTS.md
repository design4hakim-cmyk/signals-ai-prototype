# Canvas builder · component spec

The source of truth is the four canvas boards in `reference/`. Each comes as `.html` (open it in a browser) and as `.jpg`.

| File | Contents |
|---|---|
| `builder-atoms.html` | 0 What changed · 1 Foundations · 2 Field atoms · 3 Inputs, menus and controls |
| `builder-atoms-2.html` | 4 Condition block · 5 Logic and groups · 6 Section shell · 7 Editor vs Preview |
| `builder-behaviour.html` | 1 Popovers and menus · 2 Behaviour sequences |
| `builder-behaviour-2.html` | 3 Edge cases |

One component set serves both **Entry** and **Exit**.

---

## 0. The model: two layers

Every canvas element is drawn in two layers. Keep them separate in code.

1. **Its own look (the semantic layer).** This is the element's fill, border and text, and it depends only on what the element *is*:
   - normal grey
   - red error
   - violet Copilot
   - dashed empty
   - read-only
   - disabled

   It never changes because of hover, press, selection or focus.
2. **The editor layer (Figma-like).** These are blue rings drawn **outside** the element's border, as a `box-shadow` (or an `outline` for drop targets).
   - They show interaction only: hover, pressed, selected, focused, drop target, dragging.
   - They exist only in **Editor mode**.

### Editor-layer tokens (only existing colours)

| State | Treatment | Rule |
|---|---|---|
| Hover | `box-shadow: 0 0 0 1px #9CC8EE` | Temporary. Interactive canvas elements only, never static text. |
| Pressed | `0 0 0 1px #0782DA` | Only while the pointer is down. |
| Selected | `0 0 0 2px #0782DA` | Persists after the pointer leaves. Strongest. |
| Focused | `0 0 0 (w+2)px #fff, 0 0 0 (w+4)px #0782DA` | Keyboard focus. `w` = width of any inner ring, so focus always sits outside it. |
| Selected + focused | `0 0 0 2px #0782DA, 0 0 0 4px #fff, 0 0 0 6px #0782DA` | Both visible. |
| Drop target | `outline: 1.5px dashed #0782DA; outline-offset: 3px` + fill `#F4F8FD` | Dashed, so it never reads as selected. |
| Invalid drop | `outline: 1.5px dashed #B42318; outline-offset: 3px` + fill `#FDF4F4` + the reason in words | |
| Dragging | selected ring + `0 12px 28px rgba(20,22,28,.18)` + `rotate(-1.2deg)` | The source stays behind: opacity .5, dashed `#B3B8BF` border, no ring. |

Suggested implementation: a single `editorRing({ inter: 'default'|'hover'|'pressed', selected, focused, lifted })` helper that returns the box-shadow string. Components never compute rings themselves.

### Precedence
1. **Disabled** overrides everything: no editor layer, no hover, no press, `cursor: not-allowed`.
2. **Semantic styling always shows**: the red, violet, dashed or grey stays under every ring.
3. Only one inner ring at a time: **selected > pressed > hover**. **Focus** is added outside it, independently.
4. **Hover** marks only the innermost element under the pointer.
5. **Selection** belongs to one element. It never spreads to children (group → blocks) or parents (block → group → section).
6. **Drop target** (dashed) and **selected** (solid) never look the same. The dragged copy and its source never look the same.
7. **Copilot provenance** (✦ badge + violet) stays visible in every editor state.

### Editor vs Preview mode

| | Editor | Preview |
|---|---|---|
| Editor rings (hover, pressed, selected, focus) | shown | hidden |
| Checkbox, ⋯, drag handle ⋮⋮, + add | shown | hidden |
| Drop targets and drag feedback | shown | hidden |
| Changed-since-update dot | shown | hidden |
| Error, disabled, empty, values | shown | shown |
| Copilot ✦ and violet | shown | shown |

### Colour meaning

| Colour | Meaning |
|---|---|
| **Blue** `#0782DA` / `#9CC8EE` | Editor layer only. |
| **Grey** | Structure: surfaces, edges, connector chips, menu-row hover. |
| **Violet** `#6E56CF` / `#B9A8F7` / `#EFEAFF` | Copilot provenance only. Never hover or focus. |
| **Red** `#B42318` / `#FDF4F4` | Errors and destructive actions. Always with an icon and a message. |
| **Green** `#2F8A4E` / `#EAF6EE` | Success. |
| **Yellow** `#F0B429` | The ★ favourite. |

---

## 1. Field atoms (own look)

- **Size:** height 28, radius 6, padding 0 8. Icon atoms are 28 × 28.
- **Type:** 13px / 500. Settings such as "(9, Close)" are 13px / 400 `#8A9099`.
- **Text never truncates.** Long blocks wrap.

| Atom family | At rest |
|---|---|
| Operand (indicator), Value | No fill, transparent border |
| Relation, Arithmetic, Logic node, Timing chip | Grey box `#F1F2F4` |

| Semantic look | Fill | Border | Text |
|---|---|---|---|
| Normal | per family | per family | `#1D1F24` |
| Empty | `#FFF` | 1px dashed `#B3B8BF` | `#8A9099`, e.g. "Indicator", "Relation", "Value" |
| Error | `#FDF4F4` | 1px `#B42318` | `#B42318` + error icon, e.g. "Pick indicator" |
| Read-only | `#FAFBFC` | 1px `#E4E6EA` | `#1D1F24` · focusable, never selected |
| Disabled | `#F7F8FA` | 1px `#ECECEF` | `#A1A6AD` · no editor layer |

**Editor states:** default · hover · pressed · selected (its popover is open) · focused · selected + focused. Each is the matching ring from section 0.

## 2. Inputs (inside popovers)

| State | Look |
|---|---|
| Default / filled | White, 1px `#E4E6EA`. |
| Hover | + hover ring. |
| Focused | + focus ring. |
| Error | `#FDF4F4`, 1px `#B42318`, red text, and a message under the field. It stays while focused. |
| Disabled | `#F7F8FA`, `#ECECEF`, faint text. |
| Read-only | `#FAFBFC`, and focusable. |

The error sits on the field, never on the whole popover.

## 3. Menus and popovers

- **Surface:** white, 1px `#E4E6EA`, radius 10, shadow `0 12px 32px rgba(20,22,28,.14)`.
- **Rows:**

  | Row state | Look |
  |---|---|
  | Hover | `#F1F2F4` |
  | Pressed | `#E9EBEE` |
  | Keyboard active | `inset 0 0 0 2px #0782DA` |
  | Current | `#EEF5FC` fill, `#0A5FA3` text, ✓ |
  | Disabled | `#A1A6AD`, no hover |
  | Destructive | Red text always; hover `#FDF4F4`; pressed `#FBECEB` |

- **Indicator picker:**
  - Search input has the focus ring while open.
  - Search matches are shown in **bold**, never with a blue fill.
  - ★ favourite is independent of the current ✓.

Contents of each popover:
- **Relation:** Compare / Cross groups.
- **Arithmetic:** + − × ÷, "By".
- **Logic node:** All of / Any of / None of only. Group actions live in the group's ⋯.
- **Block ⋯:** Duplicate ⌘D · Add condition below · Copy as text ⌘C · Delete ⌫.
- **Group ⋯:** Add condition to group · Duplicate group · Ungroup · Delete group.
- **Timing:** On candle close / During the candle.

## 4. Buttons and icon controls (app chrome: keep their own fills, plus the focus ring)

| Control | Default | Hover | Pressed | Disabled | Other |
|---|---|---|---|---|---|
| Primary | `#0782DA` | `#066FBB` | `#05609F` | `#E9EBEE` / faint text | Loading = spinner |
| Secondary | white, `#DFE1E5` | `#F7F8FA`, `#B9C0C9` | `#E9EBEE` | | |
| Tertiary | blue text | `#F4F8FD` | `#E6F3FB` | | |
| Destructive | red text, white | `#FDF4F4` | `#FBECEB` | | |
| **+ on the rail** | **solid `#0782DA`, 28px circle, white +, shadow `0 2px 6px rgba(7,130,218,.25)`**, centred on the rail line | `#066FBB` | `#05609F` | grey | |
| ⋯ | white, `#E4E6EA` | `#F1F2F4` | `#E9EBEE` | | Open = `#E6F3FB` + blue border |
| ⋮⋮ handle | `#8A9099` | on `#F1F2F4` | | no grab cursor | Dragging = blue on `#E6F3FB` |
| Checkbox | 16px | | | muted | Off, off-hover, focused, on, on-hover, indeterminate, disabled off/on |

The big "+ Add Entry/Exit Condition" button is a Primary button.

## 5. Condition block

- **Own look:** white card, 1px `#E4E6EA`, radius 10, padding 6, gap 6.
  - Copilot = `#EFEAFF` fill, 1px `#B9A8F7` border, ✦ badge.
  - Error = `#FDF4F4` fill, 1px `#B42318` border, plus the message under the block.
  - Disabled = `#F7F8FA` fill, `#ECECEF` border.
  - Changed = a blue 8px dot, top right (editor only).
- **Editor layer:** the rings from section 0. The state matrix is in `builder-atoms-2`: every own look × every editor state.
- **Controls on hover or selection:**
  - ☐ checkbox at the start.
  - ⋯ then ⋮⋮ at the **far right**.
- **Editing a field:** only that field gets the selected ring; the block does not change.

## 6. Groups and logic

- **Logic words:** All of / Any of / None of. One node per group, on the group's top edge.
- **Section root:** gets a node only with 2+ conditions.
- **Max nesting is 2 levels.** A group can't be dropped into a level-2 group (invalid drop, with the reason). A single condition can.
- **A group left with 1 condition dissolves.**
- **Own look:** dashed `#C3C8CF` edge on `#FCFCFD`. Editor rings go outside the edge.
- **On hover or selection:** ☐ + node on the top-left edge; ⋯ + ⋮⋮ on the top-right.
- **Logic menu open:** only the node is selected; the group itself stays neutral.

## 7. Section shell (Entry / Exit)

- No border of its own.
- Has its own hover, selected, focused and drop-target states (rings around the whole section).
- **Never** changes because a child is selected.

## 8. Behaviour

- **Add a condition:**
  1. Click + on the rail.
  2. A new block appears, and the indicator picker opens on its own.
  3. Then the relation picker, then the value or second indicator.
  4. Once complete, the chart pauses and "Update chart · N changes" shows.
- **Switch or edit:**
  - Click the name to switch the indicator.
  - Click the grey settings to edit them.
- **Delete:** instant, with a toast and Undo.
- **Select and group:**
  1. Hovering a block shows its checkbox.
  2. Ticking one shows checkboxes on every sibling that can join (same parent). Everything else dims to 0.5.
  3. The white selection bar appears:
     - with 1 ticked, its Group-as chips are disabled;
     - with 2 or more, group them as All of / Any of / None of.
  4. Esc clears the selection.
- **Drag:** only by ⋮⋮. A blue insert line marks the spot.
- **Half-built block:** clicking away marks the missing field in the error state. Update chart is blocked until it's filled ("Finish this condition to update the chart and backtest").
- **Copilot blocks:** ✦ stays until the user edits the block.
- **Keyboard:**
  - In popovers: type to search, ↑ ↓ to move, Enter to pick, Esc to close.
  - Tab moves to the next field. Space ticks a block.
  - ⌘D duplicates, ⌘C copies as text, ⌫ deletes.
