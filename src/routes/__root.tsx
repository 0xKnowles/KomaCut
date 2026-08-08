import { createRootRoute, Outlet, Link, useLocation } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const location = useLocation()
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
  })
  const isExtraRoute = location.pathname === '/image' || location.pathname === '/video' || location.pathname === '/metadata'
  const [extraOpen, setExtraOpen] = useState(isExtraRoute)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    if (isExtraRoute) {
      setExtraOpen(true)
    }
  }, [isExtraRoute])

  return (
    <>
      <div className="grain" />
      <main className="layout">
        <header className="header">
          <div className="logo">
            <span className="logo-koma">Koma</span>
            <span className="logo-cut-rule" aria-hidden="true" />
            <span className="logo-cut">Cut</span>
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
            aria-label="Toggle theme"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
          <p className="tagline">
            XTC tools for KomaOS on the XTEink X4 · Forked from{' '}
            <a
              href="https://github.com/varo6/xtcjs"
              target="_blank"
              rel="noopener"
              style={{ color: 'inherit' }}
            >
              xtcjs
            </a>{' '}
            ♥
          </p>
        </header>

        <div className="nav-stack">
          <nav className="nav-tabs">
            <Link to="/" className={`nav-tab${location.pathname === '/' ? ' active' : ''}`}>
              Manga / Comics
            </Link>
            <Link to="/pdf" className={`nav-tab${location.pathname === '/pdf' ? ' active' : ''}`}>
              PDF
            </Link>
            <Link to="/merge" className={`nav-tab${location.pathname === '/merge' ? ' active' : ''}`}>
              Merge / Split
            </Link>
            <button
              type="button"
              className={`nav-tab nav-tab-button${extraOpen || isExtraRoute ? ' active' : ''}`}
              onClick={() => setExtraOpen((prev) => !prev)}
              aria-expanded={extraOpen}
              aria-controls="extra-tools-nav"
            >
              Extra <span className="nav-caret" aria-hidden="true">▼</span>
            </button>
          </nav>

          {extraOpen && (
            <nav id="extra-tools-nav" className="nav-subtabs" aria-label="Extra tools">
              <Link to="/image" className={`nav-subtab${location.pathname === '/image' ? ' active' : ''}`}>
                Image
              </Link>
              <Link to="/video" className={`nav-subtab${location.pathname === '/video' ? ' active' : ''}`}>
                Video
              </Link>
              <Link to="/metadata" className={`nav-subtab${location.pathname === '/metadata' ? ' active' : ''}`}>
                Metadata
              </Link>
            </nav>
          )}
        </div>

        <Outlet />

        <footer className="footer">
          <p>All processing happens in your browser · Your files never leave your device</p>
          <div className="footer-links">
            <a href="https://github.com/0xKnowles/KomaCut" target="_blank" rel="noopener">GitHub</a>
            <span>·</span>
            <Link to="/about">About</Link>
            <span>·</span>
            <a href="https://github.com/0xKnowles/KomaOS" target="_blank" rel="noopener">KomaOS</a>
            <span>·</span>
            <a href="https://github.com/varo6/xtcjs" target="_blank" rel="noopener">Forked from xtcjs</a>
          </div>
        </footer>
      </main>
    </>
  )
}
