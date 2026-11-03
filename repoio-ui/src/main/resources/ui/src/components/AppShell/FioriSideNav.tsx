import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/constants/routes';
import styles from './FioriSideNav.module.css';

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  to: string;
  badge?: number;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

/**
 * FioriSideNav — SAP Fiori Horizon Side Navigation
 *
 * Layout follows Fiori Shell Navigation floorplan (node 53:7532):
 *   - Header: toggle button
 *   - Items: icon + label, 44px height
 *   - Active state: left border accent + blue text
 *   - Collapsed: 48px (icon only)
 *   - Expanded: 272px (icon + label)
 *
 * Navigation sections follow Repo.io domain structure.
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

function ChevronLeft() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function FioriSideNav({ collapsed, onToggle }: Props) {
  const { t } = useTranslation();

  const sections: NavSection[] = [
    {
      items: [
        { key: 'home', label: t('nav.home', 'Home'), icon: <HomeIcon />, to: ROUTES.HOME },
        { key: 'explore', label: t('nav.explore', 'Repositories'), icon: <GridIcon />, to: ROUTES.EXPLORE },
      ],
    },
    {
      title: collapsed ? undefined : t('nav.section_govern', 'Govern'),
      items: [
        { key: 'pipelines', label: t('nav.pipelines', 'Pipelines'), icon: <PipelineIcon />, to: ROUTES.PIPELINES ?? '/pipelines' },
        { key: 'quality', label: t('nav.quality', 'Data Quality'), icon: <QualityIcon />, to: ROUTES.QUALITY ?? '/quality' },
        { key: 'glossary', label: t('nav.glossary', 'Glossary'), icon: <GlossaryIcon />, to: ROUTES.GLOSSARY ?? '/glossary' },
      ],
    },
    {
      items: [
        { key: 'settings', label: t('nav.settings', 'Settings'), icon: <SettingsIcon />, to: ROUTES.SETTINGS ?? '/settings' },
      ],
    },
  ];

  return (
    <nav
      className={`${styles.sideNav} ${collapsed ? styles.collapsed : ''}`}
      aria-label="Side navigation"
      style={{
        width: collapsed ? 'var(--sapSideNav_CollapsedWidth)' : 'var(--sapSideNav_Width)',
      }}>

      {/* Navigation items */}
      <div className={styles.inner}>
        {sections.map((section, si) => (
          <div key={si} className={`${styles.section} ${si > 0 ? styles.sectionBorder : ''}`}>
            {section.title && (
              <div className={styles.sectionTitle} aria-hidden={collapsed}>
                {section.title}
              </div>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                className={({ isActive }) =>
                  `${styles.item} ${isActive ? styles.itemActive : ''}`
                }
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}>

                <span className={styles.itemIcon} aria-hidden="true">
                  {item.icon}
                </span>

                {!collapsed && (
                  <span className={styles.itemText}>{item.label}</span>
                )}

                {!collapsed && item.badge != null && item.badge > 0 && (
                  <span className={styles.itemBadge}>{item.badge}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* Collapse toggle button */}
      <div className={styles.toggle}>
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className={styles.toggleBtn}>
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>
    </nav>
  );
}
