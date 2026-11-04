import { useState, type ReactNode } from 'react';
import { CloseIcon, StarIcon } from '@/components/ui/icons';
import { TextInput } from './atoms';
import { KitButton } from './controls';
import { DEMO_INDICATORS, LOGIC, type IndicatorOption, type LogicWord } from './data';
import { editorRing } from './editorRing';

/*
  Popovers and menus (COMPONENTS.md §3, behaviour sheet §1).
  Neutral white surface. Rows: hover grey · pressed darker grey · keyboard-active ring ·
  current = blue tint + ✓ · disabled muted · destructive always red.
  Errors sit on fields, never on the popover.
*/

export function MenuSurface({ width, label, children }: { width: number; label: string; children: ReactNode }) {
  return (
    <div role="dialog" aria-label={label} style={{ width }} className="flex flex-col overflow-hidden rounded-block border border-border-control bg-surface shadow-surface">
      {children}
    </div>
  );
}

export type RowState = 'default' | 'hover' | 'pressed' | 'keyboard' | 'current' | 'disabled';

export function MenuRow({
  children,
  hint,
  shortcut,
  state,
  destructive = false,
  onClick,
}: {
  children: ReactNode;
  /** grey second line, e.g. "Conditions move up a level" */
  hint?: ReactNode;
  shortcut?: string;
  /** Storybook: force a row state; otherwise hover/press come from CSS */
  state?: RowState;
  destructive?: boolean;
  onClick?: () => void;
}) {
  const [kbFocus, setKbFocus] = useState(false);
  const disabled = state === 'disabled';
  const current = state === 'current';
  const tone = disabled ? 'text-text-disabled' : destructive ? 'text-error' : current ? 'text-brand-text' : 'text-text-primary';
  const fill =
    state === 'hover'
      ? destructive ? 'bg-error-bg' : 'bg-surface-selected'
      : state === 'pressed'
        ? destructive ? 'bg-error-pressed' : 'bg-row-pressed'
        : current
          ? 'bg-menu-current'
          : state === undefined && !disabled
            ? destructive
              ? 'hover:bg-error-bg active:bg-error-pressed'
              : 'hover:bg-surface-selected active:bg-row-pressed'
            : '';
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      aria-current={current || undefined}
      onClick={onClick}
      onFocus={(e) => setKbFocus(e.currentTarget.matches(':focus-visible'))}
      onBlur={() => setKbFocus(false)}
      // keyboard-active ring is drawn inside the row — still from editorRing()
      style={{ boxShadow: editorRing({ focused: state === 'keyboard' || kbFocus, inset: true }) }}
      className={`flex min-h-8 w-full shrink-0 items-center gap-2 rounded-chip px-2.5 py-1.5 text-left text-body outline-none disabled:cursor-not-allowed ${tone} ${fill}`}
    >
      <span className="flex grow flex-col">
        <span>{children}</span>
        {hint && <span className="text-hint text-text-tertiary">{hint}</span>}
      </span>
      {shortcut && <span className="text-hint text-text-subtle">{shortcut}</span>}
      {current && <span aria-hidden="true" className="text-brand">✓</span>}
    </button>
  );
}

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <span className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold tracking-[0.06em] text-text-tertiary uppercase">{children}</span>
);
const Divider = () => <div className="mx-1 my-1 h-px bg-border-subtle" />;
const Rows = ({ children }: { children: ReactNode }) => <div role="menu" className="flex flex-col p-1">{children}</div>;

/* ── Indicator picker ──────────────────────────────────────────── */

const CATEGORIES = ['All', 'Favourites', 'Trend', 'Momentum', 'Volume'];

/** Search matches are bold, never a blue fill. */
function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return <>{text.slice(0, i)}<b className="font-semibold">{text.slice(i, i + q.length)}</b>{text.slice(i + q.length)}</>;
}

