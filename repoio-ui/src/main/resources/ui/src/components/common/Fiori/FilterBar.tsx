import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import P13nDialog from './P13nDialog';
import styles from './FilterBar.module.css';

export interface FilterField {
  key: string;
  label: string;
  type: 'search' | 'select';
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Shown by default (Adapt Filters can change it). */
  visible?: boolean;
}

export type FilterValues = Record<string, string>;

interface Props {
  fields: FilterField[];
  /** Called with the applied values when the user presses Go. */
  onGo: (values: FilterValues) => void;
}

/**
 * FilterBar — SAP Filter Bar (filter-bar.svg): label above each field,
 * emphasized Go and "Adapt Filters (n)" at the end. Filters apply on Go.
 * Lives inside DynamicPageHeader so it hides when the header collapses.
 */
export default function FilterBar({ fields, onGo }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<FilterValues>({});
  const [visible, setVisible] = useState<string[]>(fields.filter((f) => f.visible !== false).map((f) => f.key));
  const [adaptOpen, setAdaptOpen] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const applied: FilterValues = {};
    for (const key of visible) {
      const v = draft[key]?.trim();
      if (v) applied[key] = v;
    }
    onGo(applied);
  }

  const shown = fields.filter((f) => visible.includes(f.key));

  return (
    <>
      <form className={styles.bar} role="search" aria-label={t('fiori.filters.label')} onSubmit={submit}>
        {shown.map((f) => (
          <div key={f.key} className={styles.field}>
            <label htmlFor={`filter-${f.key}`}>{f.type === 'search' ? f.label : `${f.label}:`}</label>
            {f.type === 'search' ? (
              <input
                id={`filter-${f.key}`}
                value={draft[f.key] ?? ''}
                placeholder={f.placeholder}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
            ) : (
              <select
                id={`filter-${f.key}`}
                value={draft[f.key] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}>
                <option value="">{t('fiori.filters.all')}</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
        <div className={styles.actions}>
          <button type="submit" className={styles.go}>
            {t('fiori.filters.go')}
          </button>
          <button type="button" className={styles.adapt} aria-haspopup="dialog" onClick={() => setAdaptOpen(true)}>
            {t('fiori.filters.adapt', { count: shown.length })}
          </button>
        </div>
      </form>
      <P13nDialog
        open={adaptOpen}
        title={t('fiori.filters.adapt_title')}
        description={t('fiori.filters.adapt_hint')}
        items={fields.map((f) => ({ id: f.key, title: f.label, visible: visible.includes(f.key) }))}
        defaults={fields.map((f) => ({ id: f.key, title: f.label, visible: f.visible !== false }))}
        onCancel={() => setAdaptOpen(false)}
        onOk={(items) => {
          setVisible(items.filter((i) => i.visible).map((i) => i.id));
          setAdaptOpen(false);
        }}
      />
    </>
  );
}

/** "No filters active" / "2 filters active: Source, Status" for the header. */
export function useActiveFiltersText(fields: FilterField[], values: FilterValues): string {
  const { t } = useTranslation();
  const active = fields.filter((f) => values[f.key]);
  if (active.length === 0) return t('fiori.filters.none_active');
  const names = active.map((f) => f.label).join(t('fiori.filters.sep'));
  return active.length === 1
    ? t('fiori.filters.active_one', { names })
    : t('fiori.filters.active_other', { count: active.length, names });
}
