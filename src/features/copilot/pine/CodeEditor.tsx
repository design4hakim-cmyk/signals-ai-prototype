import { history, historyKeymap, defaultKeymap, indentWithTab, toggleComment } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { EditorState, RangeSet, StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  Decoration, EditorView, GutterMarker, WidgetType, drawSelection, gutter, gutterLineClass, highlightActiveLine,
  highlightActiveLineGutter, keymap, lineNumbers, type DecorationSet,
} from '@codemirror/view';
import { useEffect, useRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { pine, pineAutocomplete, pineHighlight, pineHover } from './language';

/*
  The code area of the Pine Script editor (design/pine-editor · Atoms "Code text", "Line: …").
  CodeMirror does the typing, selection, undo, autocomplete and hover; this file draws the
  kit's line states on top: edited, Copilot, error, needs you, not supported, just fixed.
*/

export type LineKind = 'edited' | 'ai' | 'error' | 'needs' | 'unsupported' | 'fixed' | 'step';

export interface Marks {
  lines: { line: number; kind: LineKind }[];
  underlines: { line: number; from: number; to: number; tone: 'red' | 'amber' }[];
  /** the token an AI fix just changed */
  highlights: { line: number; from: number; to: number }[];
  /** cards right under a line (the AI fix card) */
  widgets: { line: number; key: string; node: ReactNode }[];
  /** find matches, as offsets in the document */
  find: { from: number; to: number; current: boolean }[];
}

const setMarks = StateEffect.define<Marks>();

/* gutter dot / info icon (16px marker column) */
class Dot extends GutterMarker {
  kind: 'error' | 'needs' | 'unsupported';
  constructor(kind: 'error' | 'needs' | 'unsupported') { super(); this.kind = kind; }
  eq(o: Dot) { return o.kind === this.kind; }
  toDOM() {
    const el = document.createElement('span');
    el.className = `cm-dot cm-dot-${this.kind}`;
    el.setAttribute('aria-label', this.kind === 'error' ? 'AI can fix' : this.kind === 'needs' ? 'Needs you' : 'Not supported yet');
    if (this.kind === 'unsupported') el.textContent = 'i';
    return el;
  }
}
/* colours the line number of a marked line */
class NumberTone extends GutterMarker {
  kind: LineKind;
  constructor(kind: LineKind) { super(); this.kind = kind; this.elementClass = `cm-num-${kind}`; }
  eq(o: NumberTone) { return o.kind === this.kind; }
}

class CardWidget extends WidgetType {
  root: Root | null = null;
  key: string;
  node: ReactNode;
  constructor(key: string, node: ReactNode) { super(); this.key = key; this.node = node; }
  eq(o: CardWidget) { return o.key === this.key; }
  toDOM() {
    const el = document.createElement('div');
    el.className = 'cm-card-slot';
    this.root = createRoot(el);
    this.root.render(this.node);
    return el;
  }
  destroy() {
    const r = this.root;
    // React doesn't like unmounting during its own render
    setTimeout(() => r?.unmount(), 0);
  }
  ignoreEvent() { return true; }
}

interface Built { deco: DecorationSet; dots: RangeSet<GutterMarker>; nums: RangeSet<GutterMarker> }

function build(state: EditorState, m: Marks): Built {
  const doc = state.doc;
  const ok = (n: number) => n >= 1 && n <= doc.lines;
  const ranges = [];
  const dots = [];
  const nums = [];
  for (const l of m.lines) {
    if (!ok(l.line)) continue;
    const at = doc.line(l.line).from;
    ranges.push(Decoration.line({ class: `cm-l-${l.kind}` }).range(at));
    nums.push(new NumberTone(l.kind).range(at));
    if (l.kind === 'error' || l.kind === 'needs' || l.kind === 'unsupported') dots.push(new Dot(l.kind).range(at));
  }
  for (const u of m.underlines) {
    if (!ok(u.line)) continue;
    const line = doc.line(u.line);
    const from = Math.min(line.from + u.from, line.to);
    const to = Math.min(line.from + Math.max(u.to, u.from + 1), line.to);
    if (to > from) ranges.push(Decoration.mark({ class: `cm-wavy cm-wavy-${u.tone}` }).range(from, to));
  }
  for (const h of m.highlights) {
    if (!ok(h.line)) continue;
    const line = doc.line(h.line);
    const from = Math.min(line.from + h.from, line.to);
    const to = Math.min(line.from + h.to, line.to);
    if (to > from) ranges.push(Decoration.mark({ class: 'cm-fixed-token' }).range(from, to));
  }
  for (const f of m.find) if (f.to <= doc.length) ranges.push(Decoration.mark({ class: f.current ? 'cm-find cm-find-current' : 'cm-find' }).range(f.from, f.to));
  for (const w of m.widgets) if (ok(w.line)) ranges.push(Decoration.widget({ widget: new CardWidget(w.key, w.node), block: true, side: 1 }).range(doc.line(w.line).to));
  const sort = <T extends { from: number }>(xs: T[]) => xs.sort((a, b) => a.from - b.from);
  return { deco: Decoration.set(sort(ranges), true), dots: RangeSet.of(sort(dots), true), nums: RangeSet.of(sort(nums), true) };
}

const marksField = StateField.define<{ marks: Marks; built: Built }>({
  create: (state) => {
    const marks: Marks = { lines: [], underlines: [], highlights: [], widgets: [], find: [] };
    return { marks, built: build(state, marks) };
  },
  update(v, tr) {
    let marks = v.marks;
    for (const e of tr.effects) if (e.is(setMarks)) marks = e.value;
    if (marks === v.marks && !tr.docChanged) return v;
    // while you type, the marks follow the text until the store sends new ones
    if (marks === v.marks) return { marks, built: { deco: v.built.deco.map(tr.changes), dots: v.built.dots.map(tr.changes), nums: v.built.nums.map(tr.changes) } };
    return { marks, built: build(tr.state, marks) };
  },
  provide: (f) => [
    EditorView.decorations.from(f, (v) => v.built.deco),
    gutterLineClass.from(f, (v) => v.built.nums),
  ],
});

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '11.5px', backgroundColor: 'var(--color-surface)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: "'JetBrains Mono', ui-monospace, monospace", lineHeight: '20px', padding: '10px 0' },
  '.cm-content': { padding: '0', caretColor: 'var(--color-text-primary)' },
  '.cm-line': { padding: '0 14px 0 0', color: 'var(--color-code-text)' },
  '.cm-cursor': { borderLeftColor: 'var(--color-text-primary)', borderLeftWidth: '1.5px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--color-code-selection) !important' },
  '.cm-gutters': { backgroundColor: 'var(--color-surface)', border: 'none', color: 'var(--color-code-line-number)' },
  '.cm-lineNumbers .cm-gutterElement': { width: '30px', padding: '0', textAlign: 'right', minWidth: '30px' },
  '.cm-markers': { width: '16px' },
  '.cm-markers .cm-gutterElement': { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  // current line: hover grey, the number turns primary and 600
  '.cm-activeLine': { backgroundColor: 'var(--color-surface-hover)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-primary)', fontWeight: '600' },
  // line states (a 2px bar at the gutter edge = inset shadow on the line)
  '.cm-l-edited': { boxShadow: 'inset 2px 0 0 var(--color-brand-border)' },
  '.cm-l-ai': { backgroundColor: 'var(--color-ai-tint) !important', boxShadow: 'inset 2px 0 0 var(--color-ai)' },
  '.cm-l-error': { backgroundColor: 'var(--color-error-bg) !important' },
  '.cm-l-needs, .cm-l-unsupported': { backgroundColor: 'var(--color-warn-tint) !important' },
  '.cm-l-fixed': { backgroundColor: 'var(--color-buy-tint) !important', boxShadow: 'inset 2px 0 0 var(--color-buy)' },
  '.cm-l-step': { boxShadow: 'inset 2px 0 0 var(--color-brand)' },
  '.cm-num-ai': { color: 'var(--color-ai-text)', backgroundColor: 'var(--color-ai-tint)' },
  '.cm-num-error': { color: 'var(--color-error)', fontWeight: '600', backgroundColor: 'var(--color-error-bg)' },
  '.cm-num-needs, .cm-num-unsupported': { color: 'var(--color-warn-text)', fontWeight: '600', backgroundColor: 'var(--color-warn-tint)' },
  '.cm-num-fixed': { backgroundColor: 'var(--color-buy-tint)' },
  '.cm-dot': { width: '7px', height: '7px', borderRadius: '4px', display: 'block' },
  '.cm-dot-error': { backgroundColor: 'var(--color-sell)' },
  '.cm-dot-needs': { backgroundColor: 'var(--color-warn-dot)' },
  '.cm-dot-unsupported': {
    width: '12px', height: '12px', borderRadius: '6px', backgroundColor: 'var(--color-warn-dot)', color: 'var(--color-surface)',
    fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '9px', fontWeight: '700', lineHeight: '12px', textAlign: 'center',
  },
  '.cm-wavy': { textDecorationLine: 'underline', textDecorationStyle: 'wavy', textDecorationThickness: '1.5px', textUnderlineOffset: '3px', textDecorationSkipInk: 'none' },
  '.cm-wavy-red': { textDecorationColor: 'var(--color-sell)' },
  '.cm-wavy-amber': { textDecorationColor: 'var(--color-warn-dot)' },
  '.cm-fixed-token': { backgroundColor: 'var(--color-code-fixed-token)', borderRadius: '2px' },
  '.cm-find': { backgroundColor: 'var(--color-warn-tint)', outline: '1px solid var(--color-warn-dot)', borderRadius: '2px' },
  '.cm-find-current': { backgroundColor: 'var(--color-code-selection)', outline: '1px solid var(--color-brand)' },
  // under the broken line, in the code column; it keeps the panel's width (and stays put) when long lines scroll sideways
  '.cm-card-slot': { position: 'sticky', left: '46px', width: '394px' /* 440 panel − 46 gutter */, boxSizing: 'border-box', padding: '6px 12px 8px 0', fontFamily: "'IBM Plex Sans', sans-serif", whiteSpace: 'normal' },
  // autocomplete (the shared popover look, 260w)
  '.cm-tooltip': { border: '1px solid var(--color-border-control)', borderRadius: '10px', backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-surface)', overflow: 'hidden' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '11.5px', width: '260px', maxHeight: '200px', padding: '4px' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', borderRadius: '6px', lineHeight: '18px' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--color-menu-current)', color: 'var(--color-brand-text)' },
  '.cm-completionDetail': { color: 'var(--color-text-tertiary)', fontStyle: 'normal', marginLeft: 'auto' },
  '.cm-completionMatchedText': { textDecoration: 'none', fontWeight: '600' },
  '.cm-fbadge': { width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--color-brand-tint)', color: 'var(--color-brand)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic' },
  '.cm-completionInfo.cm-info-below': { position: 'static', width: '260px', boxSizing: 'border-box', borderTop: '1px solid var(--color-border-subtle)', padding: '6px 12px', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11.5px', color: 'var(--color-text-secondary)', maxWidth: 'none' },
  '.cm-hoverdoc': { padding: '8px 10px', maxWidth: '280px', fontFamily: "'IBM Plex Sans', sans-serif" },
  '.cm-hoverdoc code': { display: 'block', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '11px', color: 'var(--color-code-keyword)' },
  '.cm-hoverdoc p': { margin: '4px 0 0', fontSize: '12px', lineHeight: '17px', color: 'var(--color-text-secondary)' },
});

