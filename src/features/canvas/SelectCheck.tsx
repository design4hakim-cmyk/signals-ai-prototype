import { useCanvas, useSelectionParent } from '@/store/canvas';

/*
  The checkbox at the start of a block or group box.
    • Hidden until you hover the block (it slides in).
    • Tick one, and every block that can be grouped with it — its siblings in the
      same box — shows an empty checkbox, ready to tick. Blocks elsewhere stay plain.
    • Two or more ticked → the dark bar offers Group as ANY OF / ALL OF.
*/

// Tailwind needs whole class names, so each hover scope is spelled out
const REVEAL = {
  block: 'group-hover/block:w-4 group-hover/block:mr-0 group-hover/block:opacity-100',
  box: 'group-hover/box:w-4 group-hover/box:mr-0 group-hover/box:opacity-100',
};

export function SelectCheck({ id, parentId, label, scope }: { id: string; parentId: string; label: string; scope: 'block' | 'box' }) {
  const selected = useCanvas((s) => s.selected.includes(id));
  const selParent = useSelectionParent();
  const toggleSelect = useCanvas((s) => s.toggleSelect);
  const groupable = !selected && selParent !== null && selParent === parentId;
  const shown = selected || groupable;

  return (
    <span
      className={`flex shrink-0 overflow-hidden transition-[width,margin,opacity] duration-150 ease-out ${
        shown ? 'mr-0 w-4 opacity-100' : `${scope === 'block' ? '-mr-2.5' : '-mr-1'} w-0 opacity-0 ${REVEAL[scope]}`
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={selected ? `Unselect ${label}` : `Select ${label}`}
        title={selected ? undefined : groupable ? 'Add to selection, then group' : 'Select to group or move'}
        onClick={(e) => {
          e.stopPropagation();
          toggleSelect(id);
        }}
        className={`flex size-4 items-center justify-center rounded-[4px] border-[1.5px] transition-colors ${
          selected
            ? 'border-brand bg-brand text-text-on-brand'
            : groupable
              ? 'border-brand-border bg-surface hover:border-brand hover:bg-brand-tint'
              : 'border-border-strong bg-surface hover:border-brand'
        }`}
      >
        {selected && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12l5 5 9-10" />
          </svg>
        )}
      </button>
    </span>
  );
}