export function IndicatorPicker({
  query: initialQuery = '',
  current,
  hoverRow,
  keyboardRow,
  options = DEMO_INDICATORS,
  onPick,
  valueDraft,
  onValue,
}: {
  query?: string;
  /** short name of the indicator already on the block (switching) */
  current?: string;
  /** Storybook: force a row's look */
  hoverRow?: number;
  keyboardRow?: number;
  options?: IndicatorOption[];
  onPick?: (o: IndicatorOption) => void;
  /** right side only: a fixed value like 50 instead of an indicator */
  valueDraft?: string;
  onValue?: (n: number) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [value, setValue] = useState(valueDraft ?? '');
  const num = Number(value);
  const valueOk = value.trim() !== '' && Number.isFinite(num);
  const [cat, setCat] = useState('All');
  const [favs, setFavs] = useState(() => new Set(options.filter((o) => o.fav).map((o) => o.short)));
  const q = query.trim();
  const list = options
    .filter((o) => (cat === 'Favourites' ? favs.has(o.short) : cat === 'All' || !o.category ? true : o.category === cat))
    .filter((o) => !q || o.name.toLowerCase().includes(q.toLowerCase()) || o.short.toLowerCase().includes(q.toLowerCase()));
  if (cat === 'All' && !q) list.sort((a, b) => Number(favs.has(b.short)) - Number(favs.has(a.short)));
  // searching puts the keyboard on the first match
  const kb = keyboardRow ?? (q ? 0 : undefined);

  return (
    <MenuSurface width={300} label="Pick an indicator">
      <div className="p-2 pb-1">
        <label className="flex h-8 items-center gap-2 rounded-control border border-border-control px-2.5 text-text-subtle focus-within:border-transparent" style={{ boxShadow: editorRing({ focused: true }) }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search indicators" aria-label="Search indicators" className="min-w-0 grow bg-transparent text-body text-text-primary outline-none placeholder:text-text-subtle" />
        </label>
      </div>
      {onValue && (
        <form
          className="flex items-center gap-2 px-2.5 pb-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (valueOk) onValue(num);
          }}
        >
          <span className="w-12 text-label text-text-tertiary">Value</span>
          <TextInput value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="e.g. 50" aria-label="Value" width={120} />
          <KitButton variant="secondary" type="submit" disabled={!valueOk}>Use</KitButton>
        </form>
      )}
      <div role="tablist" className="flex flex-wrap gap-1 px-2 pb-1">
        {CATEGORIES.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => setCat(c)} style={{ boxShadow: editorRing({ selected: cat === c }) }} className="h-6 rounded-chip bg-surface-selected px-2 text-label font-medium text-text-primary hover:bg-row-pressed">
            {c}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="flex flex-col gap-1 px-3 py-4">
          <span className="text-body text-text-primary">No indicator called "{q}"</span>
          <span className="text-label text-text-tertiary">Try a short name like EMA, or ask Copilot to build it.</span>
        </div>
      ) : (
        <>
          <SectionLabel>{q ? 'Matches' : cat === 'All' ? 'Favourites & recent' : cat}</SectionLabel>
          <Rows>
            {list.map((o, i) => {
              const fav = favs.has(o.short);
              return (
                <div key={o.short} className="flex items-center">
                  <MenuRow state={o.short === current ? 'current' : kb === i ? 'keyboard' : hoverRow === i ? 'hover' : undefined} onClick={() => onPick?.(o)}>
                    {highlight(o.name, q)} <span className="text-text-subtle">· {highlight(o.short, q)}</span>
                  </MenuRow>
                  <button
                    type="button"
                    aria-label={fav ? `Remove ${o.short} from favourites` : `Add ${o.short} to favourites`}
                    aria-pressed={fav}
                    onClick={() => setFavs((f) => { const n = new Set(f); if (fav) n.delete(o.short); else n.add(o.short); return n; })}
                    className={`flex size-8 shrink-0 items-center justify-center ${o.short === current ? '-ml-14 mr-6' : '-ml-9'} ${fav ? 'text-star' : 'text-border-dashed hover:text-text-subtle'}`}
                  >
                    <StarIcon size={14} filled={fav} />
                  </button>
                </div>
              );
            })}
          </Rows>
        </>
      )}
    </MenuSurface>
  );
}

/* ── Indicator settings ────────────────────────────────────────── */

export interface SettingField {
  key: string;
  label: string;
  value: string;
  /** a dropdown instead of a number */
  options?: string[];
  error?: string;
}

