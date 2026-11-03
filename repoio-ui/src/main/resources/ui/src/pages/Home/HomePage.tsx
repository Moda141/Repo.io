import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DynamicPageHeader,
  FilterBar,
  P13nDialog,
  PersonalizableOvpGrid,
  UndoToast,
  useActiveFiltersText,
  useCardLayout,
  type FilterField,
  type FilterValues,
} from '@/components/common/Fiori';
import CompletenessCard from './cards/CompletenessCard';
import OpenReviewsCard from './cards/OpenReviewsCard';
import MergeCandidatesCard from './cards/MergeCandidatesCard';
import QuickLinksCard from './cards/QuickLinksCard';
import ChangeRequestsCard from './cards/ChangeRequestsCard';
import DomainOwnerCard from './cards/DomainOwnerCard';
import StewardsCard from './cards/StewardsCard';
import ScheduleCard from './cards/ScheduleCard';
import { openReviews, type HomeFilters } from './homeSampleData';
import styles from './HomePage.module.css';

/**
 * HomePage — SAP Fiori Horizon Overview Page.
 *
 * Reference:  repoio-ui/design-reference/sap-s4hana/01-overview-page.svg
 *             + components/filter-bar.svg, dialogs.svg (P13n)
 * Prototype:  repoio-ui/design-reference/prototypes/01-home-overview.html
 *
 *   Dynamic page header — variant, active-filter summary, Filter Bar (Go)
 *   Personalizable masonry cards — drag by header, "…" menu (hide / move),
 *   Manage Cards dialog to show, hide and reorder
 *
 * Data comes from homeSampleData.ts until the home endpoints exist; the
 * header shows a "Sample data" badge while that is the case.
 */

const CARD_IDS = ['completeness', 'reviews', 'merge', 'links', 'requests', 'owner', 'stewards', 'schedule'];
const CARD_TITLES: Record<string, string> = {
  completeness: 'page.home.ovp.completeness.title',
  reviews: 'page.home.ovp.reviews.title',
  merge: 'page.home.ovp.merge.title',
  links: 'page.home.ovp.links.title',
  requests: 'page.home.ovp.requests.title',
  owner: 'page.home.ovp.owner.title',
  stewards: 'page.home.ovp.stewards.title',
  schedule: 'page.home.ovp.schedule.title',
};

export default function HomePage() {
  const { t } = useTranslation();
  const [openCount, setOpenCount] = useState(openReviews.open);
  const [filters, setFilters] = useState<FilterValues>({});
  const [manageOpen, setManageOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const cards = useCardLayout('repoio-home-cards', CARD_IDS);

  useEffect(() => {
    document.title = `${t('shell.app_title')} · Repo.io`;
  }, [t]);

  const filterFields: FilterField[] = useMemo(
    () => [
      { key: 'q', type: 'search', label: t('fiori.filters.q'), placeholder: t('fiori.filters.q_placeholder') },
      {
        key: 'domain',
        type: 'select',
        label: t('fiori.filters.domain'),
        options: [
          { value: 'customers', label: t('nav.menu.customers') },
          { value: 'products', label: t('nav.menu.products') },
          { value: 'vendors', label: t('nav.menu.vendors') },
        ],
      },
      {
        key: 'source',
        type: 'select',
        label: t('fiori.filters.source'),
        options: [
          { value: 'C4C', label: 'SAP C4C' },
          { value: 'ERP', label: 'ERP' },
          { value: 'CSV', label: 'CSV' },
          { value: 'manual', label: t('page.home.ovp.requests.source_manual') },
        ],
      },
      {
        key: 'status',
        type: 'select',
        label: t('fiori.filters.status'),
        options: [
          { value: 'missing_data', label: t('page.home.ovp.requests.state.missing_data') },
          { value: 'needs_review', label: t('page.home.ovp.requests.state.needs_review') },
          { value: 'ready', label: t('page.home.ovp.requests.state.ready') },
        ],
      },
      {
        key: 'period',
        type: 'select',
        label: t('fiori.filters.period'),
        visible: false,
        options: [
          { value: '3', label: t('fiori.filters.last_3') },
          { value: '7', label: t('fiori.filters.last_7') },
        ],
      },
    ],
    [t]
  );
  const activeText = useActiveFiltersText(filterFields, filters);
  const homeFilters = filters as HomeFilters;
  const titleOf = useCallback((id: string) => t(CARD_TITLES[id]), [t]);
  const clearToast = useCallback(() => setToast(null), []);

  const nodes: Record<string, ReactNode> = {
    completeness: <CompletenessCard />,
    reviews: <OpenReviewsCard open={openCount} />,
    merge: <MergeCandidatesCard filters={homeFilters} />,
    links: <QuickLinksCard />,
    requests: (
      <ChangeRequestsCard filters={homeFilters} onDecision={() => setOpenCount((n) => Math.max(0, n - 1))} />
    ),
    owner: <DomainOwnerCard />,
    stewards: <StewardsCard />,
    schedule: <ScheduleCard />,
  };

  function hideCard(id: string) {
    cards.hide(id);
    setToast({ text: t('fiori.cards.hidden_toast', { title: titleOf(id) }), undo: () => cards.show(id) });
  }

  return (
    <div className={styles.page}>
      <DynamicPageHeader
        variant={t('page.home.ovp.variant')}
        subtitle={activeText}
        badges={<span className={styles.sample}>{t('page.home.ovp.sample_data')}</span>}
        actions={
          <>
            <button className={styles.textAction} aria-haspopup="dialog" onClick={() => setManageOpen(true)}>
              {t('fiori.cards.manage')}
            </button>
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
          </>
        }>
        <FilterBar fields={filterFields} onGo={setFilters} />
      </DynamicPageHeader>

      <div className={styles.content}>
        <PersonalizableOvpGrid
          cards={cards.visible.map((id) => ({ id, title: titleOf(id), node: nodes[id] }))}
          onReorder={cards.setVisibleOrder}
          onHide={hideCard}
          onMove={cards.move}
          empty={
            <div className={styles.empty}>
              <h3>{t('fiori.cards.empty_title')}</h3>
              <p>{t('fiori.cards.empty_text')}</p>
              <button className={styles.emphasized} onClick={() => setManageOpen(true)}>
                {t('fiori.cards.manage')}
              </button>
            </div>
          }
        />
      </div>

      <P13nDialog
        open={manageOpen}
        title={t('fiori.cards.manage')}
        description={t('fiori.cards.manage_hint')}
        reorderable
        items={cards.layout.order.map((id) => ({ id, title: titleOf(id), visible: !cards.layout.hidden.includes(id) }))}
        defaults={CARD_IDS.map((id) => ({ id, title: titleOf(id), visible: true }))}
        onCancel={() => setManageOpen(false)}
        onOk={(items) => {
          cards.setLayout({ order: items.map((i) => i.id), hidden: items.filter((i) => !i.visible).map((i) => i.id) });
          setManageOpen(false);
        }}
      />

      {toast && <UndoToast text={toast.text} onUndo={toast.undo} onDone={clearToast} />}
    </div>
  );
}
