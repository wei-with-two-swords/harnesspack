import { useEffect, useState } from 'react';
import { applyTheme, readTheme, type ThemeMode } from '../lib/theme';

const OPTIONS: { value: ThemeMode; label: string; title: string }[] = [
  { value: 'system', label: '系统', title: '跟随系统主题' },
  { value: 'light', label: '明亮', title: '明亮主题' },
  { value: 'dark', label: '暗色', title: '暗色主题' },
];

export function ThemeSwitcher() {
  const [mode, setMode] = useState<ThemeMode>(() => readTheme());

  useEffect(() => {
    applyTheme(mode, false);
  }, [mode]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (readTheme() === 'system') applyTheme('system', false);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="btn-group btn-group-sm" role="group" aria-label="主题模式">
      {OPTIONS.map((option) => {
        const active = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={active}
            className={`btn ${active ? 'btn-solid theme-secondary active' : 'btn-outline'}`}
            onClick={() => {
              setMode(option.value);
              applyTheme(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
