import { useState, type ReactNode } from 'react';
import { ChevronDownIcon, CloseIcon, StarIcon } from '@/components/ui/icons';
import { INDICATORS, MATH_OPS, RELATIONS, fmtNum, indicatorDef, inputFields } from '@/lib/indicators';
import type { Band, IndicatorParams, Logic, MathStep, Operand, Relation, Source } from '@/types/strategy';

/*
  The floating menus and dialogs of the canvas builder.
  Each one only reports what was picked; the block decides what to do with it.
*/

/* ── Shared surfaces ───────────────────────────────────────────── */

function Panel({ title, width, children, label }: { title?: string; width: number; children: ReactNode; label: string }) {
  return (
    <div role="dialog" aria-label={label} style={{ width }} className="flex flex-col overflow-hidden rounded-card border border-border-control bg-surface shadow-menu">
      {title && <div className="border-b border-border-divider bg-surface-hover px-4 py-3 text-body-lg font-semibold">{title}</div>}
      {children}
    </div>
  );
}

function Item({ children, onClick, on, danger, hint, disabled }: { children: ReactNode; onClick: () => void; on?: boolean; danger?: boolean; hint?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[34px] w-full shrink-0 items-center justify-between rounded-chip px-2.5 text-left text-body ${
        danger ? 'text-danger' : 'text-text-primary'
      } ${on ? 'bg-surface-selected' : 'hover:bg-surface-hover'} disabled:cursor-not-allowed disabled:text-text-disabled disabled:hover:bg-transparent`}
    >
      {children}
      {hint && <span className="text-hint text-text-subtle">{hint}</span>}
    </button>
  );
}

const Divider = () => <div className="my-1 h-px bg-border-subtle" />;

/* ── Indicator picker (B02, B06, E02) ──────────────────────────── */

// Favourites live for the session, shared by every picker
const favourites = new Set(['ema', 'rsi']);

export function IndicatorPicker({ value, allowNumber, onPick }: { value: Operand | null; allowNumber: boolean; onPick: (o: Operand) => void }) {
  const [query, setQuery] = useState('');
  const [favOpen, setFavOpen] = useState(false);
  const [, rerender] = useState(0);
  const [numDraft, setNumDraft] = useState(value?.type === 'number' ? String(value.value) : '');
  const q = query.trim().toLowerCase();
  const list = INDICATORS.filter((d) => (favOpen ? favourites.has(d.id) : true) && (!q || d.menu.toLowerCase().includes(q) || d.short.toLowerCase().includes(q)));
  const current = value?.type === 'indicator' ? value.id : null;
  const num = Number(numDraft);
  const numOk = numDraft.trim() !== '' && Number.isFinite(num);

  return (
    <Panel title="Indicators" width={300} label="Pick an indicator">
      <div className="px-3 pt-2 pb-1.5">
        <input
          autoFocus
          aria-label="Search indicators"
          placeholder="Search indicators"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 w-full rounded-[7px] border border-border-control px-2.5 text-chip outline-none focus:border-brand"
        />
      </div>
      {allowNumber && (
        // A fixed value like "50" or "20" (B08). Not on the board's list; added so conditions like RSI > 50 can be built.
        <form
          className="flex items-center gap-2 px-3 pb-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (numOk) onPick({ type: 'number', value: num });
          }}
        >
          <span className="w-[62px] text-label font-medium text-text-secondary">NUMBER</span>
          <input
            aria-label="Number"
            inputMode="decimal"
            placeholder="e.g. 50"
            value={numDraft}
            onChange={(e) => setNumDraft(e.target.value)}
            className="h-8 min-w-0 grow rounded-[7px] border border-border-control px-2.5 text-chip outline-none focus:border-brand"
          />
          <button type="submit" disabled={!numOk} className="h-8 rounded-[7px] border border-brand px-3 text-label font-medium text-brand hover:bg-brand-tint disabled:border-border-control disabled:text-text-disabled disabled:hover:bg-transparent">
            Use
          </button>
        </form>
      )}
      <button type="button" onClick={() => setFavOpen((o) => !o)} className="flex h-9 items-center gap-2 border-y border-border-subtle px-3 text-label text-text-secondary hover:bg-surface-hover">
        <StarIcon size={14} filled={favOpen} />
        <span className="grow text-left">FAVOURITE · {favourites.size}</span>
        <span className={`transition-transform ${favOpen ? 'rotate-90' : ''}`}>›</span>
      </button>
      <div className="flex max-h-[300px] flex-col gap-px overflow-auto p-1.5">
        {list.length === 0 && <p className="m-0 px-2.5 py-3 text-label text-text-subtle">{favOpen ? 'Star an indicator to keep it here.' : 'No indicator by that name.'}</p>}
        {list.map((d) => (
          <div key={d.id} className={`flex h-[34px] shrink-0 items-center rounded-chip ${current === d.id ? 'bg-surface-selected' : 'hover:bg-surface-hover'}`}>
            <button
              type="button"
              onClick={() => onPick({ type: 'indicator', id: d.id, params: { ...indicatorDef(d.id).defaults } })}
              className="h-full grow px-2.5 text-left text-label text-text-primary"
            >
              {d.menu}
            </button>
            <button
              type="button"
              aria-label={favourites.has(d.id) ? `Remove ${d.short} from favourites` : `Add ${d.short} to favourites`}
              onClick={() => {
                if (favourites.has(d.id)) favourites.delete(d.id);
                else favourites.add(d.id);
                rerender((n) => n + 1);
              }}
              className={`flex h-full w-9 items-center justify-center ${favourites.has(d.id) ? 'text-text-primary' : 'text-border-group hover:text-text-secondary'}`}
            >
              <StarIcon filled={favourites.has(d.id)} />
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ── Indicator settings (B03, E03) ─────────────────────────────── */

const FIELD_LABEL: Record<keyof IndicatorParams, string> = {
  length: 'Length', source: 'Source', offset: 'Offset', mult: 'StdDev', band: 'Band', k: '%K length', d: 'Smoothing',
};
const SOURCES: Source[] = ['Close', 'Open', 'High', 'Low', 'Volume'];
const BANDS: Band[] = ['Upper', 'Middle', 'Lower'];

export function SettingsDialog({ operand, onSave, onClose }: { operand: Extract<Operand, { type: 'indicator' }>; onSave: (p: IndicatorParams) => void; onClose: () => void }) {
  const def = indicatorDef(operand.id);
  const [draft, setDraft] = useState<IndicatorParams>(operand.params);
  const fields = inputFields(operand.id);
  const ctl = 'h-8 w-[120px] rounded-chip border border-border-chip bg-surface px-2 text-body text-text-primary outline-none focus:border-brand';
  const numberOk = (k: keyof IndicatorParams) => k === 'source' || k === 'band' || (Number.isFinite(draft[k] as number) && (k === 'offset' || (draft[k] as number) > 0));
  const valid = fields.every(numberOk);

  return (
    <Panel width={320} label={`${def.short} settings`}>
      <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5">
        <span className="text-[16px] font-semibold">{def.short}</span>
        <button type="button" aria-label="Close" onClick={onClose} className="text-text-secondary hover:text-text-primary">
          <CloseIcon />
        </button>
      </div>
      <div role="tablist" className="flex gap-[18px] border-b-2 border-surface-selected px-4">
        <button type="button" role="tab" aria-selected="true" className="-mb-0.5 h-8 border-b-2 border-text-primary text-[13.5px] font-semibold">
          Inputs
        </button>
        {/* Style and Visibility are on the board; nothing to set in the prototype yet */}
        <button type="button" role="tab" aria-selected="false" disabled title="Coming later" className="h-8 text-[13.5px] text-text-subtle">Style</button>
        <button type="button" role="tab" aria-selected="false" disabled title="Coming later" className="h-8 text-[13.5px] text-text-subtle">Visibility</button>
      </div>
      <div className="flex flex-col gap-2.5 px-4 py-3.5">
        {fields.length === 0 && <p className="m-0 text-label text-text-tertiary">Volume has no settings.</p>}
        {fields.map((k) => (
          <label key={k} className="grid grid-cols-[96px_120px] items-center gap-2 text-body text-text-control">
            <span>{FIELD_LABEL[k]}</span>
            {k === 'source' || k === 'band' ? (
              <span className="relative">
                <select
                  value={draft[k]}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                  className={`${ctl} appearance-none pr-6`}
                >
                  {(k === 'source' ? SOURCES : BANDS).map((o) => <option key={o}>{o}</option>)}
                </select>
                <span className="pointer-events-none absolute top-2.5 right-2 text-text-secondary"><ChevronDownIcon /></span>
              </span>
            ) : (
              <input
                type="number"
                step={k === 'mult' ? 0.1 : 1}
                value={Number.isNaN(draft[k]) ? '' : (draft[k] as number)}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value === '' ? NaN : Number(e.target.value) })}
                aria-invalid={!numberOk(k)}
                className={`${ctl} ${numberOk(k) ? '' : 'border-sell'}`}
              />
            )}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-border-subtle px-4 py-3">
        <button type="button" onClick={() => setDraft({ ...def.defaults })} className="h-8 rounded-chip border border-border-chip px-2.5 text-body hover:bg-surface-hover">
          Defaults
        </button>
        <span className="grow" />
        <button type="button" onClick={onClose} className="h-8 rounded-chip border border-text-primary px-3.5 text-body hover:bg-surface-hover">
          Cancel
        </button>
        {/* Dark, not blue: the board keeps blue for the page's one main action */}
        <button type="button" disabled={!valid} onClick={() => onSave(draft)} className="h-8 rounded-chip bg-text-primary px-3.5 text-body text-text-on-brand disabled:bg-action-disabled">
          Ok
        </button>
      </div>
    </Panel>
  );
}

/* ── Arithmetic (B04) ──────────────────────────────────────────── */

export function MathMenu({ current, onSet }: { current?: MathStep; onSet: (m: MathStep | null) => void }) {
  const [op, setOp] = useState<MathStep['op'] | null>(null);
  const [draft, setDraft] = useState(current ? fmtNum(current.value) : '');
  const value = Number(draft);
  const ok = draft.trim() !== '' && Number.isFinite(value) && !(op === '÷' && value === 0);

  if (op)
    return (
      <Panel title="Arithmetic Operations" width={260} label="Arithmetic">
        <form
          className="flex flex-col gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) onSet({ op, value });
          }}
        >
          <label className="flex items-center gap-2 text-body">
            <span className="w-[90px] font-medium">{MATH_OPS.find((m) => m.id === op)!.menu}</span>
            <input
              autoFocus
              inputMode="decimal"
              aria-label="Value"
              placeholder={op === '×' || op === '÷' ? 'e.g. 1.5' : 'e.g. 10'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 w-[100px] rounded-chip border border-border-chip px-2 outline-none focus:border-brand"
            />
          </label>
          {op === '÷' && value === 0 && draft !== '' && <span className="text-label text-sell-text">Can't divide by 0</span>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOp(null)} className="h-8 rounded-chip border border-border-chip px-3 text-body hover:bg-surface-hover">Back</button>
            <button type="submit" disabled={!ok} className="h-8 rounded-chip bg-text-primary px-3.5 text-body text-text-on-brand disabled:bg-action-disabled">Ok</button>
          </div>
        </form>
      </Panel>
    );

  return (
    <Panel title="Arithmetic Operations" width={260} label="Arithmetic">
      <div role="menu" className="flex flex-col px-2 pt-1.5 pb-2">
        {MATH_OPS.map((m) => (
          <Item key={m.id} on={current?.op === m.id} onClick={() => setOp(m.id)}>
            {m.menu}
            <span className="text-border-group"><StarIcon /></span>
          </Item>
        ))}
        {current && (
          <>
            <Divider />
            <Item danger onClick={() => onSet(null)}>Remove arithmetic</Item>
          </>
        )}
      </div>
    </Panel>
  );
}

/* ── Relation (B05) ────────────────────────────────────────────── */

export function RelationMenu({ value, onPick }: { value: Relation | null; onPick: (r: Relation) => void }) {
  return (
    <Panel title="Comparison Operations" width={260} label="Pick the relation">
      <div role="menu" className="flex flex-col px-2 pt-1.5 pb-2">
        {RELATIONS.map((r) => (
          <Item key={r.id} on={value === r.id} onClick={() => onPick(r.id)}>
            {r.menu}
            <span className="text-border-group"><StarIcon /></span>
          </Item>
        ))}
      </div>
    </Panel>
  );
}

/* ── AND / OR (B07) ────────────────────────────────────────────── */

export function LogicMenu({ value, selectedCount, onPick, onGroup }: { value: Logic; selectedCount: number; onPick: (l: Logic) => void; onGroup: () => void }) {
  const row = (l: Logic, hint: string) => (
    <button type="button" role="menuitemradio" aria-checked={value === l} onClick={() => onPick(l)} className={`flex flex-col gap-px px-3.5 py-2 text-left ${value === l ? 'bg-brand-tint' : 'hover:bg-surface-hover'}`}>
      <span className="text-body font-semibold">{l}</span>
      <span className="text-hint text-text-tertiary">{hint}</span>
    </button>
  );
  return (
    <Panel width={230} label="Join conditions with">
      <div role="menu" className="flex flex-col py-1.5">
        {row('AND', 'All conditions must be true')}
        {row('OR', 'Any one is enough')}
        <div className="my-1 h-px bg-border-subtle" />
        <button
          type="button"
          disabled={selectedCount < 2}
          title={selectedCount < 2 ? 'Shift-click two or more conditions first' : undefined}
          onClick={onGroup}
          className="px-3.5 py-2 text-left text-body hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-text-disabled disabled:hover:bg-transparent"
        >
          Group selected conditions
        </button>
      </div>
    </Panel>
  );
}

/* ── ⋯ on a block (E04) ────────────────────────────────────────── */

export function MoreMenu({ onDuplicate, onSelect, onAddBelow, onDelete }: { onDuplicate: () => void; onSelect: () => void; onAddBelow: () => void; onDelete: () => void }) {
  return (
    <div role="menu" aria-label="Condition actions" className="flex w-[210px] flex-col rounded-block border border-border-control bg-surface p-1 shadow-menu">
      <Item hint="⌘D" onClick={onDuplicate}>Duplicate</Item>
      <Item hint="Shift-click" onClick={onSelect}>Select</Item>
      <Item onClick={onAddBelow}>Add condition below</Item>
      <Divider />
      <Item danger hint="⌫" onClick={onDelete}>Delete</Item>
    </div>
  );
}

/* ── Box label menu (E08) ──────────────────────────────────────── */

export function GroupMenu({ logic, onSwitch, onAdd, onUngroup, onDelete }: { logic: Logic; onSwitch: () => void; onAdd: () => void; onUngroup: () => void; onDelete: () => void }) {
  return (
    <div role="menu" aria-label="Box actions" className="flex w-[220px] flex-col rounded-block border border-border-control bg-surface p-1 shadow-menu">
      <Item onClick={onSwitch}>Switch to {logic === 'OR' ? 'ALL OF · AND' : 'ANY OF · OR'}</Item>
      <Item onClick={onAdd}>Add condition to group</Item>
      <Divider />
      <Item onClick={onUngroup}>Ungroup</Item>
      <Item danger onClick={onDelete}>Delete group</Item>
    </div>
  );
}
