import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OvpCard, intlLocale } from '@/components/common/Fiori';
import { matchesHomeFilters, mergeCandidates, mergeCandidatesTotal, type HomeFilters } from '../homeSampleData';
import styles from './cards.module.css';

function scoreClass(score: number) {
  if (score >= 90) return styles.positive;
  if (score >= 75) return styles.critical;
  return styles.negative;
}

/** SAP "Table card" with search (Off-Contract Spend). */
export default function MergeCandidatesCard({ filters }: { filters: HomeFilters }) {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState('');
  const dateFmt = new Intl.DateTimeFormat(intlLocale(i18n.language), { day: 'numeric', month: 'numeric' });

  const query = q.trim().toLowerCase();
  const rows = mergeCandidates.filter(
    (r) =>
      matchesHomeFilters({ name: r.customer, domain: r.domain, sourceCode: r.source, date: r.detected }, filters) &&
      (!query || r.customer.toLowerCase().includes(query) || r.source.toLowerCase().includes(query))
  );

  return (
    <OvpCard
      title={t('page.home.ovp.merge.title')}
      subtitle={t('page.home.ovp.merge.subtitle')}
      counter={t('fiori.of', { shown: rows.length, total: mergeCandidatesTotal })}>
      <label className={styles.search}>
        <input
          id="home-merge-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('fiori.search')}
          aria-label={t('fiori.search')}
        />
      </label>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('page.home.ovp.merge.customer')}</th>
              <th>{t('page.home.ovp.merge.source')}</th>
              <th>{t('page.home.ovp.merge.date')}</th>
              <th className={styles.end}>{t('page.home.ovp.merge.score')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  {q.trim() ? t('fiori.no_matches', { q: q.trim() }) : t('fiori.filters.no_match')}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.customer}>
                  <td>{r.customer}</td>
                  <td>{r.source}</td>
                  <td>{dateFmt.format(new Date(`${r.detected}T00:00:00`))}</td>
                  <td className={`${styles.end} ${scoreClass(r.score)}`}>{r.score}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </OvpCard>
  );
}
