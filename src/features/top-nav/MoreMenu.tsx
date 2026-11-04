import { useState } from 'react';
import { Popover } from '@/components/ui/Popover';
import { RemembersItemMark, RemembersPanel } from '@/features/copilot/Remembers';
import { useLibrary } from '@/store/library';
import { useStrategy } from '@/store/strategy';

/*
  ⋯ More strategy actions. Saved strategies only; items follow the state:
    Rename · Save as copy · Move to · Discard changes (only when edited) · Delete
  Delete is blocked, with the reason, while a forward test or live run is on.
*/

const FOLDERS = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'Experiments'];

export function MoreMenu({ trading }: { trading: boolean }) {
  const st = useStrategy();
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [remembers, setRemembers] = useState(false);
  const openId = useLibrary((l) => l.openId);
  const close = () => {
    setOpen(false);
    setMoveOpen(false);
    setRemembers(false);
  };

  return (
    <Popover
      open={open}
      onClose={close}
      trigger={
        <button
          type="button"
          aria-label="More strategy actions"
          aria-haspopup="menu"
          onClick={() => setOpen((o) => !o)}
          className={`flex size-[30px] shrink-0 items-center justify-center rounded-segment-item text-text-secondary ${
            open ? 'bg-surface-selected' : 'hover:bg-surface-selected'
          }`}
        >
          ⋯
        </button>
      }
    >
      {remembers && openId ? (
        <RemembersPanel strategyId={openId} name={st.name ?? 'this strategy'} />
      ) : (
      <div role="menu" aria-label="Strategy actions" className="flex w-[240px] flex-col rounded-block border border-border-control bg-surface p-1.5 shadow-popover">
        {openId && (
          <>
            <Item onClick={() => setRemembers(true)}>
              <span className="flex w-full items-center justify-between">What Copilot remembers <RemembersItemMark /></span>
            </Item>
            <div className="my-1 h-px bg-border-subtle" />
          </>
        )}
        <Item onClick={() => { close(); st.showToast('Click the name to rename it'); }}>Rename</Item>
        <Item
          onClick={() => {
            close();
            st.set({ name: `${st.name} copy`, dirty: false, forwardTests: [], liveTrades: [] });
            st.showToast('Saved as a copy. You are now editing the copy.');
          }}
        >
          Save as copy
        </Item>
        <Item onClick={() => setMoveOpen((m) => !m)}>
          <span className="flex w-full justify-between">
            Move to <span className="text-text-subtle">{moveOpen ? '▾' : '▸'}</span>
          </span>
        </Item>
        {moveOpen &&
          FOLDERS.map((f) => (
            <Item key={f} indent onClick={() => { close(); st.showToast(`Moved to ${f}`); }}>
              {f}
            </Item>
          ))}
        {st.dirty && (
          <Item onClick={() => { close(); st.discard(); }} hint="Back to the last saved version">
            Discard changes
          </Item>
        )}
        <div className="my-1 h-px bg-border-subtle" />
        <Item
          danger
          disabled={trading}
          hint={trading ? 'Stop the forward test or live run first' : undefined}
          onClick={() => {
            close();
            st.set({ name: null, saved: false, dirty: false, entry: 'empty' });
            st.showToast('Strategy deleted');
          }}
        >
          Delete strategy
        </Item>
      </div>
      )}
    </Popover>
  );
}

function Item({
  children,
  onClick,
  hint,
  danger,
  disabled,
  indent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-start gap-px rounded-segment-item px-2.5 py-2 text-left text-body enabled:hover:bg-row-hover disabled:cursor-not-allowed ${
        indent ? 'pl-6' : ''
      } ${danger ? (disabled ? 'text-text-disabled' : 'text-sell-text') : 'text-text-primary'}`}
    >
      {children}
      {hint && <span className="text-hint text-text-tertiary">{hint}</span>}
    </button>
  );
}