export interface CodeEditorProps {
  value: string;
  marks: Marks;
  onChange: (code: string) => void;
  /** caret to this line (Open line N, F8, a problem) */
  focus: { line: number; n: number } | null;
  onRun: () => void;
  onAcceptFix: (line: number) => void;
  onNextProblem: () => void;
  onFind: () => void;
  onCaret?: (line: number) => void;
}

export function CodeEditor({ value, marks, onChange, focus, onRun, onAcceptFix, onNextProblem, onFind, onCaret }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // the latest callbacks, without rebuilding the editor
  const cb = useRef({ onChange, onRun, onAcceptFix, onNextProblem, onFind, onCaret });
  cb.current = { onChange, onRun, onAcceptFix, onNextProblem, onFind, onCaret };

  useEffect(() => {
    const keys = keymap.of([
      { key: 'Mod-Enter', run: () => (cb.current.onRun(), true) },
      { key: 'Mod-/', run: toggleComment },
      { key: 'Mod-.', run: (v) => (cb.current.onAcceptFix(v.state.doc.lineAt(v.state.selection.main.head).number), true) },
      { key: 'F8', run: () => (cb.current.onNextProblem(), true) },
      { key: 'Mod-f', run: () => (cb.current.onFind(), true) },
      indentWithTab,
      ...historyKeymap,
      ...defaultKeymap,
    ]);
    const ext: Extension[] = [
      lineNumbers(),
      gutter({ class: 'cm-markers', markers: (v) => v.state.field(marksField).built.dots }),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      drawSelection(),
      history(),
      indentUnit.of('    '),
      EditorState.tabSize.of(4),
      pine,
      pineHighlight,
      pineAutocomplete,
      pineHover,
      marksField,
      keys,
      theme,
      EditorView.updateListener.of((u) => {
        if (u.docChanged && u.transactions.some((t) => t.isUserEvent('input') || t.isUserEvent('delete') || t.isUserEvent('undo') || t.isUserEvent('redo') || t.isUserEvent('move') || t.isUserEvent('input.complete')))
          cb.current.onChange(u.state.doc.toString());
        if (u.selectionSet) cb.current.onCaret?.(u.state.doc.lineAt(u.state.selection.main.head).number);
      }),
      EditorView.contentAttributes.of({ 'aria-label': 'Pine Script code', spellcheck: 'false' }),
    ];
    const v = new EditorView({ parent: host.current!, state: EditorState.create({ doc: value, extensions: ext }) });
    view.current = v;
    return () => v.destroy();
    // the editor is built once; value and marks arrive through the effects below
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the store changed the code (AI fix, example, Discard, canvas): put it in, keep the caret line
  useEffect(() => {
    const v = view.current;
    if (!v || v.state.doc.toString() === value) return;
    const head = Math.min(v.state.selection.main.head, value.length);
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value }, selection: { anchor: head } });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: setMarks.of(marks) });
  }, [marks]);

  useEffect(() => {
    const v = view.current;
    if (!v || !focus || focus.line > v.state.doc.lines) return;
    const line = v.state.doc.line(focus.line);
    v.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
    v.focus();
  }, [focus]);

  return <div ref={host} className="h-full min-h-0" />;
}
