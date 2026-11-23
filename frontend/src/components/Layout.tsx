import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ThemeSwitcher } from './ThemeSwitcher';

const NAV = [
  { to: '/rankings/velocity', label: '榜单' },
  { to: '/categories', label: '分类榜' },
  { to: '/plugins', label: '插件库' },
];

const ABOUT_LINKS = [
  { to: '/about#rules', label: '收录规则' },
  { to: '/about#sponsors', label: '推荐位' },
  { to: '/about#submit', label: '插件提交' },
];

function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0">
      <rect x="3" y="13" width="3.5" height="8" rx="1" fill="#4cc9f0" />
      <rect x="10.25" y="9" width="3.5" height="12" rx="1" fill="#f5b544" />
      <rect x="17.5" y="4" width="3.5" height="17" rx="1" fill="#4cc9f0" />
    </svg>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const aboutRef = useRef<HTMLLIElement>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Let Bootstrap's drawer handle closing so the backdrop and scroll lock are released too.
  const closeDrawer = () => {
    if (dialogRef.current?.open) closeRef.current?.click();
  };

  const closeAbout = () => setAboutOpen(false);

  useEffect(() => {
    if (!aboutOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!aboutRef.current?.contains(event.target as Node)) setAboutOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAboutOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [aboutOpen]);

  return (
    <div className="d-flex flex-column min-vh-100">
      <header className="sticky-top">
        <nav className="navbar md:navbar-expand hp-navbar">
          <div className="container">
            <Link to="/" className="navbar-brand d-flex align-items-center gap-2 fw-semibold">
              <Logo />
              <span>HarnessPack</span>
              <span className="badge theme-secondary badge-subtle d-none sm:d-inline-flex align-self-center">
                beta
              </span>
            </Link>

            <button
              className="btn-icon navbar-toggler ms-auto"
              type="button"
              data-bs-toggle="drawer"
              data-bs-target="#navbarDrawer"
              aria-controls="navbarDrawer"
              aria-expanded="false"
              aria-label="展开导航"
            >
              <span className="navbar-toggler-icon" aria-hidden="true" />
            </button>

            <dialog
              className="drawer drawer-end"
              id="navbarDrawer"
              ref={dialogRef}
              tabIndex={-1}
              aria-labelledby="navbarDrawerLabel"
            >
              <div className="drawer-header">
                <h5 className="drawer-title" id="navbarDrawerLabel">
                  导航
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  data-bs-dismiss="drawer"
                  aria-label="关闭导航"
                  ref={closeRef}
                />
              </div>
              <div className="drawer-body mb-2 md:mb-0">
                <ul className="nav navbar-nav me-auto">
                  {NAV.map((item) => (
                    <li key={item.to} className="nav-item">
                      <NavLink
                        to={item.to}
                        onClick={closeDrawer}
                        className={({ isActive }) =>
                          `nav-link text-nowrap${isActive ? ' active' : ''}`
                        }
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}

                  {/* Desktop: one "关于" item with a dropdown. */}
                  <li className="nav-item d-none md:d-block position-relative" ref={aboutRef}>
                    <button
                      type="button"
                      className={`nav-link text-nowrap${aboutOpen ? ' active' : ''}`}
                      aria-haspopup="menu"
                      aria-expanded={aboutOpen}
                      onClick={() => setAboutOpen((value) => !value)}
                    >
                      关于
                    </button>
                    <ul
                      className={`menu${aboutOpen ? ' show' : ''}`}
                      role="menu"
                      aria-label="关于"
                      style={{ top: 'calc(100% + 0.25rem)', left: 0 }}
                    >
                      {ABOUT_LINKS.map((item) => (
                        <li key={item.to} role="none">
                          <Link
                            to={item.to}
                            role="menuitem"
                            className="menu-item d-flex align-items-center gap-2"
                            onClick={closeAbout}
                          >
                            <span className="menu-item-content">
                              <span className="menu-item-text">{item.label}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>

                  {/* Mobile drawer: the same three entries, listed inline. */}
                  <li className="nav-item md:d-none">
                    <span className="nav-link text-nowrap fg-secondary">关于</span>
                  </li>
                  {ABOUT_LINKS.map((item) => (
                    <li key={item.to} className="nav-item md:d-none ms-3">
                      <Link to={item.to} className="nav-link text-nowrap" onClick={closeDrawer}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <ThemeSwitcher />
              </div>
            </dialog>
          </div>
        </nav>
      </header>

      <main className="container flex-grow-1 py-4 lg:py-5">{children}</main>

      <footer className="hp-footer py-4 mt-auto">
        <div className="container d-flex flex-column sm:flex-row sm:align-items-center sm:justify-between gap-2 fs-xs fg-secondary">
          <p className="mb-0">
            HarnessPack 的名单来自 awesome-dsh-plugin 清单，star 数据来自 GitHub 公开 API。
          </p>
          <p className="mb-0">
            非官方项目 ·{' '}
            <Link to="/about/data" className="text-decoration-none">
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
            <Link to="/about#sponsors" className="text-decoration-none">
              推荐位说明
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
