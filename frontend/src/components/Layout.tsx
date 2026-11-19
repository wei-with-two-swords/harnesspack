import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="13" width="3.5" height="8" rx="1" fill="#4cc9f0" />
      <rect x="10.25" y="9" width="3.5" height="12" rx="1" fill="#f5b544" />
      <rect x="17.5" y="4" width="3.5" height="17" rx="1" fill="#4cc9f0" />
    </svg>
  );
}

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-lg px-2.5 py-1.5 transition hover:text-white ${
          isActive ? 'bg-raise text-white' : 'text-muted'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-ink/85 backdrop-blur">
        <div className="shell flex h-14 items-center gap-4 sm:gap-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-base font-semibold tracking-tight text-white">HarnessRank</span>
            <span className="pill hidden sm:inline-flex">beta</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavItem to="/rankings/velocity">榜单</NavItem>
            <NavItem to="/about">收录规则</NavItem>
            <NavItem to="/sponsors">推荐位</NavItem>
          </nav>
          <div className="ml-auto hidden text-xs text-muted md:block">
            每日 00:10 UTC 快照 · 只做真实增速
          </div>
        </div>
      </header>

      <main className="shell flex-1 py-6 sm:py-10">{children}</main>

      <footer className="border-t border-line/70 py-6">
        <div className="shell flex flex-col gap-2 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            HarnessRank 收录 Claude Code / Codex / Cursor / DSH 等 harness 扩展，数据来自 GitHub
            公开 API。
          </p>
          <p>
            非官方项目 ·{' '}
            <Link to="/about" className="text-teal hover:underline">
              数据口径
            </Link>{' '}
            ·{' '}
            <Link to="/sponsors" className="text-teal hover:underline">
              推荐位说明
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
