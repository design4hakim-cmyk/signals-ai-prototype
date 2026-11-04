import { FieldAtom, MathChip } from '../atoms';
import { ConditionBlock, type ConditionBlockProps } from '../ConditionBlock';

/* The example conditions used on the boards. */

export const RsiFields = ({ value = '50', relation = 'Greater Than' }: { value?: string; relation?: string }) => (
  <>
    <FieldAtom kind="operand" label="RSI" detail="(14)" />
    <FieldAtom kind="relation" label={relation} />
    <FieldAtom kind="value" label={value} />
  </>
);

export const EmaCrossFields = () => (
  <>
    <FieldAtom kind="operand" label="EMA" detail="(9, Close)" />
    <FieldAtom kind="relation" label="Cross Above" />
    <FieldAtom kind="operand" label="EMA" detail="(21, Close)" />
  </>
);

export const HalfBuiltFields = () => (
  <>
    <FieldAtom kind="operand" label="EMA" detail="(9, Close)" />
    <FieldAtom kind="relation" label="Cross Above" />
    <FieldAtom kind="operand" semantic="error" label="Pick indicator" />
  </>
);

type B = Omit<ConditionBlockProps, 'children'>;

export const Rsi = (p: B) => <ConditionBlock label="RSI (14) Greater Than 50" {...p}><RsiFields /></ConditionBlock>;
export const EmaCross = (p: B) => <ConditionBlock label="EMA (9) Cross Above EMA (21)" {...p}><EmaCrossFields /></ConditionBlock>;
export const CloseAboveMa = (p: B) => (
  <ConditionBlock label="Close Greater Than MA (50)" {...p}>
    <FieldAtom kind="operand" label="Close" />
    <FieldAtom kind="relation" label="Greater Than" />
    <FieldAtom kind="operand" label="MA" detail="(50, Close)" />
  </ConditionBlock>
);
export const StochUp = (p: B) => (
  <ConditionBlock label="Stochastic Cross Above 20" {...p}>
    <FieldAtom kind="operand" label="Stochastic" detail="(14, 3)" />
    <FieldAtom kind="relation" label="Cross Above" />
    <FieldAtom kind="value" label="20" />
  </ConditionBlock>
);
export const VolumeSpike = (p: B) => (
  <ConditionBlock label="Volume Greater Than SMA (Volume, 20) × 1.5" {...p}>
    <FieldAtom kind="operand" label="Volume" />
    <FieldAtom kind="relation" label="Greater Than" />
    <FieldAtom kind="operand" label="SMA" detail="(Volume, 20)" />
    <MathChip>× 1.5</MathChip>
  </ConditionBlock>
);
export const WmaAboveMa = (p: B) => (
  <ConditionBlock label="WMA (20) Greater Than MA (50)" {...p}>
    <FieldAtom kind="operand" label="WMA" detail="(20, Close)" />
    <FieldAtom kind="relation" label="Greater Than" />
    <FieldAtom kind="operand" label="MA" detail="(50, Close)" />
  </ConditionBlock>
);
export const HalfBuilt = (p: B) => (
  <ConditionBlock look="error" label="EMA (9) Cross Above, second indicator missing" error="Finish this condition to update the chart" {...p}>
    <HalfBuiltFields />
  </ConditionBlock>
);
