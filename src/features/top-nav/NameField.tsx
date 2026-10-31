import { useState } from 'react';
import { useStrategy } from '@/store/strategy';

/*
  The strategy name.
  • Untitled until first save.
  • Save turns the name into a field in place — no modal. Enter saves, Esc cancels.
  • Click a saved name to rename. Long names cut with an ellipsis (max 300px), full name on hover.
  • Duplicate names are caught inline.
*/

export function NameField() {
  const st = useStrategy();
  const [renaming, setRenaming] = useState(false);
  const naming = st.saveStatus === 'naming';

  if (naming || renaming) {
    return (
      <NameInput
        initial={st.name ?? ''}
        taken={st.savedNames}
        submitLabel={naming ? 'Save' : 'Rename'}
        onCancel={() => (naming ? st.cancelNaming() : setRenaming(false))}
        onSubmit={(name) => {
          if (naming) st.save(name);
          else {
            st.rename(name);
            setRenaming(false);
          }
        }}
      />
    );
  }

  const label = st.name ?? 'Untitled strategy';
  return (
    <button
      type="button"
      title={st.saved ? `${label} · click to rename` : label}
      onClick={() => st.saved && setRenaming(true)}
      className={`max-w-[300px] min-w-0 truncate text-left text-title font-semibold ${
        st.name ? 'text-text-primary' : 'text-text-muted'
      } ${st.saved ? 'cursor-text rounded-chip px-1 hover:bg-surface-hover' : 'cursor-default'}`}
    >
      {label}
    </button>
  );
}

function NameInput({
  initial,
  taken,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: string;
  taken: string[];
  submitLabel: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const trimmed = value.trim();
  const duplicate = trimmed !== initial && taken.some((t) => t.toLowerCase() === trimmed.toLowerCase());
  const valid = trimmed.length > 0 && !duplicate;

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        aria-label="Strategy name"
        placeholder="Strategy name"
        value={value}
        maxLength={80}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valid) onSubmit(trimmed);
          if (e.key === 'Escape') onCancel();
        }}
        className={`h-[30px] w-[260px] rounded-segment-item border px-2.5 font-sans text-body font-semibold outline-none ${
          duplicate ? 'border-sell' : 'border-brand'
        }`}
      />
      {duplicate ? (
        <span className="text-label text-sell-text">Name already used</span>
      ) : (
        <>
          <button
            type="button"
            disabled={!valid}
            onClick={() => onSubmit(trimmed)}
            className="h-[30px] rounded-segment-item border border-brand bg-surface px-3 text-body font-medium text-brand disabled:border-border-control disabled:text-text-disabled"
          >
            {submitLabel}
          </button>
          <button type="button" onClick={onCancel} className="text-body text-text-tertiary hover:text-text-primary">
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
