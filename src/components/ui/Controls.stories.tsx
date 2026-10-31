import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SegmentedControl } from './SegmentedControl';
import { FieldLabel, Select } from './Select';

/* Live playground for the small controls used in the chart data dialog. */

function Playground() {
  const [timing, setTiming] = useState<'Rolling' | 'Fixed'>('Rolling');
  const [type, setType] = useState<'Call' | 'Put'>('Call');
  const [strike, setStrike] = useState('ATM');
  return (
    <div className="flex min-h-[340px] flex-col gap-4 p-6 font-sans">
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Strike selection timing</FieldLabel>
        <SegmentedControl label="Timing" options={['Rolling', 'Fixed'] as const} value={timing} onChange={setTiming} />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Option type (small, as in leg rows)</FieldLabel>
        <SegmentedControl size="sm" label="Type" options={['Call', 'Put'] as const} value={type} onChange={setType} />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Strike</FieldLabel>
        <Select
          label="Strike"
          width={110}
          options={['ITM3', 'ITM2', 'ITM1', 'ATM', 'OTM1', 'OTM2', 'OTM3', 'OTM4']}
          value={strike}
          onChange={setStrike}
        />
      </div>
    </div>
  );
}

const meta: Meta = { title: 'UI/Controls', component: Playground, parameters: { layout: 'fullscreen' } };
export default meta;
export const SegmentedAndSelect: StoryObj = {};
