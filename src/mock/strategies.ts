import { uid } from '@/lib/conditions';
import { indicatorDef } from '@/lib/indicators';
import type { Condition, Group, IndicatorId, IndicatorParams, Logic, MathStep, Operand, Relation, StrategyNode, StrategyTree } from '@/types/strategy';

/*
  Example strategies from the boards, for the Scenarios switcher.
  Each call makes fresh ids, so loading one twice never clashes.
*/

const ind = (id: IndicatorId, params: IndicatorParams = {}, math?: MathStep): Operand => ({
  type: 'indicator', id, params: { ...indicatorDef(id).defaults, ...params }, ...(math ? { math } : {}),
});
const num = (value: number): Operand => ({ type: 'number', value });
const cond = (left: Operand | null, relation: Relation | null, right: Operand | null): Condition => ({ kind: 'cond', id: uid('c'), left, relation, right });
const group = (logic: Logic, children: StrategyNode[]): Group => ({ kind: 'group', id: uid('g'), logic, children });

const emaCross = () => cond(ind('ema', { length: 9 }), 'Cross Above', ind('ema', { length: 21 }));
const rsiAbove = () => cond(ind('rsi'), 'Greater Than', num(50));
const closeAboveMa = () => cond(ind('price'), 'Greater Than', ind('sma', { length: 50 }));
const stochUp = () => cond(ind('stoch'), 'Cross Above', num(20));
// in a top-level ALL OF, two crossings rarely land on the same candle, so the editing example uses "above"
const stochAbove = () => cond(ind('stoch'), 'Greater Than', num(20));
const exitCross = () => group('AND', [cond(ind('ema', { length: 9 }), 'Cross Below', ind('ema', { length: 21 }))]);

/** The demo strategy everyone starts from (EMA 9 × 21 with an RSI filter). */
export const demoStrategy = (): StrategyTree => ({ entry: group('AND', [emaCross(), rsiAbove()]), exit: exitCross() });

/** U02 · a third condition with the second indicator still missing. */
export const halfBuiltStrategy = (): StrategyTree => ({
  entry: group('AND', [emaCross(), rsiAbove(), cond(ind('price'), 'Cross Above', null)]),
  exit: exitCross(),
});

/** E01–E09 · four conditions to edit, select, group and drag. */
export const editingStrategy = (): StrategyTree => ({
  entry: group('AND', [emaCross(), rsiAbove(), closeAboveMa(), stochAbove()]),
  exit: exitCross(),
});

/** E07 · Close > MA and Stochastic grouped into an ANY OF box. */
export const groupedStrategy = (): StrategyTree => ({
  entry: group('AND', [emaCross(), rsiAbove(), group('OR', [closeAboveMa(), stochAbove()])]),
  exit: exitCross(),
});

/** B08 · eight conditions with nested ALL OF / ANY OF boxes. */
export const complexStrategy = (): StrategyTree => ({
  entry: group('AND', [
    emaCross(),
    rsiAbove(),
    group('OR', [
      closeAboveMa(),
      stochUp(),
      group('AND', [
        cond(ind('volume'), 'Greater Than', ind('sma', { length: 20, source: 'Volume' }, { op: '×', value: 1.5 })),
        cond(ind('wma', { length: 20 }), 'Greater Than', ind('sma', { length: 50 })),
      ]),
    ]),
    group('NONE', [
      cond(ind('price'), 'Greater Than', ind('bb', { band: 'Upper' })),
      cond(ind('rsi'), 'Greater Than', num(70)),
    ]),
  ]),
  exit: exitCross(),
});

export const emptyStrategy = (): StrategyTree => ({ entry: group('AND', []), exit: group('AND', []) });
