// The shape of a strategy on the canvas (boards B02–B08, E01–E09).
// Entry and Exit are each one top-level group. A group holds conditions
// and smaller groups, joined by AND (ALL OF) or OR (ANY OF).

export type IndicatorId = 'price' | 'volume' | 'sma' | 'ema' | 'wma' | 'median' | 'trimmed' | 'geo' | 'harmonic' | 'bb' | 'rsi' | 'stoch';
export type Source = 'Close' | 'Open' | 'High' | 'Low' | 'Volume';
export type Band = 'Upper' | 'Middle' | 'Lower';

/** Settings from the indicator's Inputs tab (B03). Each indicator uses some of them. */
export interface IndicatorParams {
  length?: number;
  source?: Source;
  offset?: number;
  mult?: number; // Bollinger StdDev
  band?: Band;
  k?: number; // Stochastic %K length
  d?: number; // Stochastic smoothing
}

/** + − × ÷ MAX MIN applied to one side of a condition (B04), e.g. "× 1.5" */
export type MathOp = '+' | '−' | '×' | '÷' | 'MAX' | 'MIN';
export interface MathStep {
  op: MathOp;
  value: number;
}

export type Operand =
  | { type: 'indicator'; id: IndicatorId; params: IndicatorParams; math?: MathStep }
  | { type: 'number'; value: number; math?: MathStep };

export type Relation =
  | 'Equals'
  | 'Not Equals'
  | 'Greater Than'
  | 'Greater Than Equal To'
  | 'Less Than'
  | 'Less Than Equal To'
  | 'Cross Above'
  | 'Cross Below';

/** One block: Indicator 1 · Relation · Indicator 2. Empty slots are null while it's being built. */
export interface Condition {
  kind: 'cond';
  id: string;
  left: Operand | null;
  relation: Relation | null;
  right: Operand | null;
}

export type Logic = 'AND' | 'OR';

export interface Group {
  kind: 'group';
  id: string;
  logic: Logic;
  children: StrategyNode[];
}

export type StrategyNode = Condition | Group;
export type Side = 'entry' | 'exit';

export interface StrategyTree {
  entry: Group;
  exit: Group;
}
