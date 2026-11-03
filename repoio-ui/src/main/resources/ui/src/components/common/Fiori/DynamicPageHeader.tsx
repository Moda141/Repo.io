import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DynamicPageHeader.module.css';

interface Props {
  /** Variant name, e.g. "Standard". */
  variant: string;
  /** Line under the variant, e.g. "No filters active". */
  subtitle?: string;
  /** Extra chips next to the subtitle (e.g. "Sample data"). */
  badges?: ReactNode;
  /** End-edge actions (share, export…). */
  actions?: ReactNode;
}

/**
 * DynamicPageHeader — Fiori variant-management header with the collapse
 * handle centred on its bottom edge.
 *
 * Reference: design-reference/sap-s4hana/01-overview-page.svg
 * ("Standard ▾ / No filters active" + chevron handle).
 */
export default function DynamicPageHeader({ variant, subtitle, badges, actions }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <section className={`${styles.header} ${open ? '' : styles.closed}`}>
      {open && (
        <div className={styles.inner}>
          <div>
            <button className={styles.variant} type="button">
              {variant}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
            {(subtitle || badges) && (
              <div className={styles.sub}>
                {subtitle && <span>{subtitle}</span>}
                {badges}
              </div>
            )}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      <button
        className={styles.handle}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t('fiori.collapse_header', 'Collapse header') : t('fiori.expand_header', 'Expand header')}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
    </section>
  );
}
