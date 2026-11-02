import type { ThemeConfig } from 'antd';
import enUS from 'antd/locale/en_US';
import arEG from 'antd/locale/ar_EG';
import type { Locale } from 'antd/es/locale';

/**
 * Design tokens — mirror OpenMetadata's palette with a slight Repo.io tilt.
 * Keep the primary blue identical so OpenMetadata-ported components look
 * at home; swap it later if the brand drifts.
 */
export const tokens = {
  // Brand
  colorPrimary: '#1570EF',
  colorPrimaryHover: '#1366D9',
  colorSuccess: '#12B76A',
  colorWarning: '#F79009',
  colorError: '#F04438',
  colorInfo: '#1570EF',

  // Surfaces
  colorBgLayout: '#F8F9FC',
  colorBgContainer: '#FFFFFF',
  colorBgElevated: '#FFFFFF',
  colorBorder: '#E4E7EC',
  colorBorderSecondary: '#EAECF0',

  // Text
  colorText: '#101828',
  colorTextSecondary: '#475467',
  colorTextTertiary: '#667085',
  colorTextDisabled: '#98A2B3',

  // Sidebar (icon rail)
  sidebarWidth: 84,
  sidebarBg: '#0C111D',
  sidebarItemActive: '#1570EF',
  sidebarItemText: '#D0D5DD',
  sidebarItemTextActive: '#FFFFFF',

  // Top bar — matches OpenMetadata @layout-header-height / padding
  headerHeight: 80,
  headerBg: '#FFFFFF',
  headerBorder: '#EAECF0',

  // Shape
  borderRadius: 8,
  borderRadiusLG: 12,
  borderRadiusSM: 6,

  // Type
  fontFamily:
    'Inter, "IBM Plex Sans Arabic", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif',
  fontFamilyCode:
    '"JetBrains Mono", Menlo, Monaco, Consolas, "Courier New", monospace',

  // Density
  controlHeight: 36,
  controlHeightLG: 40,
  controlHeightSM: 28,
};

export const repoioTheme: ThemeConfig = {
  cssVar: true,
  hashed: false,
  token: {
    colorPrimary: tokens.colorPrimary,
    colorInfo: tokens.colorInfo,
    colorSuccess: tokens.colorSuccess,
    colorWarning: tokens.colorWarning,
    colorError: tokens.colorError,
    colorBgLayout: tokens.colorBgLayout,
    colorBgContainer: tokens.colorBgContainer,
    colorBgElevated: tokens.colorBgElevated,
    colorBorder: tokens.colorBorder,
    colorBorderSecondary: tokens.colorBorderSecondary,
    colorText: tokens.colorText,
    colorTextSecondary: tokens.colorTextSecondary,
    colorTextTertiary: tokens.colorTextTertiary,
    colorTextDisabled: tokens.colorTextDisabled,
    borderRadius: tokens.borderRadius,
    borderRadiusLG: tokens.borderRadiusLG,
    borderRadiusSM: tokens.borderRadiusSM,
    fontFamily: tokens.fontFamily,
    fontFamilyCode: tokens.fontFamilyCode,
    controlHeight: tokens.controlHeight,
    controlHeightLG: tokens.controlHeightLG,
    controlHeightSM: tokens.controlHeightSM,
  },
  components: {
    Layout: {
      bodyBg: tokens.colorBgLayout,
      headerBg: tokens.headerBg,
      headerHeight: tokens.headerHeight,
      headerPadding: '0 24px',
      siderBg: tokens.sidebarBg,
    },
    Menu: {
      darkItemBg: tokens.sidebarBg,
      darkItemSelectedBg: tokens.sidebarItemActive,
      darkItemColor: tokens.sidebarItemText,
      darkItemSelectedColor: tokens.sidebarItemTextActive,
      darkItemHoverBg: 'rgba(255, 255, 255, 0.06)',
      iconSize: 20,
    },
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
      fontWeight: 500,
    },
    Table: {
      headerBg: '#F9FAFB',
      headerColor: tokens.colorTextSecondary,
      rowHoverBg: '#F9FAFB',
      borderColor: tokens.colorBorderSecondary,
    },
    Card: {
      headerBg: 'transparent',
      headerFontSize: 16,
      headerFontSizeSM: 14,
    },
    Tabs: {
      inkBarColor: tokens.colorPrimary,
      itemSelectedColor: tokens.colorPrimary,
      itemHoverColor: tokens.colorPrimaryHover,
      itemActiveColor: tokens.colorPrimary,
    },
    Tag: {
      defaultBg: '#F2F4F7',
      defaultColor: tokens.colorTextSecondary,
    },
  },
};

export function antdLocaleFor(lang: string): Locale {
  if (lang?.toLowerCase().startsWith('ar')) return arEG;
  return enUS;
}
