import { useEffect, useState } from 'react';
import { applyTheme, readTheme, type ThemeMode } from '../lib/theme';
import { useI18n } from '../lib/i18n';

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="8" cy="8" r="3.2" />
      <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <path d="M8 1.2v2M8 12.8v2M1.2 8h2M12.8 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M14 9.5A6 6 0 0 1 6.5 2a6 6 0 1 0 7.5 7.5Z" />
    </svg>
  );
}

export function ThemeSwitcher() {
  const { t } = useI18n();
  const [mode, setMode] = useState<ThemeMode>(() => readTheme());

  useEffect(() => {
    applyTheme(mode, false);
  }, [mode]);

  const toggle = () => {
    const next: ThemeMode = mode === 'light' ? 'dark' : 'light';
    setMode(next);
    applyTheme(next);
  };

  const dark = mode === 'dark';
  return (
    <button
      type="button"
      className="btn-icon"
      aria-label={t('nav.theme')}
      title={t('nav.theme')}
      onClick={toggle}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
