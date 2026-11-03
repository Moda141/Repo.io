import { useTranslation } from 'react-i18next';
import { OvpCard, intlLocale } from '@/components/common/Fiori';
import { stewardNotes } from '../homeSampleData';
import styles from './cards.module.css';

/** SAP "Team Members" timeline card. */
export default function StewardsCard() {
  const { t, i18n } = useTranslation();
  const fmt = new Intl.DateTimeFormat(intlLocale(i18n.language), { dateStyle: 'short', timeStyle: 'short' });

  return (
    <OvpCard title={t('page.home.ovp.stewards.title')}>
      <div className={styles.timeline}>
        {stewardNotes.map((n) => (
          <div key={n.nameKey} className={styles.tlItem}>
            <div className={styles.tlIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 5h16v11H9l-5 4V5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div className={styles.tlBox}>
              <div className={styles.tlHead}>
                <div className={styles.initials}>{n.initials}</div>
                <div>
                  <div>
                    <span className={styles.tlName}>{t(`page.home.ovp.stewards.${n.nameKey}.name`)}</span>{' '}
                    {t(`page.home.ovp.stewards.${n.nameKey}.role`)}
                  </div>
                  <div className={styles.tlTime}>{fmt.format(new Date(n.at))}</div>
                </div>
              </div>
              <p>{t(`page.home.ovp.stewards.${n.nameKey}.note`)}</p>
            </div>
          </div>
        ))}
      </div>
    </OvpCard>
  );
}
