import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { OvpCard } from '@/components/common/Fiori';
import { ROUTES } from '@/constants/routes';
import { openReviews } from '../homeSampleData';
import styles from './cards.module.css';

interface Props {
  open: number;
}

/** SAP "Numeric card": big count in a side column ("20 of 42"). */
export default function OpenReviewsCard({ open }: Props) {
  const { t } = useTranslation();
  return (
    <OvpCard
      title={t('page.home.ovp.reviews.title')}
      subtitle={t('page.home.ovp.reviews.subtitle')}
      onMore={() => undefined}
      side={
        <>
          <div>
            <div className={styles.bigNumber}>{open}</div>
            <div className={styles.of}>
              {t('fiori.of_word')}
              <br />
              {openReviews.total}
            </div>
          </div>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="8" y="8" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M5 16V7a2 2 0 0 1 2-2h9M2 13V4a2 2 0 0 1 2-2h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </>
      }>
      <Link to={ROUTES.CHANGE_REQUESTS} className={styles.viewAll}>
        {t('fiori.view_all')}
      </Link>
    </OvpCard>
  );
}
