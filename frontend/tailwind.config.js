/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Theme is driven by the `data-bs-theme` attribute (kept from the previous
  // stylesheet so chart code stays compatible). Selector strategy makes every
  // `dark:` utility respond to that attribute.
  darkMode: ['selector', '[data-bs-theme="dark"]'],
  theme: {
    extend: {
      // Same 8px scale as index.css. Overriding the numeric steps keeps
      // @apply and JSX utilities from producing two different rhythms.
      spacing: {
        0: '0',
        1: 'var(--s-1)',
        2: 'var(--s-2)',
        3: 'var(--s-3)',
        4: 'var(--s-4)',
        5: 'var(--s-5)',
        6: 'var(--s-6)',
        7: 'var(--s-7)',
        8: 'var(--s-8)',
        px: 'var(--hairline)',
      },
      colors: {
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
        },
        hover: 'var(--hover)',
        line: {
          DEFAULT: 'var(--line)',
          strong: 'var(--line-strong)',
        },
        content: {
          DEFAULT: 'var(--text)',
          muted: 'var(--muted)',
          faint: 'var(--faint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
        },
        link: 'var(--link)',
        danger: { DEFAULT: 'var(--red)', soft: 'var(--red-soft)' },
        success: { DEFAULT: 'var(--green)', soft: 'var(--green-soft)' },
        warning: { DEFAULT: 'var(--amber)', soft: 'var(--amber-soft)' },
        info: { DEFAULT: 'var(--blue)', soft: 'var(--blue-soft)' },
        violet: { DEFAULT: 'var(--violet)', soft: 'var(--violet-soft)' },
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        card: 'var(--radius)',
        sm2: 'var(--radius)',
        xs: 'var(--radius)',
        round: 'var(--radius-round)',
        none: 'var(--radius-none)',
      },
      boxShadow: {
        overlay: 'var(--shadow-overlay)',
        pop: 'var(--shadow-overlay)',
      },
      maxWidth: {
        container: 'var(--container)',
        '1/2': '50%',
        '1/3': '33.3333%',
        '1/4': '25%',
        '2/3': '66.6667%',
      },
      width: {
        '1/2': '50%',
        '1/3': '33.3333%',
        '1/4': '25%',
        '2/3': '66.6667%',
      },
    },
  },
  plugins: [],
};
