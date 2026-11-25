import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { ThemeSwitcher } from './ThemeSwitcher';
import { LangSwitcher } from './LangSwitcher';
import { BackToTop } from './BackToTop';
import { useI18n } from '../lib/i18n';

function Logo() {
  return (
    <img
      src="/favicon-64.png"
      alt=""
      aria-hidden="true"
      width="28"
      height="28"
      className="flex-shrink-0 hp-brand-logo"
    />
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

const FRIEND_LINKS = [
  { label: 'DeepSeek', href: 'https://www.deepseek.com/' },
  { label: 'DeepSeek AI', href: 'https://github.com/deepseek-ai' },
  { label: 'DSH Market', href: 'https://dshmarket.com' },
  { label: 'DeepSeek1024', href: 'https://deepseek1024.com/' },
  { label: 'awesome-dsh-plugin', href: 'https://github.com/awesome-dsh-plugin/awesome-dsh-plugin' },
  { label: 'HarnessPack', href: 'https://github.com/wei-with-two-swords/harnesspack' },
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
      <header>
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
                <Menu aria-hidden="true" />
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
          <div className="footer-links fs-xs fg-secondary">
            {FRIEND_LINKS.map((item) => (
              <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className="text-decoration-none">
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
      <BackToTop />
    </div>
  );
}
