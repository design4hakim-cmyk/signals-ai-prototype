import type { StorybookConfig } from '@storybook/react-vite';

// Storybook = a workshop where each component is shown on its own, in every state.
const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: '@storybook/react-vite',
};
export default config;
