import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/constants/routes';
import repoioLogo from '@/assets/img/brand/repoio-logo.png';
import styles from './FioriShellBar.module.css';

interface Props {
  navOpen: boolean;
  onMenuToggle: () => void;
  menuButtonRef: React.RefObject<HTMLButtonElement>;
}

/**
 * FioriShellBar — SAP Fiori Horizon Shell Bar (light)
 *
 * Reference: design-reference/sap-s4hana/01-overview-page.svg
 *
 * Anatomy (start → end, mirrors in RTL):
 *   [☰] [‹] [repo.io logo] | [App title ▾]   [spacer]   [Search field] [EN/ع] [🔔] [?] [Avatar]
 *
 * Height: 52px (--sapShellBar_Height). Background: white (--sapShellColor).
 */
export default function FioriShellBar({ navOpen, onMenuToggle, menuButtonRef }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
    const q = searchQuery.trim();
    if (q) {
      navigate(`${ROUTES.SEARCH}?q=${encodeURIComponent(q)}`);
      setSearchQuery('');
    }
  }

  const isArabic = i18n.language === 'ar-EG';

  return (
    <header className={styles.shellBar} role="banner">
      <button
        ref={menuButtonRef}
        className={`${styles.iconBtn} ${navOpen ? styles.iconBtnActive : ''}`}
        onClick={onMenuToggle}
        aria-label={t('shell.menu', 'Menu')}
        aria-expanded={navOpen}
        aria-haspopup="menu"
        title={t('shell.menu', 'Menu')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <button
        className={`${styles.iconBtn} ${styles.backBtn} ${styles.hideSmall}`}
        onClick={() => navigate(-1)}
        aria-label={t('shell.back', 'Back')}
        title={t('shell.back', 'Back')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <Link to={ROUTES.HOME} className={styles.logo} aria-label={t('shell.go_home', 'repo.io — Home')}>
        <img src={repoioLogo} alt="repo.io" height={32} />
      </Link>

      <div className={`${styles.separator} ${styles.hideSmall}`} aria-hidden="true" />

      <button className={styles.appTitle} type="button">
        <span className={styles.appTitleText}>{t('shell.app_title', 'Master Data Overview')}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className={styles.spacer} />

      <form className={styles.search} onSubmit={handleSearchSubmit} role="search">
        <input
          type="search"
          className={styles.searchInput}
          placeholder={t('nav.search_placeholder', 'Search records')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t('nav.search_placeholder', 'Search records')}
        />
        <button type="submit" className={styles.searchBtn} aria-label={t('nav.search', 'Search')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </form>

      <button
        className={styles.iconBtn}
        onClick={() => i18n.changeLanguage(isArabic ? 'en-US' : 'ar-EG')}
        aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
        title={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}>
        <span className={styles.langLabel}>{isArabic ? 'EN' : 'ع'}</span>
      </button>

      <Link
        to={ROUTES.NOTIFICATIONS}
        className={styles.iconBtn}
        aria-label={t('nav.notifications', 'Notifications')}
        title={t('nav.notifications', 'Notifications')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </Link>

      <button
        className={`${styles.iconBtn} ${styles.hideSmall}`}
        aria-label={t('nav.help', 'Help')}
        title={t('nav.help', 'Help')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <div className={styles.userMenu} ref={userMenuRef}>
        <button
          className={styles.avatar}
          onClick={() => setUserMenuOpen((o) => !o)}
          aria-label={t('shell.account', 'Account')}
          aria-expanded={userMenuOpen}
          aria-haspopup="menu">
          MM
        </button>

        {userMenuOpen && (
          <div className={styles.userMenuDropdown} role="menu">
            {/* SAP User Menu — design-reference/sap-s4hana/components/user-menu.svg */}
            <div className={styles.userMenuHeader}>
              <div className={styles.userMenuAvatar} aria-hidden="true">MM</div>
              <div className={styles.userMenuName}>Mohamed M.</div>
              <div className={styles.userMenuRole}>Data Management Manager</div>
            </div>
            <div className={styles.userMenuDivider} />
            <div className={styles.userMenuItems}>
              <Link
                to={ROUTES.SETTINGS}
                className={styles.userMenuItem}
                role="menuitem"
                onClick={() => setUserMenuOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                {t('nav.settings', 'Settings')}
              </Link>
              <Link
                to={ROUTES.PROFILE}
                className={styles.userMenuItem}
                role="menuitem"
                onClick={() => setUserMenuOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M12 11v6M12 7.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                {t('shell.about', 'About')}
              </Link>
            </div>
            <div className={styles.userMenuFooter}>
              <button className={styles.signOut} role="menuitem" onClick={() => setUserMenuOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3v8M7.1 6.5a7 7 0 1 0 9.8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                {t('auth.sign_out', 'Sign out')}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
