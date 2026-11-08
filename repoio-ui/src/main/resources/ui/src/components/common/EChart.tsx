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

/** SAP Horizon ordered chart colors (design-reference/sap-s4hana). */
export const CHART_PALETTE = [
  '#0070F2', // sapChart_OrderedColor_1
  '#C87B00', // sapChart_OrderedColor_2
  '#30914C', // positive
  '#7858FF', // indication / brand violet
  '#E76500', // critical
  '#AA0808', // negative
];
const PALETTE = CHART_PALETTE;

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
          '"72", "IBM Plex Sans Arabic", Arial, Helvetica, sans-serif',
      },
      grid: { left: 40, right: 16, top: 32, bottom: 32 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#131E29',
        borderColor: '#131E29',
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
