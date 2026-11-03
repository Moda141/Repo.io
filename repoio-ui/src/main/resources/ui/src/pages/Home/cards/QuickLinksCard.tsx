import type { ReactNode } from 'react';
import { Link, generatePath } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { OvpCard } from '@/components/common/Fiori';
import { ROUTES } from '@/constants/routes';
import styles from './cards.module.css';

const icon = (d: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {d}
  </svg>
);
const s = { stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const LINKS: { key: string; to: string; icon: ReactNode }[] = [
  {
    key: 'new_customer',
    to: generatePath(ROUTES.ENTITY_NEW, { entityType: 'customer' }),
    icon: icon(<><circle cx="9" cy="8" r="4" {...s} /><path d="M2 20c0-3.5 3-6 7-6M18 14v6M15 17h6" {...s} /></>),
  },
  {
    key: 'duplicates',
    to: generatePath(ROUTES.DUPLICATE_LIST, { entityType: 'customer' }),
    icon: icon(<><rect x="3" y="4" width="8" height="16" rx="1.5" {...s} /><rect x="13" y="4" width="8" height="16" rx="1.5" {...s} /></>),
  },
  { key: 'quality_report', to: ROUTES.QUALITY, icon: icon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" {...s} />) },
  {
    key: 'sources',
    to: ROUTES.SOURCES,
    icon: icon(<><ellipse cx="12" cy="6" rx="8" ry="3" {...s} /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" {...s} /></>),
  },
  {
    key: 'rules',
    to: ROUTES.QUALITY_RULES,
    icon: icon(<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" {...s} /><path d="M9 12l2 2 4-4" {...s} /></>),
  },
  {
    key: 'audit',
    to: ROUTES.SETTINGS_AUDIT,
    icon: icon(<><circle cx="12" cy="12" r="9" {...s} /><path d="M12 8v4l3 2" {...s} /></>),
  },
];

/** SAP "Quick Links" card. */
export default function QuickLinksCard() {
  const { t } = useTranslation();
  return (
    <OvpCard title={t('page.home.ovp.links.title')} counter={t('fiori.of', { shown: LINKS.length, total: 10 })}>
      <ul className={styles.links}>
        {LINKS.map((l) => (
          <li key={l.key}>
            <Link to={l.to} className={styles.link}>
              {l.icon}
              {t(`page.home.ovp.links.${l.key}`)}
            </Link>
          </li>
        ))}
      </ul>
    </OvpCard>
  );
}
