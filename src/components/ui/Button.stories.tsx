import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { PlayIcon } from './icons';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  args: { children: 'Button' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'dropdown', 'tab'] },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary', children: <>Run Backtest <PlayIcon /></> },
};
export const PrimaryDisabled: Story = {
  args: { variant: 'primary', disabled: true, children: <>Run Backtest <PlayIcon /></> },
};
export const Secondary: Story = { args: { variant: 'secondary', children: 'Period 1Y' } };
export const Dropdown: Story = { args: { variant: 'dropdown', children: 'NIFTY' } };
export const TabSelected: Story = { args: { variant: 'tab', selected: true, children: 'Chart' } };
export const TabIdle: Story = { args: { variant: 'tab', children: 'Logs' } };
