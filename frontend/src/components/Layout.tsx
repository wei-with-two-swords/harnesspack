import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ThemeSwitcher } from './ThemeSwitcher';
import { LangSwitcher } from './LangSwitcher';
import { BackToTop } from './BackToTop';
import { useI18n } from '../lib/i18n';

function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0">
      <rect x="3" y="13" width="3.5" height="8" rx="1" fill="#38bdf8" />
      <rect x="10.25" y="9" width="3.5" height="12" rx="1" fill="#f5b544" />
      <rect x="17.5" y="4" width="3.5" height="17" rx="1" fill="#38bdf8" />
    </svg>
  );
}

const FOOTER = [
  { to: '/about/data', key: 'footer.data' },
  { to: '/status', key: 'footer.status' },
  { to: '/changelog', key: 'footer.changelog' },
  { to: '/compare', key: 'footer.compare' },
  { to: '/about/terms', key: 'footer.terms' },
  { to: '/about#sponsors', key: 'footer.sponsors' },
  { to: '/about', key: 'footer.about' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [navOpen, setNavOpen] = useState(false);

  const NAV = [
    { to: '/', key: 'nav.rankings', end: true },
    { to: '/community', key: 'nav.community', end: false },
    { to: '/api', key: 'nav.api', end: false },
  ];

  const closeNav = () => setNavOpen(false);

  return (
    <div className="d-flex flex-column min-vh-100">
      <header className="sticky-top">
        <nav className="navbar hp-navbar">
          <div className="container">
            <Link to="/" className="navbar-brand" onClick={closeNav}>
              <Logo />
              <span>HarnessPack</span>
            </Link>

            <ul className="nav navbar-nav desktop-nav">
              {NAV.map((item) => (
                <li key={item.to} className="nav-item">
                  <NavLink to={item.to} end={item.end}
                    className={({ isActive }) => `nav-link text-nowrap${isActive ? ' active' : ''}`}>
                    {t(item.key)}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="d-flex align-items-center gap-2" style={{ marginLeft: 'auto' }}>
              <LangSwitcher />
              <ThemeSwitcher />
              <button
                type="button"
                className="btn-icon mobile-menu-btn"
                aria-label={t('nav.menu')}
                aria-expanded={navOpen}
                onClick={() => setNavOpen((v) => !v)}
              >
                <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </button>
            </div>
          </div>
          {navOpen ? (
            <div className="mobile-nav">
              <div className="container">
                {NAV.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end}
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    onClick={() => setNavOpen(false)}>
                    {t(item.key)}
                  </NavLink>
                ))}
              </div>
            </div>
          ) : null}
        </nav>
      </header>

      <main className="container flex-grow-1 py-4 lg:py-5">{children}</main>

      <footer className="hp-footer py-4 mt-auto">
        <div className="container footer-inner">
          <p className="mb-2 fs-xs fg-secondary">{t('footer.note')}</p>
          <div className="footer-links fs-xs fg-secondary">
            <span>{t('footer.unofficial')}</span>
            {FOOTER.map((item) => (
              <Link key={item.to} to={item.to} className="text-decoration-none">{t(item.key)}</Link>
            ))}
            <a href="/sitemap.xml" className="text-decoration-none">{t('footer.sitemap')}</a>
            <a href="/feed.xml" className="text-decoration-none">{t('footer.feed')}</a>
            <a href="https://github.com/traffictoolbox/awesome-dsh-plugin" target="_blank" rel="noreferrer" className="text-decoration-none">
              {t('footer.repo')}
            </a>
          </div>
        </div>
      </footer>
      <BackToTop />
    </div>
  );
}
