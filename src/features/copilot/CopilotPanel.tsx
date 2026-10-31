import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { ArrowIcon, CopilotIcon, HistoryIcon, MicIcon, PlusIcon } from '@/components/ui/icons';
import { copilotStarters, mockUser } from '@/mock/copilot';

/** Right panel: Signals Copilot, empty state (420px wide) */
export function CopilotPanel() {
  const [draft, setDraft] = useState('');
  const canSend = draft.trim().length > 0;

  return (
    <aside aria-label="Signals Copilot" className="flex w-copilot shrink-0 flex-col">
      <div className="flex h-topbar shrink-0 items-center gap-2.5 border-b border-border-divider px-4">
        <span className="text-text-primary">
          <CopilotIcon />
        </span>
        <h2 className="m-0 text-body-lg font-semibold">Signals Copilot</h2>
        <Button variant="dropdown" className="!h-control-xs font-normal !text-text-secondary">
          &lt;/&gt; Pinescript
        </Button>
        <div className="grow" />
        <IconButton aria-label="New chat">
          <PlusIcon />
        </IconButton>
        <IconButton aria-label="History">
          <HistoryIcon />
        </IconButton>
      </div>

      <div className="flex min-h-0 grow flex-col justify-center gap-5 overflow-auto px-[22px]">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="m-0 text-display font-semibold">What should we build, {mockUser.firstName}?</p>
          <p className="m-0 text-body text-text-tertiary">
            Describe entry and exit in plain words. I'll build it on the canvas.
          </p>
        </div>
        <ul className="m-0 list-none overflow-hidden rounded-card border border-border-divider p-0">
          {copilotStarters.map((s) => (
            <li key={s.id} className="border-b border-border-subtle last:border-b-0">
              <button
                type="button"
                onClick={() => setDraft(s.description)}
                className="flex w-full flex-col gap-0.5 bg-surface px-3.5 py-3 text-left hover:bg-surface-canvas"
              >
                <span className="text-body font-medium">{s.title}</span>
                <span className="text-label text-text-muted">{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-2.5">
        <div className="flex flex-col gap-2 rounded-card border-[1.5px] border-ai-border px-3 py-2.5 focus-within:border-ai">
          <textarea
            aria-label="Message Copilot"
            placeholder="Describe your strategy or a condition…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-10 resize-none border-0 p-0 font-sans text-body outline-none placeholder:text-text-subtle"
          />
          <div className="flex items-center gap-2">
            <Button variant="dropdown" className="!h-control-xs">
              Fast
            </Button>
            <div className="grow" />
            <IconButton aria-label="Voice input">
              <MicIcon />
            </IconButton>
            <button
              type="button"
              aria-label="Send"
              disabled={!canSend}
              className={`flex size-control-sm items-center justify-center rounded-pill transition-colors ${
                canSend ? 'bg-brand text-text-on-brand' : 'bg-surface-disabled text-text-subtle'
              }`}
            >
              <ArrowIcon />
            </button>
          </div>
        </div>
        <p className="m-0 mt-2 text-center text-caption text-text-subtle">
          AI generated strategies can contain bugs.{' '}
          <a href="#" className="text-brand no-underline hover:text-brand-pressed">
            Learn more
          </a>
        </p>
      </div>
    </aside>
  );
}
