import { SAVED_STRATEGIES } from '@/mock/savedStrategies';
import type { Chat, Message } from '@/store/copilot';
import type { StrategyTree } from '@/types/strategy';
import { cond, demoStrategy, group, ind, num } from './strategies';

/*
  Seeded Copilot chats (design/copilot/CONVERSATIONS.md · Prototype build).
  2–3 chats per saved strategy, strategy notes, one chat under "No strategy",
  and one long chat (about 50 turns) so the "getting long" card can be seen.
  Dates follow the boards: today is 4 Nov 2026.
*/

const day = (d: number, h = 10, m = 0) => Date.UTC(2026, 10, d, h - 5, m - 30); // IST → UTC
const oct = (d: number, h = 10) => Date.UTC(2026, 9, d, h - 5, -30);

let n = 0;
const id = (p: string) => `${p}-seed-${++n}`;
const user = (text: string, at: number): Message => ({ kind: 'user', id: id('u'), text, at });
const note = (text: string, at: number): Message => ({ kind: 'card', id: id('n'), card: { kind: 'note', id: id('nc'), text }, at });

/** EMA 9/21 as it was when the volume-filter chat ended (RSI 50, with the filter). */
export const emaWithVolume = (): StrategyTree => {
  const t = demoStrategy();
  t.entry.children.push(cond(ind('volume'), 'Greater Than', ind('sma', { length: 20, source: 'Volume' })));
  return t;
};
/** EMA 9/21 as it is now: RSI raised to 55, volume filter dropped (what the live note says). */
export const emaNow = (): StrategyTree => ({
  entry: group('AND', [cond(ind('ema', { length: 9 }), 'Cross Above', ind('ema', { length: 21 })), cond(ind('rsi'), 'Greater Than', num(55))]),
  exit: group('AND', [cond(ind('ema', { length: 9 }), 'Cross Below', ind('ema', { length: 21 }))]),
});

function chat(strategyId: string | null, title: string, messages: Message[], snapshot: StrategyTree | null = null): Chat {
  const times = messages.map((m) => ('at' in m && m.at) || 0);
  return { id: id('chat'), strategyId, title, createdAt: Math.min(...times), updatedAt: Math.max(...times), messages, snapshot };
}

function volumeChat(): Chat {
  const added = cond(ind('volume'), 'Greater Than', ind('sma', { length: 20, source: 'Volume' }));
  return chat('s-ema', 'Volume filter ideas', [
    user('Only enter when volume is above its 20-candle average.', day(2, 11, 40)),
    { kind: 'card', id: id('c'), card: { kind: 'refineAdd', id: id('cc'), side: 'entry', added, before: { entries: 14, exits: 13 }, after: { entries: 9, exits: 9 }, mark: 0 }, at: day(2, 11, 41) },
  ], emaWithVolume());
}

function buildChat(): Chat {
  return chat('s-ema', 'Build EMA 9/21 with RSI', [
    user('Buy when EMA 9 crosses above EMA 21 and RSI is above 50', oct(30, 15)),
    note('Built it: EMA 9 crosses above EMA 21, all of RSI above 50, exit when EMA 9 crosses below EMA 21. 14 entries in the last year.', oct(30, 15)),
  ], demoStrategy());
}

function marchChat(): Chat {
  return chat('s-rsi-dip', 'Why did March lose money?', [
    user('Why did March lose money?', day(1, 16)),
    { kind: 'card', id: id('c'), card: { kind: 'answer', id: id('cc'), title: 'March: 4 losing trades in a row', sub: 'RSI Dip · NIFTY', text: 'Three entries fired on gap-downs after 09:15. A 09:30 start time would have skipped them.' }, at: day(1, 16, 1) },
  ]);
}

function timeExitChat(): Chat {
  return chat('s-ic', 'Add a time exit at 15:15', [
    user('Add a time exit at 15:15', oct(28, 12)),
    note('Time exits use the setup’s square-off time. I set it to 15:15 in the Backtest setup; the entry is unchanged.', oct(28, 12)),
  ]);
}

/** About 50 turns, so the "This chat is getting long" card shows. */
function longChat(): Chat {
  const msgs: Message[] = [];
  const asks = ['Tighten the stop a little', 'What about a wider spread?', 'Try 100 points wider', 'Compare with last week', 'Show the worst day'];
  for (let i = 0; i < 50; i++) {
    msgs.push(user(asks[i % asks.length], oct(31, 9) + i * 60_000));
    msgs.push(note(['Tightened it by 10 points.', 'A wider spread trades less but wins more often.', 'Done: 100 points wider.', 'Last week had 3 trades, all small wins.', 'The worst day was 27 Oct: −₹4,100.'][i % 5], oct(31, 9) + i * 60_000 + 20_000));
  }
  msgs.push({ kind: 'card', id: id('c'), card: { kind: 'long', id: id('cc') }, at: oct(31, 10) });
  return chat('s-bcs', 'Tuning the spread', msgs);
}

function vwapChat(): Chat {
  return chat(null, 'What is VWAP?', [
    user('What is VWAP?', oct(20, 11)),
    note('VWAP is the average price of the day, weighted by volume. It resets every morning at 09:15.', oct(20, 11)),
  ]);
}

/** Two quiet chats for every other saved strategy. */
function generic(sid: string, name: string, k: number): Chat[] {
  const d = 20 + (k % 9);
  return [
    chat(sid, `Build ${name}`.slice(0, 40), [user(`Build ${name}`, oct(d, 10)), note(`Built ${name}. Check it on the chart, then run a backtest.`, oct(d, 10))]),
    chat(sid, 'Fewer signals, please', [user('Fewer signals, please', oct(d + 1, 14)), note('Raised the RSI threshold by 5. Entries in the last year went from 18 to 12.', oct(d + 1, 14))]),
  ];
}

export function seedChats(): Chat[] {
  const special = new Set(['s-ema', 's-rsi-dip', 's-ic', 's-bcs']);
  return [
    volumeChat(),
    buildChat(),
    marchChat(),
    chat('s-rsi-dip', 'Find dip entries', [user('Buy the dip when RSI is below 30, then turns up', oct(29, 11)), note('Built it: RSI crosses above 30. 11 entries in the last year.', oct(29, 11))]),
    timeExitChat(),
    ...generic('s-ic', 'Iron Condor', 3).slice(0, 1),
    longChat(),
    ...generic('s-bcs', 'Bull Call Spread', 4).slice(1),
    vwapChat(),
    ...SAVED_STRATEGIES.filter((s) => !special.has(s.id)).flatMap((s, k) => generic(s.id, s.name, k)),
  ];
}

export function seedNotes(): Record<string, string[]> {
  const out: Record<string, string[]> = {
    's-ema': [
      'Wants fewer signals; 6–10 entries a month is the target.',
      'Tried a volume filter on 2 Nov. Dropped it: it removed good trades.',
      'Trades NIFTY on 15m only.',
      'Prefers exits on an EMA cross over a fixed time.',
    ],
    's-rsi-dip': ['Avoid gap-down entries after 09:15.', 'Keeps RSI 14 on the default source.'],
    's-ic': ['Square off by 15:15.'],
  };
  for (const s of SAVED_STRATEGIES) out[s.id] ??= ['Wants to see it on the chart before backtesting.'];
  return out;
}
