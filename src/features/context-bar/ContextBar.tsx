import { useState, type ReactNode } from 'react';
import { ChevronDownIcon } from '@/components/ui/icons';
import { MenuSurface, Popover } from '@/components/ui/Popover';
import { shortLabel } from '@/lib/describeChartData';
import { instruments, timeframes } from '@/mock/instruments';
import { useWorkspace } from '@/store/workspace';
import { ChartDataDialog } from './ChartDataDialog';

/*
  Context bar (K01): one grouped control —
  Instrument NIFTY ⌄ | Chart Spot ⌄ | Timeframe 15m ⌄
  Only one menu is open at a time; the group border darkens while open.
*/

type Menu = 'instrument' | 'chart' | 'timeframe' | null;

export function ContextBar() {
  const { instrument, chartData, timeframe, setInstrument, setTimeframe } = useWorkspace();
  const [open, setOpen] = useState<Menu>(null);
  const close = () => setOpen(null);
  const toggle = (m: Menu) => setOpen((cur) => (cur === m ? null : m));

  return (
    <div className="relative z-10 flex h-contextbar shrink-0 items-center gap-2.5 border-b border-border-subtle px-5">
      <div
        className={`flex items-center rounded-segment border bg-surface ${
          open ? 'border-border-strong' : 'border-border-control'
        }`}
      >
        {/* Instrument (K03) */}
        <Popover
          open={open === 'instrument'}
          onClose={close}
          trigger={
            <Trigger label="Instrument" value={instrument} active={open === 'instrument'} onClick={() => toggle('instrument')} first />
          }
        >
          <InstrumentMenu
            value={instrument}
            onPick={(i) => {
              setInstrument(i);
              close();
            }}
          />
        </Popover>

        {/* Chart data (K02, K06–K10) — wide dialog with Apply / Cancel */}
        <Popover
          open={open === 'chart'}
          onClose={close}
          trigger={
            <Trigger label="Chart" value={shortLabel(chartData)} active={open === 'chart'} onClick={() => toggle('chart')} />
          }
        >
          <ChartDataDialog onClose={close} />
        </Popover>

        {/* Timeframe (K04) — quick grid */}
        <Popover
          open={open === 'timeframe'}
          onClose={close}
          trigger={
            <Trigger label="Timeframe" value={timeframe} active={open === 'timeframe'} onClick={() => toggle('timeframe')} />
          }
        >
          <MenuSurface width={230} label="Timeframe">
            <div className="grid grid-cols-4 gap-1 p-1">
              {timeframes.map((tf) => {
                const on = tf === timeframe;
                return (
                  <button
                    key={tf}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => {
                      setTimeframe(tf);
                      close();
                    }}
                    className={`h-8 rounded-segment-item border text-chip ${
                      on
                        ? 'border-brand bg-brand-tint font-semibold text-brand-text'
                        : 'border-border-control bg-surface font-medium hover:bg-surface-hover'
                    }`}
                  >
                    {tf}
                  </button>
                );
              })}
            </div>
          </MenuSurface>
        </Popover>
      </div>
    </div>
  );
}

function Trigger({
  label,
  value,
  active,
  onClick,
  first,
}: {
  label: string;
  value: ReactNode;
  active: boolean;
  onClick: () => void;
  first?: boolean;
}) {
  return (
    <button
      type="button"
      aria-haspopup="listbox"
      aria-expanded={active}
      aria-label={`${label}: ${value}`}
      onClick={onClick}
      className={`flex h-[34px] items-center gap-[7px] px-3 text-body ${first ? 'rounded-l-segment' : 'border-l border-border-control'} ${
        active ? 'bg-brand-tint' : 'hover:bg-surface-hover'
      }`}
    >
      <span className="text-label text-text-subtle">{label}</span>
      <span className="font-semibold whitespace-nowrap text-text-primary">{value}</span>
      <span className={`text-text-subtle transition-transform ${active ? 'rotate-180' : ''}`}>
        <ChevronDownIcon size={11} />
      </span>
    </button>
  );
}

function InstrumentMenu({ value, onPick }: { value: string; onPick: (i: (typeof instruments)[number]['id']) => void }) {
  const [query, setQuery] = useState('');
  const list = instruments.filter((i) => i.id.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <MenuSurface width={300} label="Instrument">
      <input
        autoFocus
        aria-label="Search instruments"
        placeholder="Search instrument"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && list[0] && onPick(list[0].id)}
        className="mx-1 mt-0.5 mb-1.5 h-8 rounded-segment-item border border-border-control px-2.5 font-sans text-chip outline-none focus:border-brand"
      />
      {list.map((i) => {
        const on = i.id === value;
        return (
          <button
            key={i.id}
            type="button"
            role="option"
            aria-selected={on}
            onClick={() => onPick(i.id)}
            className={`flex h-[34px] items-center justify-between rounded-segment-item px-2.5 text-body ${
              on ? 'bg-brand-tint font-semibold' : 'hover:bg-surface-hover'
            }`}
          >
            {i.id}
            <span className="text-hint font-normal text-text-subtle">{i.kind}</span>
          </button>
        );
      })}
      {list.length === 0 && (
        <p className="m-0 px-2.5 py-3 text-chip text-text-muted">No instrument matches "{query}"</p>
      )}
    </MenuSurface>
  );
}
