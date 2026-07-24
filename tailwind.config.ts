import type { Config } from 'tailwindcss';

import uiPreset from './src/components/ui/tailwind-preset';

const config: Config = {
  presets: [uiPreset as Partial<Config>],
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};

export default config;
