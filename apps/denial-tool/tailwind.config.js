import preset from '../../packages/design-system/tailwind.config.js';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx}',
    './index.html',
    '../../packages/design-system/src/**/*.{ts,tsx}',
    '../../packages/wired-components/src/**/*.{ts,tsx}',
    '../../packages/composition/src/**/*.{ts,tsx}',
    '../../packages/visualization/src/**/*.{ts,tsx}',
    '../../packages/runtime/src/**/*.{ts,tsx}',
    '../../packages/worklist/src/**/*.{ts,tsx}',
  ],
};
