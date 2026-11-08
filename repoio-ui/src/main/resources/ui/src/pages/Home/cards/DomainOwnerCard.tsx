import { useTranslation } from 'react-i18next';
import { CardActionsButton, dragHandleProps, intlLocale } from '@/components/common/Fiori';
import { domainOwner } from '../homeSampleData';
import styles from './cards.module.css';
import cardStyles from '@/components/common/Fiori/OvpCard.module.css';

/** SAP contact / object card. */
export default function DomainOwnerCard() {
  const { t, i18n } = useTranslation();
  const date = new Intl.DateTimeFormat(intlLocale(i18n.language), { dateStyle: 'long' }).format(
    new Date(`${domainOwner.lastReview}T00:00:00`)
  );

  return (
    <article className={cardStyles.card} style={{ position: 'relative' }}>
      <div className={styles.contactTop} {...dragHandleProps}>
        <div className={styles.photo} aria-hidden="true">{domainOwner.initials}</div>
        <div>
          <div className={styles.contactName}>{t('page.home.ovp.owner.name')}</div>
          <div className={styles.muted} style={{ fontSize: 13, marginTop: 2 }}>{t('page.home.ovp.owner.role')}</div>
        </div>
        <span style={{ marginInlineStart: 'auto', alignSelf: 'flex-start' }}>
          <CardActionsButton />
        </span>
      </div>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('page.home.ovp.owner.title')}</h3>
        <div className={styles.label}>{t('page.home.ovp.owner.domain_label')}</div>
        <div className={styles.value}>{t('page.home.ovp.owner.domain_value')}</div>
        <div className={styles.label}>{t('page.home.ovp.owner.email')}</div>
        <div className={styles.value}>
          <a href={`mailto:${domainOwner.email}`}>{domainOwner.email}</a>
        </div>
        <div className={styles.label}>{t('page.home.ovp.owner.source')}</div>
        <div className={styles.value}>{domainOwner.source}</div>
      </div>
      <div className={`${styles.section} ${styles.sectionSep}`}>
        <h3 className={styles.sectionTitle}>{t('page.home.ovp.owner.governance')}</h3>
        <div className={styles.label}>{t('page.home.ovp.owner.last_review')}</div>
        <div className={styles.value}>{date}</div>
      </div>
    </article>
  );
}
