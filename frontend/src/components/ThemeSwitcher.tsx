import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, readTheme, type ThemeMode } from '../lib/theme';
import { useI18n } from '../lib/i18n';

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
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}