/** Changes apply as you type; bad input shows the reason on the field and keeps the last good value. */
export function IndicatorSettings({
  name = 'EMA',
  length = '9',
  error,
  typing = false,
  fields,
  onChange,
  onClose,
}: {
  name?: string;
  /** Storybook shortcut for the default EMA fields */
  length?: string;
  error?: string;
  typing?: boolean;
  fields?: SettingField[];
  onChange?: (key: string, value: string) => void;
  onClose?: () => void;
}) {
  const rows: SettingField[] = fields ?? [
    { key: 'length', label: 'Length', value: length, error },
    { key: 'source', label: 'Source', value: 'Close', options: ['Close', 'Open', 'High', 'Low'] },
    { key: 'offset', label: 'Offset', value: '0' },
  ];
  return (
    <MenuSurface width={280} label={`${name} settings`}>
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-body font-semibold">{name} · settings</span>
        <button type="button" aria-label="Close" onClick={onClose} className="text-text-secondary hover:text-text-primary"><CloseIcon size={14} /></button>
      </div>
      <div className="grid grid-cols-[88px_auto] items-start gap-x-2 gap-y-2.5 px-4 pt-2 pb-4 text-body text-text-secondary">
        {rows.length === 0 && <span className="col-span-2 text-label text-text-tertiary">Nothing to set for {name}.</span>}
        {rows.map((f, i) => (
          <div key={f.key} className="contents">
            <span className="pt-1">{f.label}</span>
            {f.options ? (
              <span className="relative w-[140px]">
                <select
                  value={f.value}
                  aria-label={f.label}
                  onChange={(e) => onChange?.(f.key, e.target.value)}
                  className="h-7 w-full appearance-none rounded-chip bg-surface-selected px-2 text-body font-medium text-text-primary outline-none"
                >
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
                <span className="pointer-events-none absolute top-1 right-2 text-text-secondary">⌄</span>
              </span>
            ) : (
              <TextInput
                {...(onChange ? { value: f.value } : { defaultValue: f.value })}
                onChange={(e) => onChange?.(f.key, e.target.value)}
                inputMode="decimal"
                error={f.error}
                autoFocus={i === 0}
                force={!onChange && (typing || f.error) && i === 0 ? { focused: true } : undefined}
                width={92}
                aria-label={f.label}
              />
            )}
          </div>
        ))}
      </div>
    </MenuSurface>
  );
}

/* ── Relation ──────────────────────────────────────────────────── */

const COMPARE = ['Greater Than', 'Greater Than or Equal', 'Less Than', 'Less Than or Equal', 'Equals', 'Not Equal'];
const CROSS = ['Cross Above', 'Cross Below'];

export function RelationMenu({ current, hoverRow, onPick }: { current?: string; hoverRow?: string; onPick?: (r: string) => void }) {
  const row = (r: string) => (
    <MenuRow key={r} state={r === current ? 'current' : r === hoverRow ? 'hover' : undefined} onClick={() => onPick?.(r)}>{r}</MenuRow>
  );
  return (
    <MenuSurface width={240} label="Pick the relation">
      <SectionLabel>Compare</SectionLabel>
      <Rows>{COMPARE.map(row)}</Rows>
      <Divider />
      <SectionLabel>Cross</SectionLabel>
      <Rows>{CROSS.map(row)}</Rows>
    </MenuSurface>
  );
}

/* ── Arithmetic ────────────────────────────────────────────────── */

export function ArithmeticMenu({
  on = 'SMA (Volume, 20)',
  op = '×',
  by = '1.5',
  onChange,
  onRemove,
}: {
  on?: string;
  op?: '+' | '−' | '×' | '÷';
  by?: string;
  /** called with a valid operator + amount (as you type) */
  onChange?: (op: '+' | '−' | '×' | '÷', by: number) => void;
  onRemove?: () => void;
}) {
  const [cur, setCur] = useState(op);
  const [amount, setAmount] = useState(by);
  const n = Number(amount);
  const error = amount.trim() === '' ? undefined : !Number.isFinite(n) ? 'Type a number' : cur === '÷' && n === 0 ? "Can't divide by 0" : undefined;
  const push = (o: typeof cur, a: string) => {
    const v = Number(a);
    if (a.trim() !== '' && Number.isFinite(v) && !(o === '÷' && v === 0)) onChange?.(o, v);
  };
  return (
    <MenuSurface width={250} label="Arithmetic">
      <div className="flex flex-col gap-3 p-4">
        <span className="text-label text-text-tertiary">Maths on {on}</span>
        <div role="radiogroup" aria-label="Operator" className="flex gap-1">
          {(['+', '−', '×', '÷'] as const).map((o) => (
            <button key={o} type="button" role="radio" aria-checked={cur === o} onClick={() => { setCur(o); push(o, amount); }} style={{ boxShadow: editorRing({ selected: cur === o }) }} className="size-8 rounded-chip bg-surface-selected text-body-lg font-semibold text-text-primary hover:bg-row-pressed">
              {o}
            </button>
          ))}
        </div>
        <label className="flex items-start gap-2 text-body text-text-secondary">
          <span className="pt-1">By</span>
          <TextInput value={amount} onChange={(e) => { setAmount(e.target.value); push(cur, e.target.value); }} inputMode="decimal" error={error} autoFocus width={80} aria-label="By" />
        </label>
        {onRemove && <div><KitButton variant="tertiary" onClick={onRemove}>Remove maths</KitButton></div>}
      </div>
    </MenuSurface>
  );
}

