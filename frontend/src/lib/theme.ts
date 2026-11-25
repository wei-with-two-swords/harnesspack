import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'harnesspack-theme';

export const THEME_EVENT = 'harnesspack:themechange';

export function readTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Private mode / storage disabled: fall back to light.
  }
  return 'light';
}

/** Read a design token from the active theme so JS and CSS never diverge. */
function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function syncMetaThemeColor() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = token('--bg', isDarkMode() ? '#101018' : '#ffffff');
}

export function applyTheme(mode: ThemeMode, persist = true): void {
  const root = document.documentElement;
  root.setAttribute('data-bs-theme', mode);

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore storage failures; the theme still applies for this page view.
    }
  }

  syncMetaThemeColor();
  window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_EVENT, { detail: mode }));
}

export function isDarkMode(): boolean {
  return document.documentElement.getAttribute('data-bs-theme') === 'dark';
}

/** Canvas widgets need concrete colors; resolve them from the same tokens CSS uses. */
export function chartColors() {
  const dark = isDarkMode();
  return {
    dark,
    axis: token('--muted', dark ? '#c0c0ca' : '#52525b'),
    grid: token('--line', dark ? 'rgba(232,232,238,0.1)' : 'rgba(24,24,27,0.09)'),
    line: token('--blue', dark ? '#60a5fa' : '#2563eb'),
    fill: token('--blue-soft', dark ? 'rgba(96,165,250,0.14)' : 'rgba(37,99,235,0.09)'),
    series: [
      token('--blue', dark ? '#60a5fa' : '#2563eb'),
      token('--amber', dark ? '#fbbf24' : '#b45309'),
      token('--green', dark ? '#34d399' : '#047857'),
      token('--red', dark ? '#f87171' : '#dc2626'),
      token('--violet', dark ? '#a78bfa' : '#7c3aed'),
    ],
  };
}

/** Bumps whenever the theme changes, so charts can rebuild with new colors. */
export function useThemeVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((value) => value + 1);
    window.addEventListener(THEME_EVENT, bump);
    return () => window.removeEventListener(THEME_EVENT, bump);
  }, []);

  return version;
}
