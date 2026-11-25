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

function syncMetaThemeColor() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = isDarkMode() ? '#0b0e13' : '#f7f8fa';
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

/** Canvas-based widgets (uPlot) cannot use CSS variables, so mirror the theme in JS. */
export function chartColors() {
  const dark = isDarkMode();
  return {
    dark,
    axis: dark ? '#9aa8ba' : '#5c6b7a',
    grid: dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.10)',
    line: dark ? '#38bdf8' : '#0e7490',
    fill: dark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(14, 116, 144, 0.08)',
    series: dark
      ? ['#38bdf8', '#f5b544', '#4ade80', '#f87171', '#a78bfa']
      : ['#0e7490', '#b45309', '#15803d', '#b91c1c', '#6d28d9'],
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