/* ── Logic node: only switches the logic ───────────────────────── */

export function LogicMenu({ current = 'Any of', onGroup = true, onPick }: { current?: LogicWord; onGroup?: boolean; onPick?: (w: LogicWord) => void }) {
  return (
    <MenuSurface width={230} label="Logic">
      <Rows>
        {LOGIC.map((l) => (
          <MenuRow key={l.word} hint={l.hint} state={l.word === current ? 'current' : undefined} onClick={() => onPick?.(l.word)}>{l.word}</MenuRow>
        ))}
      </Rows>
      {onGroup && <span className="border-t border-border-subtle px-3.5 py-2 text-hint text-text-tertiary">Group actions are in ⋯ on the group</span>}
    </MenuSurface>
  );
}

/* ── Timing chip ───────────────────────────────────────────────── */

export function TimingMenu({ current = 'On candle close', onPick }: { current?: string; onPick?: (t: 'On candle close' | 'During the candle') => void }) {
  return (
    <MenuSurface width={260} label="When to check">
      <Rows>
        <MenuRow hint="Checks once each candle finishes" state={current === 'On candle close' ? 'current' : undefined} onClick={() => onPick?.('On candle close')}>On candle close</MenuRow>
        <MenuRow hint="Checks on every price update; more signals, more noise" state={current === 'During the candle' ? 'current' : undefined} onClick={() => onPick?.('During the candle')}>During the candle</MenuRow>
      </Rows>
    </MenuSurface>
  );
}

/* ── ⋯ menus (rare actions only; Select is the checkbox, not here) ── */

export interface BlockMenuActions {
  onDuplicate?: () => void;
  onAddBelow?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
}

export function BlockMenu({ hoverRow, onDuplicate, onAddBelow, onCopy, onDelete, onShowInCode }: { hoverRow?: number; onShowInCode?: () => void } & BlockMenuActions) {
  return (
    <MenuSurface width={220} label="Condition actions">
      <Rows>
        {/* while the Pine Script view is open */}
        {onShowInCode && <MenuRow onClick={onShowInCode}>Show in code</MenuRow>}
        <MenuRow shortcut="⌘D" state={hoverRow === 0 ? 'hover' : undefined} onClick={onDuplicate}>Duplicate</MenuRow>
        <MenuRow state={hoverRow === 1 ? 'hover' : undefined} onClick={onAddBelow}>Add condition below</MenuRow>
        <MenuRow shortcut="⌘C" state={hoverRow === 2 ? 'hover' : undefined} onClick={onCopy}>Copy as text</MenuRow>
        <Divider />
        <MenuRow destructive shortcut="⌫" state={hoverRow === 3 ? 'hover' : undefined} onClick={onDelete}>Delete</MenuRow>
      </Rows>
    </MenuSurface>
  );
}

export function GroupMenu({ onAdd, onDuplicate, onUngroup, onDelete }: { onAdd?: () => void; onDuplicate?: () => void; onUngroup?: () => void; onDelete?: () => void }) {
  return (
    <MenuSurface width={240} label="Group actions">
      <Rows>
        <MenuRow onClick={onAdd}>Add condition to group</MenuRow>
        <MenuRow shortcut="⌘D" onClick={onDuplicate}>Duplicate group</MenuRow>
        <MenuRow hint="Conditions move up a level" onClick={onUngroup}>Ungroup</MenuRow>
        <Divider />
        <MenuRow destructive shortcut="⌫" hint="Deletes its conditions too · Undo" onClick={onDelete}>Delete group</MenuRow>
      </Rows>
    </MenuSurface>
  );
}
