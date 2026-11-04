# Copilot conversations · how chats map to strategies (decided 4 Nov)

The build brief for Copilot chat history.

- **Board:** `reference/cp-conversations.html` / `.jpg`.
- **Thinking and research:** the Claude Doc "Copilot conversations · how chats map to strategies" (https://claude.ai/artifact/UYXKiHyJJJ7LLsyNmmLGvi).

## Decisions (all confirmed by Hakim, 4 Nov)

| # | Decision |
|---|---|
| 1 | **A chat belongs to one strategy.** A strategy can have several chats. |
| 2 | **Opening a saved strategy opens its last chat, scrolled to the end.** A strategy with no chats shows its empty state. New chat (+) starts a fresh one. |
| 3 | **What Copilot remembers is visible:** strategy ⋯ → "What Copilot remembers", editable and clearable. |
| 4 | **Cards in older chats are read-only records:** Undo and Apply are off, with a date chip instead. |
| 5 | **Deleting a strategy deletes its chats**, and the confirm says so. |
| 6 | **Copilot can read other saved strategies when asked, read-only.** It only ever changes the open strategy. |

**History means chat history.** The clock icon in the Copilot header lists chats. There is no strategy version history anywhere.

## Memory model
- **Live strategy state** goes with every message: blocks (JSON), Pine Script (last run + draft), backtest headline, and context bar. **It always wins over what an old chat said.**
- **Strategy notes:** short plain text (max ~500 words), stored on the strategy. Copilot writes them when a chat goes quiet: intent, what was tried, what was rejected and why. Every chat on that strategy reads them, so a new chat "remembers" without replaying transcripts.
- **Conversation:** the chat thread. Only that chat sends its recent turns; older turns go in as a summary.
- **User preferences:** account-level, read by all chats.

## Components (on the board)

| Component | Spec |
|---|---|
| Header buttons | New chat (+) and **Chat history** (clock), each 32px. Hover: surface-selected. Open: brand tint + blue icon. |
| Chat history popover | Anchored under the clock icon, 340w, shared Popover. From top to bottom: <ul><li>Search ("Search chats", by title).</li><li>`THIS STRATEGY · <NAME>` group: the current chat uses the menu-current style.</li><li>`OTHER STRATEGIES`: each row shows the chat title, plus a second line with strategy · instrument.</li><li>`NO STRATEGY`.</li></ul> Each row is 36px min: title (13/500, ellipsis) + time on the right; hover swaps the time for ⋯ (Rename F2, Delete chat ⌫ in red). When empty: "No chats yet for this strategy." |
| Strategy empty state | For New chat, or a strategy with no chats. Title: "What should we change in <name>?" (20/600). Sub-line: "I can see its blocks, code and last backtest." Then 3 starters for a saved strategy (Fewer signals, please · Add a stop loss · Why did March lose money?). |
| Read-only card | The normal card. Its actions are removed, and a date chip sits on the right of the header ("Applied · 2 Nov", "Answered · 1 Nov"): 20px, chip grey, 11/500. |
| Live note | At the end of an older chat when the strategy changed since. Grey strip (surface-hover, radius 10): ✦ + "Since this chat you changed RSI to 55 and removed the volume filter. I'm looking at the strategy as it is now." Copilot adds it once, on open. |
| Other strategy's chat | It **replaces the input** with a footer: "This chat is about **RSI Dip**. Open it to keep going." + **Open RSI Dip** (outlined blue). Opening it switches the builder, using the existing unsaved-changes prompt. |
| What Copilot remembers | A popover from strategy ⋯ (new item, with ✦): title + "About <name>. Written from your chats; edit or remove anything." Then one row per note, each with ✕ remove, then Add a note · Clear all (destructive). |
| Long chat | After about 50 turns, one card: "This chat is getting long · A fresh chat stays quick. I'll keep what we decided." + Start a fresh chat (outlined blue) · Keep going. |
| Delete strategy confirm | Body text: "Its saved setups, backtest results and **3 Copilot chats** go too. This can't be undone." |

## Cases

| Case | Behaviour |
|---|---|
| Chatting on a new Untitled strategy | The chat belongs to that strategy, and keeps its chats when saved |
| Reopen a saved strategy | Its last chat, scrolled to the end. Older cards are records, with the live note if anything changed. |
| New chat (+) | The strategy's empty state. Copilot reads the state and notes, and mentions a past decision only when it matters. |
| Carry on in an old chat | New cards are live; only the earlier ones stay records |
| Ask about another strategy | Read-only access; changes only the open one |
| General question ("what is VWAP?") | Fine in any chat. Chats from an empty workspace go under No strategy. |
| + New strategy | New empty chat. The old strategy keeps its chats. |
| Duplicate | The chats stay with the original. Notes are copied, and the copy knows "Copied from X". |
| Rename | Chats follow (linked by id) |
| Delete | The chats go too (said in the confirm) |
| Live / forward test | Copilot can discuss it, and its changes go to the builder only |
| Ask box in the Pine Script view | Posts into the strategy's current chat |
| Undo from an old card | Off. Use canvas ⌘Z, or ask Copilot. |

## Prototype build (mock, Zustand)
- **`store/copilot`:**
  - `chats: Record<strategyId, Chat[]>`
  - `activeChatId`
  - `notes: Record<strategyId, string[]>`
  - `Chat { id, strategyId | null, title, createdAt, updatedAt, messages }`
  - The title comes from the first message.
- **Cards:** each card stores `actionable: boolean`. Opening an older chat sets it to false for every card that existed before the strategy last changed.
- **Opening a strategy:** activate its most recent chat and scroll to the end, or show the empty state if it has none.
- **Mock data:** seed 2–3 chats + notes for each saved strategy in `mock/`. Include one "No strategy" chat.
- **Live note:** generate it by diffing the strategy now against the snapshot stored with the chat's last card.
- **Reachable by clicking:** open saved strategies from My Strategies, the clock icon, New chat, strategy ⋯ → What Copilot remembers, and Delete.
