import { useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'harnesspack-theme';

export const THEME_EVENT = 'harnesspack:themechange';

export function readTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Private mode / storage disabled: fall back to following the system.
  }
  return 'system';
}

function syncMetaThemeColor() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  const bg = getComputedStyle(document.body).backgroundColor;
  if (bg && bg !== 'rgba(0, 0, 0, 0)') meta.content = bg;
  else meta.content = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? '#212529'
    : '#f8f9fa';
}

export function applyTheme(mode: ThemeMode, persist = true): void {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-bs-theme');
  else root.setAttribute('data-bs-theme', mode);

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
  const attr = document.documentElement.getAttribute('data-bs-theme');
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Canvas-based widgets (uPlot) cannot use CSS variables, so mirror the theme in JS. */
export function chartColors() {
  const dark = isDarkMode();
  return {
    dark,
    axis: dark ? '#9aa8ba' : '#5c6b7a',
    grid: dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.10)',
    line: dark ? '#4cc9f0' : '#0b7285',
    fill: dark ? 'rgba(76, 201, 240, 0.12)' : 'rgba(11, 114, 133, 0.08)',
    series: dark
      ? ['#4cc9f0', '#f5b544', '#4ade80', '#f87171', '#a78bfa']
      : ['#0b7285', '#b45309', '#15803d', '#b91c1c', '#6d28d9'],
  };
}

/** Bumps whenever the effective theme changes, so charts can rebuild with new colors. */
export function useThemeVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((value) => value + 1);
    window.addEventListener(THEME_EVENT, bump);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', bump);
    return () => {
      window.removeEventListener(THEME_EVENT, bump);
      media.removeEventListener('change', bump);
    };
  }, []);

  return version;
}
