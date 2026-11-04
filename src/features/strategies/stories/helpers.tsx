import { useState, type ReactNode } from 'react';
import { SAVED_STRATEGIES } from '@/mock/savedStrategies';
import { useLibrary } from '@/store/library';

/* Story layout + store setup for the My Strategies panel. */

export function Board({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col gap-4 bg-surface-canvas p-8 font-sans text-text-primary">
      <div>
        <h2 className="m-0 text-[18px] font-semibold">{title}</h2>
        {note && <p className="m-0 mt-1 max-w-[760px] text-label text-text-tertiary">{note}</p>}
      </div>
      {children}
    </div>
  );
}

export function Tile({ label, children, width }: { label: string; children: ReactNode; width?: number }) {
  return (
    <figure className="m-0 inline-flex flex-col items-start gap-2">
      <div className="rounded-card border border-border-control bg-surface p-1.5" style={{ width }}>{children}</div>
      <figcaption className="text-hint text-text-tertiary">{label}</figcaption>
    </figure>
  );
}

export const Wrap = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap items-start gap-6">{children}</div>;

type LibraryPatch = Partial<ReturnType<typeof useLibrary.getState>>;

/** Puts the panel's store into a given state before the story renders. */
export function WithLibrary({ state, children }: { state: LibraryPatch; children: ReactNode }) {
  useState(() => {
    useLibrary.setState(useLibrary.getInitialState(), true);
    useLibrary.setState({ strategies: SAVED_STRATEGIES, loading: false, ...state });
    return true;
  });
  return <>{children}</>;
}

/** The panel at app height, like it sits beside the builder. */
export const PanelFrame = ({ children, label }: { children: ReactNode; label: string }) => (
  <figure className="m-0 inline-flex flex-col gap-2">
    <div className="h-[760px] w-[292px] overflow-hidden rounded-card border border-border-control bg-surface-canvas">{children}</div>
    <figcaption className="text-hint text-text-tertiary">{label}</figcaption>
  </figure>
);
