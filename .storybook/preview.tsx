import type { Preview } from '@storybook/react-vite';
import '../src/styles/index.css'; // same fonts + tokens as the app

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: 'todo' }, // shows accessibility issues in the panel, doesn't block
  },
};

export default preview;
