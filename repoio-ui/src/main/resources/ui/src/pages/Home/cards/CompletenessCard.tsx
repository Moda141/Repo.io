import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart, { CHART_PALETTE } from '@/components/common/EChart';
import { ObjectStatus, OvpCard, intlLocale } from '@/components/common/Fiori';
import { completeness } from '../homeSampleData';
import styles from './cards.module.css';

/** SAP "Analytical card": KPI header + stacked column chart. */
export default function CompletenessCard() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';
  const deviation = completeness.value - completeness.target;
  const period = new Intl.DateTimeFormat(intlLocale(i18n.language), { month: 'long', year: 'numeric' }).format(
    new Date(`${completeness.period}-01T00:00:00`)
  );

  const option: EChartsOption = useMemo(() => {
    const weeks = completeness.weeks.map((w) => t('page.home.ovp.completeness.week', { n: w.week }));
    const totals = completeness.weeks.map((w) => w.valid + w.issues);
    const axisColor = '#556B82';
    return {
      grid: { left: rtl ? 8 : 40, right: rtl ? 40 : 8, top: 24, bottom: 24 },
      legend: { show: false },
      xAxis: {
        type: 'category',
        data: weeks,
        inverse: rtl,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#A9B4BE' } },
        axisLabel: { color: '#1D2D3E', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        max: 50000,
        interval: 10000,
        position: rtl ? 'right' : 'left',
        splitLine: { lineStyle: { color: '#E5E8EB' } },
        axisLabel: { color: axisColor, fontSize: 10, formatter: (v: number) => (v ? `${v / 1000}K` : '0') },
      },
      series: [
        {
          name: t('page.home.ovp.completeness.valid'),
          type: 'bar',
          stack: 'records',
          barWidth: 30,
          itemStyle: { color: CHART_PALETTE[0] },
          data: completeness.weeks.map((w) => w.valid),
        },
        {
          name: t('page.home.ovp.completeness.issues'),
          type: 'bar',
          stack: 'records',
          barWidth: 30,
          itemStyle: { color: CHART_PALETTE[1] },
          label: {
            show: true,
            position: 'top',
            fontSize: 10,
            color: '#1D2D3E',
            formatter: (p) => totals[p.dataIndex].toLocaleString('en-US'),
          },
          data: completeness.weeks.map((w) => w.issues),
        },
      ],
    };
  }, [t, rtl]);

  return (
    <OvpCard
      title={t('page.home.ovp.completeness.title')}
      subtitle={t('page.home.ovp.completeness.subtitle')}
      counter={t('fiori.of', { shown: 4, total: 12 })}
      onMore={() => undefined}>
      <div className={`${styles.body} ${styles.bodyFlush}`}>
        <ObjectStatus state="critical" inverted>
          {t('page.home.ovp.completeness.below_target')}
        </ObjectStatus>
        <div className={styles.kpi}>
          <div className={styles.kpiValue}>
            {completeness.value.toFixed(1)}
            <span className={styles.kpiUnit}>%</span>
          </div>
          <div className={styles.kpiSide}>
            <span className={styles.kpiLabel}>{t('page.home.ovp.completeness.target')}</span>
            <span className={styles.kpiLabel}>{t('page.home.ovp.completeness.deviation')}</span>
            <span>{completeness.target}%</span>
            <span><bdi dir="ltr">{deviation.toFixed(1).replace('-', '−')}</bdi></span>
          </div>
        </div>
        <div className={styles.period}>{period}</div>
      </div>
      <div className={styles.chartTitle}>{t('page.home.ovp.completeness.chart_title')}</div>
      <div className={styles.body} role="img" aria-label={t('page.home.ovp.completeness.chart_label')}>
        <EChart option={option} height={220} />
        <Legend />
      </div>
    </OvpCard>
  );
}

function Legend() {
  const { t } = useTranslation();
  const item = (color: string, label: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <i style={{ width: 12, height: 12, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
  return (
    <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
      {item(CHART_PALETTE[0], t('page.home.ovp.completeness.valid'))}
      {item(CHART_PALETTE[1], t('page.home.ovp.completeness.issues'))}
    </div>
  );
}
