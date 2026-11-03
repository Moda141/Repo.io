import type { ReactNode } from 'react';
import styles from './ObjectStatus.module.css';

export type ValueState = 'positive' | 'critical' | 'negative' | 'information' | 'neutral';

const ICONS: Record<ValueState, ReactNode> = {
  information: (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M12 11v6M12 7.5h.01" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  ),
  neutral: null,
  positive: (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M7 12l3.5 3.5L17 9" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  ),
  critical: (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2L1 21h22L12 2z" fill="currentColor" />
      <path d="M12 9v5M12 17.5h.01" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  negative: (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
};

/** Glyph-only icons for the solid (inverted) tag. */
const INVERTED_ICONS: Record<ValueState, ReactNode> = {
  information: (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 10v9M12 4.5h.01" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  ),
  neutral: null,
  positive: (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  ),
  critical: (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10M12 19.5h.01" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  ),
  negative: (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
};

interface Props {
  state: ValueState;
  children: ReactNode;
  /** Inverted = solid tag ("✓ Tag" in the SAP reference). */
  inverted?: boolean;
}

/**
 * ObjectStatus — Fiori status: icon in the element color, text in the darker
 * text color; or a solid tag when inverted.
 * Reference: design-reference/sap-s4hana/components/object-status.svg
 */
export default function ObjectStatus({ state, children, inverted }: Props) {
  const icon = inverted ? INVERTED_ICONS[state] : ICONS[state];
  return (
    <span className={`${styles.status} ${styles[state]} ${inverted ? styles.inverted : ''}`}>
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
    </span>
  );
}

/** Indication colors 1–8 for non-semantic categories (e.g. domains). */
export function IndicationText({ color, children }: { color: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; children: ReactNode }) {
  return <span style={{ color: `var(--sapIndicationColor_${color})` }}>{children}</span>;
}

export const STATE_COLOR: Record<ValueState, string> = {
  positive: 'var(--sapPositiveElementColor)',
  critical: 'var(--sapCriticalElementColor)',
  negative: 'var(--sapNegativeElementColor)',
  information: 'var(--sapInformativeElementColor)',
  neutral: 'var(--sapNeutralElementColor)',
};
