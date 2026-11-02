import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useMemo } from 'react';

/**
 * EChart — thin wrapper around echarts-for-react with Repo.io defaults.
 *
 * Mirrors the pattern OpenMetadata uses in
 * openmetadata-ui/src/components/common/Chart: a single wrapper that
 * injects the brand palette + font + grid defaults so every chart
 * reads as part of the same system.
 */

const PALETTE = [
  '#1570EF', // primary
  '#6938EF', // violet
  '#12B76A', // success
  '#F79009', // warn
  '#F04438', // error
  '#06AED4', // cyan
];

interface Props {
  option: EChartsOption;
  height?: number | string;
  loading?: boolean;
}

export default function EChart({ option, height = 280, loading }: Props) {
  const merged: EChartsOption = useMemo(
    () => ({
      color: PALETTE,
      textStyle: {
        fontFamily:
          'Inter, "IBM Plex Sans Arabic", -apple-system, system-ui, sans-serif',
      },
      grid: { left: 40, right: 16, top: 32, bottom: 32 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#101828',
        borderColor: '#101828',
        textStyle: { color: '#FFFFFF', fontSize: 12 },
      },
      ...option,
    }),
    [option]
  );

  return (
    <ReactECharts
      option={merged}
      showLoading={loading}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  );
}
