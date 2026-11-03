import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DynamicPageHeader, OvpGrid } from '@/components/common/Fiori';
import CompletenessCard from './cards/CompletenessCard';
import OpenReviewsCard from './cards/OpenReviewsCard';
import MergeCandidatesCard from './cards/MergeCandidatesCard';
import QuickLinksCard from './cards/QuickLinksCard';
import ChangeRequestsCard from './cards/ChangeRequestsCard';
import DomainOwnerCard from './cards/DomainOwnerCard';
import StewardsCard from './cards/StewardsCard';
import ScheduleCard from './cards/ScheduleCard';
import { openReviews } from './homeSampleData';
import styles from './HomePage.module.css';

/**
 * HomePage — SAP Fiori Horizon Overview Page.
 *
 * Reference:  repoio-ui/design-reference/sap-s4hana/01-overview-page.svg
 * Prototype:  repoio-ui/design-reference/prototypes/01-home-overview.html
 *
 *   Dynamic page header — variant "Standard", "No filters active"
 *   Masonry card columns (OvpGrid):
 *     Analytical · Numeric · Table · Quick links · List (approve/reject)
 *     Contact · Timeline · Calendar
 *
 * Data comes from homeSampleData.ts until the home endpoints exist; the
 * header shows a "Sample data" badge while that is the case.
 */
export default function HomePage() {
  const { t } = useTranslation();
  const [openCount, setOpenCount] = useState(openReviews.open);

  useEffect(() => {
    document.title = `${t('shell.app_title')} · Repo.io`;
  }, [t]);

  return (
    <div className={styles.page}>
      <DynamicPageHeader
        variant={t('page.home.ovp.variant')}
        subtitle={t('page.home.ovp.no_filters')}
        badges={<span className={styles.sample}>{t('page.home.ovp.sample_data')}</span>}
        actions={
          <button className={styles.headerAction} aria-label={t('page.home.ovp.share')} title={t('page.home.ovp.share')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        }
      />

      <div className={styles.content}>
        <OvpGrid>
          <CompletenessCard />
          <OpenReviewsCard open={openCount} />
          <MergeCandidatesCard />
          <QuickLinksCard />
          <ChangeRequestsCard onDecision={() => setOpenCount((n) => Math.max(0, n - 1))} />
          <DomainOwnerCard />
          <StewardsCard />
          <ScheduleCard />
        </OvpGrid>
      </div>
    </div>
  );
}
