import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OvpCard, intlLocale } from '@/components/common/Fiori';
import { SAMPLE_TODAY, scheduledRunDays, todayRuns } from '../homeSampleData';
import styles from './cards.module.css';

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * SAP "My Calendar" card. Week starts on Saturday; Friday and Saturday are
 * shaded as the weekend (Egypt).
 */
export default function ScheduleCard() {
  const { t, i18n } = useTranslation();
  const today = new Date(`${SAMPLE_TODAY}T00:00:00`);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const runs = new Set(scheduledRunDays);

  const title = new Intl.DateTimeFormat(intlLocale(i18n.language), { month: 'long', year: 'numeric' }).format(month);
  const dowFmt = new Intl.DateTimeFormat(intlLocale(i18n.language), { weekday: 'short' });
  // 2026-10-31 is a Saturday — use it to label the 7 columns.
  const dows = Array.from({ length: 7 }, (_, i) => dowFmt.format(new Date(2026, 9, 31 + i)));

  const offset = (month.getDay() + 1) % 7; // Saturday-first
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - offset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (i >= 35 && d.getMonth() !== month.getMonth()) break;
    days.push(d);
  }

  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <OvpCard
      title={t('page.home.ovp.schedule.title')}
      subtitle={t('page.home.ovp.schedule.subtitle')}
      onMore={() => undefined}>
      <div className={styles.calNav}>
        <button onClick={() => shift(-1)} aria-label={t('fiori.prev_month')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <span aria-live="polite">{title}</span>
        <button onClick={() => shift(1)} aria-label={t('fiori.next_month')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className={styles.cal}>
        {dows.map((d) => (
          <div key={d} className={styles.dow}>{d}</div>
        ))}
        {days.map((d) => {
          const key = iso(d);
          const cls = [
            styles.day,
            d.getMonth() !== month.getMonth() && styles.out,
            (d.getDay() === 5 || d.getDay() === 6) && styles.weekend,
            key === SAMPLE_TODAY && styles.today,
            runs.has(key) && styles.run,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={key} className={cls} aria-current={key === SAMPLE_TODAY ? 'date' : undefined}>
              {d.getDate()}
            </div>
          );
        })}
      </div>
      <div className={styles.calFoot}>
        <strong>{t('fiori.today')}</strong>
        {todayRuns.map((r) => (
          <div key={r.key} className={styles.ev}>
            <span className={styles.evTime}>{r.time}</span>
            <span>{t(`page.home.ovp.schedule.${r.key}`)}</span>
          </div>
        ))}
      </div>
    </OvpCard>
  );
}
