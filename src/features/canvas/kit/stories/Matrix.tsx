import type { ReactNode } from 'react';

/*
  Story layout helpers: a labelled grid like the component sheets
  (rows = own look, columns = editor state).
*/

export function Matrix<R extends string, C extends string>({
  rows,
  cols,
  render,
  rowHint,
}: {
  rows: readonly R[];
  cols: readonly C[];
  render: (row: R, col: C) => ReactNode;
  rowHint?: Partial<Record<R, string>>;
}) {
  const name = (r: string) => r[0].toUpperCase() + r.slice(1);
  return (
    <div className="overflow-x-auto rounded-card border border-border-control bg-surface">
      <table className="border-collapse text-left">
        <thead>
          <tr className="border-b border-border-subtle">
            <th className="px-4 py-2.5 text-[10.5px] font-semibold tracking-[0.06em] text-text-tertiary uppercase">State →</th>
            {cols.map((c) => (
              <th key={c} className="px-4 py-2.5 text-[10.5px] font-semibold tracking-[0.06em] whitespace-nowrap text-text-tertiary uppercase">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r} className="border-b border-border-subtle last:border-b-0">
              <th className="px-4 py-4 align-top">
                <span className="block text-body font-semibold">{name(r)}</span>
                {rowHint?.[r] && <span className="block max-w-[180px] text-hint font-normal text-text-tertiary">{rowHint[r]}</span>}
              </th>
              {cols.map((c) => (
                <td key={c} className="px-4 py-4 align-top">
                  {render(r, c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A captioned example, like the grey labels under each board tile. */
export function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="m-0 inline-flex flex-col items-start gap-2">
      {children}
      <figcaption className="text-hint text-text-tertiary">{label}</figcaption>
    </figure>
  );
}

/** Page wrapper: dotted canvas background, room for rings. */
export function Board({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="bg-canvas-dots flex min-h-screen flex-col gap-4 p-8 font-sans text-text-primary">
      <div>
        <h2 className="m-0 text-[18px] font-semibold">{title}</h2>
        {note && <p className="m-0 mt-1 max-w-[760px] text-label text-text-tertiary">{note}</p>}
      </div>
      {children}
    </div>
  );
}

export const Wrap = ({ children, gap = 6 }: { children: ReactNode; gap?: number }) => (
  <div className="flex flex-wrap items-start" style={{ gap: gap * 4 }}>
    {children}
  </div>
);
