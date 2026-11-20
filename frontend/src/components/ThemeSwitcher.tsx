import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { applyTheme, readTheme, type ThemeMode } from '../lib/theme';

type IconProps = { className?: string };

function SunIcon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="3.5" />
      <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" />
      </g>
    </svg>
  );
}

function MoonIcon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M14 9.5A6 6 0 0 1 6.5 2a6 6 0 1 0 7.5 7.5Z" />
    </svg>
  );
}

function SystemIcon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 1.5v11a5.5 5.5 0 0 1 0-11Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="menu-item-check"
      aria-hidden="true"
    >
      <path d="M6.5 11.2 3 7.7l1-1 2.5 2.5L12 3.7l1 1-6.5 6.5Z" />
    </svg>
  );
}

const OPTIONS: {
  value: ThemeMode;
  label: string;
  hint: string;
  Icon: (props: IconProps) => ReactElement;
}[] = [
  { value: 'light', label: '明亮', hint: '始终使用浅色主题', Icon: SunIcon },
  { value: 'dark', label: '暗色', hint: '始终使用深色主题', Icon: MoonIcon },
  { value: 'system', label: '跟随系统', hint: '跟随操作系统的深浅色设置', Icon: SystemIcon },
];

export function ThemeSwitcher() {
  const [mode, setMode] = useState<ThemeMode>(() => readTheme());
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = OPTIONS.find((option) => option.value === mode) ?? OPTIONS[2];
  const CurrentIcon = current.Icon;

  return (
    <div className="position-relative" ref={rootRef}>
      <button
        type="button"
        className="theme-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`切换主题，当前：${current.label}`}
        title={`切换主题（当前：${current.label}）`}
        onClick={() => setOpen((value) => !value)}
      >
        <CurrentIcon />
        <svg
          className="menu-caret"
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 11 3 6h10l-5 5Z" />
        </svg>
      </button>

      <ul
        className={`menu${open ? ' show' : ''}`}
        role="menu"
        aria-label="主题"
        style={{ top: 'calc(100% + 0.25rem)', right: 0, insetInlineEnd: 0 }}
      >
        {OPTIONS.map(({ value, label, hint, Icon }) => {
          const active = value === mode;
          return (
            <li key={value} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={active}
                title={hint}
                className={`menu-item d-flex align-items-center gap-2${active ? ' selected' : ''}`}
                onClick={() => {
                  setMode(value);
                  applyTheme(value);
                  setOpen(false);
                }}
              >
                <Icon className="menu-item-icon" />
                <span className="menu-item-content">
                  <span className="menu-item-text">{label}</span>
                </span>
                <CheckIcon />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
