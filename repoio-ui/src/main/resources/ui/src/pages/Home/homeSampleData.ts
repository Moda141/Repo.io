/**
 * Sample data for the Home overview page.
 *
 * These are illustrative values, not governed KPI results. The page shows a
 * "Sample data" badge while this file is the source. Replace each export with
 * a REST call (src/rest/) as the matching backend endpoint lands, then remove
 * the badge.
 */
import type { ValueState } from '@/components/common/Fiori';

export const completeness = {
  value: 87.3,
  target: 95,
  /** ISO month the KPI covers. */
  period: '2026-10',
  weeks: [
    { week: 41, valid: 28400, issues: 11900 },
    { week: 42, valid: 20100, issues: 9800 },
    { week: 43, valid: 24000, issues: 9200 },
    { week: 44, valid: 26800, issues: 4100 },
  ],
};

export const openReviews = { open: 20, total: 42 };

export type ChangeRequestKind = 'tax_id' | 'new_customer' | 'merge' | 'reclassify';

export interface ChangeRequest {
  id: string;
  kind: ChangeRequestKind;
  customer: string;
  fields: number;
  domain: 'customers';
  source: string;
  completeness: number;
  state: ValueState;
  stateKey: 'missing_data' | 'needs_review' | 'ready';
}

export const changeRequests: ChangeRequest[] = [
  { id: 'CR-1000352', kind: 'tax_id', customer: 'مكتبة الأجيال', fields: 12, domain: 'customers', source: 'SAP C4C', completeness: 30, state: 'negative', stateKey: 'missing_data' },
  { id: 'CR-1000361', kind: 'new_customer', customer: 'دار المعرفة للنشر', fields: 18, domain: 'customers', source: 'manual', completeness: 55, state: 'critical', stateKey: 'needs_review' },
  { id: 'CR-1000378', kind: 'merge', customer: 'الشركة العربية للتوزيع', fields: 24, domain: 'customers', source: 'ERP', completeness: 92, state: 'positive', stateKey: 'ready' },
  { id: 'CR-1000384', kind: 'reclassify', customer: 'مكتبة النيل', fields: 6, domain: 'customers', source: 'CSV', completeness: 100, state: 'positive', stateKey: 'ready' },
];
export const changeRequestsTotal = 6;

export interface MergeCandidate {
  customer: string;
  source: string;
  /** ISO date */
  detected: string;
  score: number;
}

export const mergeCandidates: MergeCandidate[] = [
  { customer: 'مكتبة الأجيال الجديدة', source: 'C4C', detected: '2026-11-01', score: 96 },
  { customer: 'دار المعرفة للنشر', source: 'C4C', detected: '2026-11-01', score: 91 },
  { customer: 'الشركة العربية للتوزيع', source: 'ERP', detected: '2026-10-31', score: 88 },
  { customer: 'مؤسسة الفكر العربي', source: 'C4C', detected: '2026-10-30', score: 82 },
  { customer: 'مكتبة النيل', source: 'CSV', detected: '2026-10-29', score: 77 },
  { customer: 'شبكة القاهرة التعليمية', source: 'ERP', detected: '2026-10-28', score: 71 },
  { customer: 'دار الشروق للتوزيع', source: 'C4C', detected: '2026-10-27', score: 68 },
  { customer: 'مكتبة الإسكندرية الحديثة', source: 'CSV', detected: '2026-10-26', score: 64 },
];
export const mergeCandidatesTotal = 20;

export interface StewardNote {
  initials: string;
  nameKey: 'sara' | 'karim';
  /** ISO timestamp */
  at: string;
}

export const stewardNotes: StewardNote[] = [
  { initials: 'SA', nameKey: 'sara', at: '2026-11-03T11:40:00' },
  { initials: 'KF', nameKey: 'karim', at: '2026-11-02T16:15:00' },
];

export const domainOwner = {
  initials: 'MM',
  email: 'mdm-team@example.com',
  source: 'SAP C4C — Customer Master',
  /** ISO date */
  lastReview: '2026-10-20',
};

/** Days (ISO) with scheduled source syncs, shown as dots on the calendar. */
export const scheduledRunDays = [
  '2026-11-03', '2026-11-05', '2026-11-10', '2026-11-12',
  '2026-11-17', '2026-11-19', '2026-11-24', '2026-11-26',
];

export const todayRuns = [
  { time: '02:00', key: 'sync_c4c' },
  { time: '06:00', key: 'nightly_quality' },
] as const;

/** Fixed "today" for the sample calendar so screenshots stay stable. */
export const SAMPLE_TODAY = '2026-11-03';
