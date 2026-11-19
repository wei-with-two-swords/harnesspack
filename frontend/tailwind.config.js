/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#070b10',
        surface: '#0e141c',
        raise: '#131c27',
        line: '#1e2a3a',
        muted: '#8b9bb4',
        body: '#dbe6f3',
        gold: '#f5b544',
        teal: '#4cc9f0',
        rise: '#4ade80',
        fall: '#f87171',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
