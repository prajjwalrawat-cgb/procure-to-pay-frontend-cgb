import uiPreset from '@procureflow/ui/tailwind-preset';
import type { Config } from 'tailwindcss';

const config: Config = {
  presets: [uiPreset as Partial<Config>],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};

export default config;
