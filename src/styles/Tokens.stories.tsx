import type { Meta, StoryObj } from '@storybook/react-vite';
import tokensCss from './tokens.css?raw';

/* A living style guide: reads tokens.css and shows every colour swatch. */

const colors = [...tokensCss.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{3,8})/g)].map(
  ([, name, value]) => ({ name, value }),
);

function Swatches() {
  return (
    <div className="grid grid-cols-4 gap-4 p-6 font-sans" style={{ width: 960 }}>
      {colors.map((c) => (
        <div key={c.name} className="overflow-hidden rounded-card border border-border-divider">
          <div style={{ background: c.value, height: 56 }} />
          <div className="px-3 py-2">
            <div className="text-label font-medium">{c.name}</div>
            <div className="font-mono text-caption text-text-muted">{c.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const meta: Meta = { title: 'Foundations/Colours', component: Swatches, parameters: { layout: 'fullscreen' } };
export default meta;
export const All: StoryObj = {};
