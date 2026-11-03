import type { ThemeConfig } from 'antd';
import enUS from 'antd/locale/en_US';
import arEG from 'antd/locale/ar_EG';
import type { Locale } from 'antd/es/locale';

/**
 * Antd design tokens — SAP Fiori Horizon (light, Compact density).
 * Values come from design-reference/sap-s4hana and must match
 * styles/tokens.css. Change both together.
 */
export const tokens = {
  // Brand
  colorPrimary: '#0070F2',
  colorPrimaryHover: '#0064D9',
  colorSuccess: '#30914C',
  colorWarning: '#E76500',
  colorError: '#F53232',
  colorInfo: '#0070F2',
  colorLink: '#0064D9',

  // Surfaces
  colorBgLayout: '#F5F6F7',
  colorBgContainer: '#FFFFFF',
  colorBgElevated: '#FFFFFF',
  colorBorder: '#BCC3CA',
  colorBorderSecondary: '#E5E5E5',

  // Text
  colorText: '#131E29',
  colorTextSecondary: '#556B82',
  colorTextTertiary: '#758CA4',
  colorTextDisabled: '#8396A8',

  // Sidebar (icon rail)
  sidebarWidth: 84,
  sidebarBg: '#0C111D',
  sidebarItemActive: '#0070F2',
  sidebarItemText: '#D0D5DD',
  sidebarItemTextActive: '#FFFFFF',

  // Top bar — matches OpenMetadata @layout-header-height / padding
  headerHeight: 80,
  headerBg: '#FFFFFF',
  headerBorder: '#EAECF0',

  // Shape
  borderRadius: 8, // buttons, menus (Horizon)
  borderRadiusLG: 16, // cards
  borderRadiusSM: 4, // input fields

  // Type
  fontFamily:
    '"72", "72full", "IBM Plex Sans Arabic", Arial, Helvetica, sans-serif',
  fontFamilyCode:
    '"JetBrains Mono", Menlo, Monaco, Consolas, "Courier New", monospace',

  // Density — Compact (26px) is the desktop default; LG = Cozy (36px)
  controlHeight: 26,
  controlHeightLG: 36,
  controlHeightSM: 22,
};

export const repoioTheme: ThemeConfig = {
  cssVar: true,
  hashed: false,
  token: {
    colorPrimary: tokens.colorPrimary,
    colorInfo: tokens.colorInfo,
    colorLink: tokens.colorLink,
    colorPrimaryHover: tokens.colorPrimaryHover,
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
