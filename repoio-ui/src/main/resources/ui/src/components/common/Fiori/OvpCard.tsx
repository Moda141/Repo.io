import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CardActionsButton, dragHandleProps, useCardActions } from './OvpLayout';
import styles from './OvpCard.module.css';

export interface OvpCardProps {
  title: string;
  subtitle?: string;
  /** e.g. "6 of 12" — the visible items out of the total. */
  counter?: string;
  /** Renders the "…" overflow button when provided. */
  onMore?: () => void;
  /** Extra header content under the title (KPI header, tags). */
  children: ReactNode;
  className?: string;
  /** Numeric card layout: a side column with the big number. */
  side?: ReactNode;
}

/**
 * OvpCard — SAP Fiori Horizon Overview Page card shell.
 *
 * Reference: design-reference/sap-s4hana/01-overview-page.svg
 * Header: title (bold 14px), subtitle (label color), counter ("6 of 12") and
 * an overflow "…" button at the end edge. Cards sit in a masonry column grid
 * (see OvpGrid) and size to their content.
 */
export default function OvpCard({ title, subtitle, counter, onMore, children, className, side }: OvpCardProps) {
  const { t } = useTranslation();
  const personalizable = !!useCardActions();
  const header = (
    <div className={styles.header} {...dragHandleProps}>
      <div className={styles.headerText}>
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>
      {(onMore || counter || personalizable) && (
        <div className={styles.headerSide}>
          {personalizable ? (
            <CardActionsButton />
          ) : (
            onMore && (
              <button className={styles.more} onClick={onMore} aria-label={t('fiori.more_options', 'More options')}>
                <OverflowIcon />
              </button>
            )
          )}
          {counter && <span className={styles.counter}>{counter}</span>}
        </div>
      )}
    </div>
  );

  if (side) {
    return (
      <article className={`${styles.card} ${styles.withSide} ${className ?? ''}`}>
        <div className={styles.main}>
          {header}
          {children}
        </div>
        <div className={styles.side}>{side}</div>
      </article>
    );
  }

  return (
    <article className={`${styles.card} ${className ?? ''}`}>
      {header}
      {children}
    </article>
  );
}

export function OverflowIcon() {
  return (
    <svg width="16" height="4" viewBox="0 0 16 4" aria-hidden="true">
      <circle cx="2" cy="2" r="1.6" fill="currentColor" />
      <circle cx="8" cy="2" r="1.6" fill="currentColor" />
      <circle cx="14" cy="2" r="1.6" fill="currentColor" />
    </svg>
  );
}

/** Masonry column container for OvpCards. */
export function OvpGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
