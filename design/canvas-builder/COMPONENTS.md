# Canvas builder · component spec

Source of truth: `reference/atoms.jpg` and `reference/behaviour.jpg` (also the `.html` versions of the same boards).
Values live in `src/styles/tokens.css` (the repo's single token file). `atom-states.ts` here shows the state logic for the field atoms; when you build, move its colours into `tokens.css` and read them from there. Never hard-code a hex in a component.

### Token names in this spec → the repo
The spec uses short names. Use the existing repo token where one exists; add the rest to `tokens.css` first.

| Spec name | Value | Repo token |
|---|---|---|
| `--blue-500` | #0782DA | `--color-brand` (exists) |
| `--blue-600` | #0567AD | `--color-brand-hover` (exists, #066fbb; keep the repo value) |
| `--blue-wash` | #F4F8FD | `--color-brand-tint` (exists) |
| `--blue-10` | #E6F3FB | **add** `--color-atom-hover`: hover fill for every field atom |
| `--blue-menu-current` | #EEF5FC | **add** `--color-menu-current` |
| `--chip-grey` | #F1F2F4 | `--color-surface-selected` (exists). Connector chips at rest; replaces `--color-surface-chip` on the canvas |
| `--text` / `--text-sub` / `--text-muted` / `--text-placeholder` / `--text-faint` | | `--color-text-primary` / `-secondary` / `-tertiary` / `-subtle` / `--color-text-disabled` |
| `--border-card` | #E4E6EA | `--color-border-control` |
| `--border-button` | #DFE1E5 | `--color-border-chip` |
| `--border-dashed` | #B3B8BF | **add** `--color-border-empty` |
| `--group-edge` | #C3C8CF | `--color-border-radio` (same value) or **add** `--color-group-edge` |
| `--group-bg` | #FCFCFD | **add** `--color-group-bg` |
| `--rail` | #C9CED5 | `--color-line-connector` |
| `--error-bg` / `--error-border` / `--error-text` | #FDF4F4 / #E5A3A0 / #B42318 | **add** `--color-error-tint` / `--color-error-border` / `--color-error-text` (check for existing ones first) |
| `--ai`, `--ai-border`, `--ai-tint` | purple on the canvas | **use the repo's blue `--color-ai-*` tokens. No purple anywhere.** |
| `--focus-ring` | 0 0 0 3px rgba(7,130,218,.15) | **add** as a shadow token |
| `--popover-shadow` | 0 12px 32px rgba(20,22,28,.14) | use the existing popover shadow if there is one, else **add** |

One component set serves both **Entry** and **Exit**.

---

## 1. Field atoms

Every atom shares the same base look:

- **Size:** height 28, radius 6, padding 0 8.
- **Icon-only atoms:** 28 × 28.
- **Type:** 13px / 500. Indicator settings (e.g. "(9, Close)") are 13px / 400 in `--text-placeholder`.
- **Gap inside a block:** 6.

There are two families. They differ only at rest.

| Family | Atoms | Default (at rest) |
|---|---|---|
| `operand` | Indicator (name + settings), Value | No fill, no border; sits flat on the block |
| `connector` | Relation, Arithmetic, Logic node, Timing chip | Grey box `--chip-grey` |

All other states are shared by both families:

| State | Surface | Border | Text | Ring |
|---|---|---|---|---|
| hover | `--blue-10` (#E6F3FB) | none (same as fill) | `--text` | – |
| open (focused = pressed = menu open) | white | 1px `--blue-500` | `--text` | `--focus-ring` |
| empty | white | 1px dashed `--border-dashed` | `--text-placeholder` | – |
| empty · focused | white | 1px `--blue-500` | `--text-placeholder` | `--focus-ring` |
| error | `--error-bg` | 1px `--error-border` | `--error-text` | – |
| disabled | operand: none · connector: `--chip-disabled` | none | `--text-faint` | – |

Exception: the Indicator atom's **empty** state in the field-atoms matrix has no border (designer's choice).

**Rules**

- **Text never truncates.** A long condition wraps inside its block.
- **Labels:**
  - Empty labels: "Indicator", "Relation", "Value", "Pick logic".
  - Error labels: "Pick indicator", "Pick relation".
- **Applied arithmetic** shows as a connector chip after the operand, e.g. `× 1.5`.
- **Logic node:** shows a chevron and holds one of `All of` · `Any of` · `None of`. Never AND / OR.
- **Timing chip:** `On candle close` or `During the candle`, with a chevron.

## 2. Condition block

A white card holding the atoms.

- **Card:** 1px `--border-card`, radius 10, padding 6, gap 6. It wraps rather than truncating.
- **Layout on hover:** `[☐ checkbox]` · atoms · `[⋯]` · `[⋮⋮ drag handle]`.
  - The checkbox sits at the **start**.
  - The handle sits at the **far right**, after ⋯, so it never touches the rail connector on the left.
- **Only the innermost item under the pointer shows hover.** Hovering a block inside a group does not hover the group.

| State | Border | Background | Extra |
|---|---|---|---|
| default | `--border-card` | white | – |
| hover | `--blue-500` | white | checkbox (empty), ⋯, ⋮⋮ |
| ⋯ open | `--blue-500` | white | ⋯ in open state + menu |
| editing (a field is open) | `--blue-500` + ring | white | – |
| selected | `--blue-500` + ring | `--blue-wash` | checkbox ticked |
| can join selection | `--border-card` | white | empty checkbox shown without hover |
| can join · hover | `--blue-500` | white | empty checkbox |
| can't join (other level) | `--border-card` | white | opacity 0.45, no checkbox |
| incomplete (after leaving it) | `--error-border` | white | message under it: "Finish this condition to update the chart" |
| added by Copilot | `--color-ai-border` + blue ring (no purple) | white | ✦ badge top-left in `--color-ai-badge` |
| changed since last update | `--border-card` | white | 8px blue dot top-right |
| drag origin | 1px dashed blue | #F7F8FA | opacity 0.5 |
| dragging | `--blue-500` | white | shadow + rotate −1.2° |

## 3. Groups and logic

- **One logic node per group,** sitting on the group's top edge. Nothing is repeated between the conditions inside.
- **Section root:**
  - With 2 or more conditions, the section starts with its own logic node at the top of the rail.
  - With 1 condition there is no node.
- **Max nesting is 2 levels.** A deeper drop is refused, with the reason: "Groups go 2 levels deep. Drop it next to the group instead."
- **A group left with 1 condition dissolves.** The condition moves up to the parent.
- **Group box:** radius 12, padding 24 16 10 14. Children hang off a vertical rail (1px `--rail`) with 18px horizontal connectors.

| Group state | Edge | Background | Top edge shows |
|---|---|---|---|
| default | 1px dashed `--group-edge` | `--group-bg` | logic node |
| hover | 1px `--blue-500` | `--blue-wash` | left: ☐ + node (hover) · right: ⋯ + ⋮⋮ |
| logic menu open | 1px `--blue-500` + ring | `--blue-wash` | node open, ⋯ |
| selected | 1px `--blue-500` + ring | `--blue-wash` | ☑ + node |
| can join selection | dashed default | `--group-bg` | ☐ + node |
| drop target | 1.5px dashed `--blue-500` | blue 6% | node; empty group says "Drop a condition here" |

## 4. Controls

- **Add (small):**
  - 22px circle with a 1px blue border, white, blue "+". It sits at the end of a rail.
  - On hover it fills blue with a white "+".
- **Add (big):** "+ Add Entry Condition" / "+ Add Exit Condition".
  - Filled blue, height 36, radius 8, hover `--blue-600`.
  - Shown only when a section is empty.
- **⋯ button:** 26 × 26, radius 6. Default is white with a `--border-card` border; hover and open as in the atoms board.
- **Checkbox:** 16 × 16, radius 4.
  - Off: 1.5px `--border-dashed`.
  - On: filled `--blue-500` with a white ✓.
- **Drag handle ⋮⋮:** 14 × 24, `--text-placeholder`. Hover background `--chip-grey`.

## 5. Popovers and menus

- **Surface:** white, 1px `--border-card`, radius 10, `--popover-shadow`, padding 6.
- **Rows:** 32px tall, radius 6.
  - Hover: `--chip-grey`.
  - Current: `--blue-menu-current`, blue text and ✓.
  - Destructive rows use `--error-text`.
  - Keyboard hints sit right-aligned in `--text-placeholder`.

| Popover | Contents |
|---|---|
| Indicator picker (300w) | Focused search · tabs All / Favourites / Trend / Momentum / Volume · "Favourites & recent" list with ★ · current indicator has ✓ · no-results message suggests a short name or Copilot |
| Indicator settings (270w) | Title "EMA · settings" + ✕ · Length / Source / Offset · changes apply as you type · an invalid value shows the reason in red and keeps the last good value |
| Relation (240w) | COMPARE: Greater Than, Greater Than or Equal, Less Than, Less Than or Equal, Equals, Not Equal · CROSS: Cross Above, Cross Below |
| Arithmetic (260w) | Title "Maths on SMA (Volume, 20)" · + − × ÷ · "By [1.5]" · Remove maths (red link) |
| Logic node (240w) | All of (Every condition is true) · Any of (At least one is true) · None of (No condition is true). Logic only; group actions are in the group's ⋯ |
| ⋯ on a block (230w) | Duplicate ⌘D · Add condition below · Copy as text ⌘C · — · Delete ⌫ (red) |
| ⋯ on a group (250w) | Add condition to group · Duplicate group ⌘D · Ungroup ("Conditions move up a level") · — · Delete group ⌫ (red, "Deletes its conditions too · Undo") |
| Timing chip (280w) | On candle close ("Checks once each candle finishes") · During the candle ("Checks on every price update; more signals, more noise") |

## 6. Behaviour

**Add a condition**
1. Click + on the rail.
2. A new block appears in edit state, and the indicator picker opens on its own.
3. Pick the indicator; the relation picker opens next.
4. Pick the relation; then fill in the value or the second indicator.
5. When the block is complete, the chart pauses and "Update chart · N changes" shows.

**Switch or edit**
- Click the indicator name to switch it (picker, current ✓).
- Click the grey settings to edit them.
- The block keeps its place.

**Delete**
- Instant, with no confirm.
- A toast "Deleted RSI (14) Greater Than 50 · Undo" stays for 8 seconds.

**Select and group** (no hidden menu)
1. Hovering a block shows its checkbox.
2. Ticking one block shows the checkbox on **every block or group that can join it**: the siblings at the same level, in the same parent. Everything else dims to 0.45.
3. The selection bar appears at the bottom of the canvas. It's white, never dark: `N selected · Group as [All of][Any of][None of] · Duplicate · Delete · ✕`.
4. With 1 ticked, the Group-as chips are disabled and the bar says "Tick one more to group".
5. Grouping makes a new group with the chosen logic, and a toast offers Undo.
6. Esc or ✕ clears the selection. Space ticks the focused block.
7. A sibling group that would end up 3 levels deep stays dimmed, with the reason on hover.

**Change the logic**
- One click on the node opens the logic menu.
- The group's contents don't move.

**Drag**
- Only by ⋮⋮.
- The source becomes a ghost, and the target group gets the drop-target state.
- A 2px blue line with a dot marks the insert position.

**Copilot blocks**
- ✦ stays until the user edits the block; then it becomes a normal block.

**Half-built block**
- Clicking away keeps the block.
- The missing field gets the error state, and Update chart is off until it's filled.

**Keyboard**
- Popovers: type to search, ↑ ↓ to move, Enter to pick, Esc to close.
- Tab moves to the next field. ⌘D duplicates, ⌘C copies as text, ⌫ deletes.

## 7. Section shell

- **Header:** "Entry" with "When your strategy should enter a position", or "Exit" with "When your strategy should exit".
- **Under the header:** "Check [timing chip]".
- **Empty section:** a root dot, the rail, and the big add button.
- **Canvas background:** `--bg-canvas` with a 16px dot grid (#E2E5E9). It scrolls; the tree grows downward.
