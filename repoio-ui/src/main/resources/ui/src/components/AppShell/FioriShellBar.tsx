import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/constants/routes';
import styles from './FioriShellBar.module.css';

/**
 * FioriShellBar — SAP Fiori Horizon Shell Bar
 *
 * Anatomy (left → right, matches Fiori spec):
 *   [Logo] | [App Title]   [spacer]   [Search] [Notifications] [Help] [Avatar]
 *
 * Height: 44px (--sapShellBar_Height)
 * Background: #354A5E (--sapShellColor)
 */
export default function FioriShellBar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Focus search input when it opens
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  }

  function toggleLanguage() {
    i18n.changeLanguage(i18n.language === 'ar-EG' ? 'en-US' : 'ar-EG');
  }

  const isArabic = i18n.language === 'ar-EG';

  return (
    <header
      className={styles.shellBar}
      role="banner"
      aria-label="Application shell bar">

      {/* Logo + App title */}
      <Link to={ROUTES.HOME} className={styles.logoGroup} aria-label="Repo.io — Go to home">
        {/* SAP-style logo mark */}
        <div className={styles.logoMark} aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="4" fill="#0070F2"/>
            <path
              d="M7 19.5L12.5 8.5L18 19.5M9.5 15.5H16.5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className={styles.appTitle}>Repo.io</span>
      </Link>

      {/* Separator */}
      <div className={styles.separator} aria-hidden="true" />

      {/* App descriptor */}
      <span className={styles.appDescriptor}>
        {t('app.descriptor', 'Master Data')}
      </span>

      {/* Spacer */}
      <div className={styles.spacer} />

      {/* Search */}
      {searchOpen ? (
        <form
          className={styles.searchForm}
          onSubmit={handleSearchSubmit}
          role="search"
          aria-label="Global search">
          <input
            ref={searchRef}
            type="search"
            className={styles.searchInput}
            placeholder={t('nav.search_placeholder', 'Search entities, fields…')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)}
            aria-label={t('nav.search_placeholder', 'Search entities, fields…')}
          />
        </form>
      ) : (
        <button
          className={styles.iconBtn}
          onClick={() => setSearchOpen(true)}
          aria-label={t('nav.search', 'Search')}
          title={t('nav.search', 'Search')}>
          {/* Search icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      {/* Language toggle (EN / AR) */}
      <button
        className={styles.iconBtn}
        onClick={toggleLanguage}
        aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
        title={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: 0 }}>
          {isArabic ? 'EN' : 'ع'}
        </span>
      </button>

      {/* Notifications */}
      <button
        className={styles.iconBtn}
        aria-label={t('nav.notifications', 'Notifications')}
        title={t('nav.notifications', 'Notifications')}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 2a5 5 0 0 1 5 5v2.5l1 1.5H2l1-1.5V7a5 5 0 0 1 5-5Z"
            stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M6.5 13a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </button>

      {/* Help */}
      <button
        className={styles.iconBtn}
        aria-label={t('nav.help', 'Help')}
        title={t('nav.help', 'Help')}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M6 6.5C6 5.4 6.9 4.5 8 4.5s2 .9 2 2c0 1-1 1.5-1.5 2S8 10 8 10"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="8" cy="12" r="0.75" fill="currentColor"/>
        </svg>
      </button>

      {/* User avatar + menu */}
      <div className={styles.userMenu} ref={userMenuRef}>
        <button
          className={styles.avatar}
          onClick={() => setUserMenuOpen((o) => !o)}
          aria-label="User account"
          aria-expanded={userMenuOpen}
          aria-haspopup="menu">
          MM
        </button>

        {userMenuOpen && (
          <div className={styles.userMenuDropdown} role="menu">
            <div className={styles.userMenuHeader}>
              <div className={styles.userMenuName}>Mohamed M.</div>
              <div className={styles.userMenuRole}>Data Management Manager</div>
            </div>
            <div className={styles.userMenuDivider} />
            <Link
              to={ROUTES.SETTINGS}
              className={styles.userMenuItem}
              role="menuitem"
              onClick={() => setUserMenuOpen(false)}>
              Settings
            </Link>
            <button
              className={styles.userMenuItem}
              role="menuitem"
              onClick={() => {
                setUserMenuOpen(false);
                /* sign out */
              }}>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
