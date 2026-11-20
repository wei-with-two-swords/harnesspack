import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ThemeSwitcher } from './ThemeSwitcher';

function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0">
      <rect x="3" y="13" width="3.5" height="8" rx="1" fill="#4cc9f0" />
      <rect x="10.25" y="9" width="3.5" height="12" rx="1" fill="#f5b544" />
      <rect x="17.5" y="4" width="3.5" height="17" rx="1" fill="#4cc9f0" />
    </svg>
  );
}

function NavItem({ to, children, end }: { to: string; children: ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `nav-link flex-shrink-0 text-nowrap${isActive ? ' active' : ''}`
      }
    >
      {children}
    </NavLink>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="d-flex flex-column min-vh-100">
      <header className="sticky-top border-bottom bg-body">
        <div className="container py-2 d-flex flex-wrap align-items-center gap-2">
          <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none fg-body">
            <Logo />
            <span className="fs-lg fw-semibold">HarnessPack</span>
            <span className="badge theme-secondary badge-subtle d-none sm:d-inline-flex">beta</span>
          </Link>

          <div className="ms-auto d-flex align-items-center gap-3 order-2 md:order-3">
            <div className="d-none lg:d-inline fs-sm fg-secondary">
              每日 00:10 UTC 快照 · 只做真实增速
            </div>
            <ThemeSwitcher />
          </div>

          <nav className="header-nav w-100 order-3 md:order-2 nav nav-pills gap-1 overflow-x-auto nav-scroll fs-sm flex-nowrap">
            <NavItem to="/rankings/velocity">榜单</NavItem>
            <NavItem to="/categories">分类榜</NavItem>
            <NavItem to="/plugins">插件库</NavItem>
            <NavItem to="/about" end>
              收录规则
            </NavItem>
            <NavItem to="/sponsors">推荐位</NavItem>
            <NavItem to="/submit" end>
              提交插件
            </NavItem>
          </nav>
        </div>
      </header>

      <main className="container flex-grow-1 py-4 lg:py-5">{children}</main>

      <footer className="border-top py-4 mt-auto">
        <div className="container d-flex flex-column sm:flex-row sm:align-items-center sm:justify-content-between gap-2 fs-xs fg-secondary">
          <p className="mb-0">
            HarnessPack 的名单来自 awesome-dsh-plugin 清单，star 数据来自 GitHub 公开 API。
          </p>
          <p className="mb-0">
            非官方项目 ·{' '}
            <Link to="/about" className="text-decoration-none">
              数据口径
            </Link>{' '}
            ·{' '}
            <Link to="/about/api" className="text-decoration-none">
              API
            </Link>{' '}
            ·{' '}
            <Link to="/status" className="text-decoration-none">
              数据状态
            </Link>{' '}
            ·{' '}
            <Link to="/about/terms" className="text-decoration-none">
              使用条款
            </Link>{' '}
            ·{' '}
            <Link to="/sponsors" className="text-decoration-none">
              推荐位说明
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
