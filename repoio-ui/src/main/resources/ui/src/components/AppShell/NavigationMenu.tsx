import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/constants/routes';
import styles from './NavigationMenu.module.css';

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  to: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

/**
 * NavigationMenu — SAP Fiori Horizon Navigation Menu.
 *
 * Reference: design-reference/sap-s4hana/components/navigation-menu.svg
 * A popover anchored under the shell bar menu (☰) button — it overlays the
 * page and does not push content. 288px wide, 32px rows (Compact), radius 8,
 * section titles in label color, separator above the footer group.
 * Closes on outside click, Escape, or navigation.
 */
function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 6.5L8 2l6 4.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6.5Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M6 15V9h4v6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function PipelineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="3" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="13" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4.5 8H6.5M9.5 4L11.5 7M9.5 12L11.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function QualityIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L9.8 6.6l5 .4-3.8 3.3 1.2 4.8L8 13.4l-4.2 1.7 1.2-4.8L1.2 7l5-.4L8 2Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

function GlossaryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 6h6M5 8h6M5 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.53 11.53l1.42 1.42M3.05 12.95l1.42-1.42M11.53 4.47l1.42-1.42"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Element that toggles the menu; clicks on it are not "outside". */
  anchorRef: React.RefObject<HTMLElement>;
}

export default function NavigationMenu({ open, onClose, anchorRef }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const location = useLocation();

  useEffect(() => {
    if (open) onClose();
    // close when the route changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        anchorRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('a')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const sections: NavSection[] = [
    {
      items: [
        { key: 'home', label: t('nav.home', 'Home'), icon: <HomeIcon />, to: ROUTES.HOME },
        { key: 'explore', label: t('nav.explore', 'Repositories'), icon: <GridIcon />, to: ROUTES.EXPLORE },
      ],
    },
    {
      title: t('nav.section_govern', 'Govern'),
      items: [
        { key: 'pipelines', label: t('nav.pipelines', 'Pipelines'), icon: <PipelineIcon />, to: ROUTES.PIPELINES },
        { key: 'quality', label: t('nav.quality', 'Data Quality'), icon: <QualityIcon />, to: ROUTES.QUALITY },
        { key: 'glossary', label: t('nav.glossary', 'Glossary'), icon: <GlossaryIcon />, to: '/glossary' },
      ],
    },
  ];
  const footer: NavItem = {
    key: 'settings',
    label: t('nav.settings', 'Settings'),
    icon: <SettingsIcon />,
    to: ROUTES.SETTINGS,
  };

  const link = (item: NavItem) => (
    <NavLink
      key={item.key}
      to={item.to}
      className={({ isActive }) => `${styles.item} ${isActive ? styles.itemActive : ''}`}>
      <span className={styles.itemIcon} aria-hidden="true">{item.icon}</span>
      <span className={styles.itemText}>{item.label}</span>
    </NavLink>
  );

  return (
    <nav ref={ref} className={styles.menu} aria-label={t('shell.menu', 'Menu')}>
      <div className={styles.body}>
        {sections.map((section, si) => (
          <div key={si} className={styles.section}>
            {section.title && <div className={styles.sectionTitle}>{section.title}</div>}
            {section.items.map(link)}
          </div>
        ))}
      </div>
      <div className={styles.footer}>{link(footer)}</div>
    </nav>
  );
}
