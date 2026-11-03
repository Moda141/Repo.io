export { default as OvpCard, OvpGrid, OverflowIcon } from './OvpCard';
export type { OvpCardProps } from './OvpCard';
export { default as ObjectStatus, STATE_COLOR, IndicationText } from './ObjectStatus';
export type { ValueState } from './ObjectStatus';
export { default as DynamicPageHeader } from './DynamicPageHeader';

/** Intl locale for dates/numbers: Arabic text with Western digits, matching the SAP reference. */
export function intlLocale(language: string): string {
  return language.startsWith('ar') ? `${language}-u-nu-latn` : language;
}
