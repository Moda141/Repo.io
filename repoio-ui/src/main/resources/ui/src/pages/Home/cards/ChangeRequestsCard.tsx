import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ObjectStatus, OvpCard, OverflowIcon, STATE_COLOR } from '@/components/common/Fiori';
import { changeRequests, changeRequestsTotal, matchesHomeFilters, type HomeFilters } from '../homeSampleData';
import styles from './cards.module.css';

type Decision = 'approved' | 'rejected';

interface Props {
  onDecision: () => void;
  filters: HomeFilters;
}

const STATUS_FILTER: Record<string, string> = { missing_data: 'negative', needs_review: 'critical', ready: 'positive' };

/**
 * SAP "List card" (Urgent Purchase Requisition Items): title + status,
 * two attribute rows, a progress bar, and Approve / Reject actions.
 */
export default function ChangeRequestsCard({ onDecision, filters }: Props) {
  const { t } = useTranslation();
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  function decide(id: string, d: Decision) {
    setDecisions((prev) => ({ ...prev, [id]: d }));
    onDecision();
  }

  const shown = changeRequests.filter(
    (r) =>
      matchesHomeFilters(
        { name: r.customer, id: r.id, domain: r.domain, sourceCode: r.sourceCode, date: r.created },
        filters
      ) &&
      (!filters.status || STATUS_FILTER[filters.status] === r.state)
  );

  return (
    <OvpCard
      title={t('page.home.ovp.requests.title')}
      subtitle={t('page.home.ovp.requests.subtitle')}
      counter={t('fiori.of', { shown: shown.length, total: changeRequestsTotal })}
      onMore={() => undefined}>
      {shown.length === 0 && <div className={styles.empty}>{t('fiori.filters.no_match')}</div>}
      {shown.map((r) => {
        const color = STATE_COLOR[r.state];
        const decision = decisions[r.id];
        return (
          <div key={r.id} className={styles.req}>
            <div className={styles.row}>
              <span className={styles.rowTitle}>{t(`page.home.ovp.requests.kind.${r.kind}`, { name: r.customer })}</span>
              <ObjectStatus state={r.state}>{t(`page.home.ovp.requests.state.${r.stateKey}`)}</ObjectStatus>
            </div>
            <div className={styles.row}>
              <span className={`${styles.muted} ${styles.num}`}>{r.id}</span>
              <span className={styles.num}>{t('page.home.ovp.requests.fields', { count: r.fields })}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.muted}>
                {t('page.home.ovp.requests.domain', { domain: t(`page.home.ovp.domains.${r.domain}`) })}
              </span>
              <span>{r.source === 'manual' ? t('page.home.ovp.requests.source_manual') : r.source}</span>
            </div>
            <div className={styles.bar}>
              <div
                className={styles.track}
                role="progressbar"
                aria-valuenow={r.completeness}
                aria-valuemin={0}
                aria-valuemax={100}>
                <div className={styles.fill} style={{ width: `${r.completeness}%`, background: color }} />
              </div>
              <span className={styles.pct} style={{ color }}>{r.completeness}%</span>
            </div>
            <div className={styles.actions}>
              {decision ? (
                <span
                  className={styles.done}
                  style={{ color: decision === 'approved' ? 'var(--sapPositiveTextColor)' : 'var(--sapNegativeTextColor)' }}>
                  {t(`fiori.${decision}`)}
                </span>
              ) : (
                <>
                  <button className={`${styles.btn} ${styles.accept}`} onClick={() => decide(r.id, 'approved')}>
                    {t('fiori.approve')}
                  </button>
                  <button className={`${styles.btn} ${styles.reject}`} onClick={() => decide(r.id, 'rejected')}>
                    {t('fiori.reject')}
                  </button>
                  <button
                    className={`${styles.btn}`}
                    style={{ border: 0, background: 'none', color: 'var(--sapBrandColor_Hover)' }}
                    aria-label={t('fiori.more_options')}>
                    <OverflowIcon />
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </OvpCard>
  );
}
