import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './P13nDialog.module.css';

export interface P13nItem {
  id: string;
  title: string;
  visible: boolean;
}

interface Props {
  open: boolean;
  title: string;
  description?: string;
  items: P13nItem[];
  /** Show ▲ / ▼ buttons to reorder rows. */
  reorderable?: boolean;
  /** Items to restore when the user presses Reset. */
  defaults: P13nItem[];
  onOk: (items: P13nItem[]) => void;
  onCancel: () => void;
}

/**
 * P13nDialog — SAP personalization dialog (dialogs.svg, "Personalization
 * Popup"): a checkbox per row, optional reorder buttons, Reset at the start
 * of the footer, emphasized OK and transparent Cancel at the end.
 */
export default function P13nDialog({ open, title, description, items, reorderable, defaults, onOk, onCancel }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<P13nItem[]>(items);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement as HTMLElement;
      setDraft(items);
      requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('input')?.focus());
    } else {
      openerRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function move(i: number, d: -1 | 1) {
    setDraft((list) => {
      const next = [...list];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  }

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="p13n-title">
        <div className={styles.header} id="p13n-title">{title}</div>
        {description && <div className={styles.description}>{description}</div>}
        <div className={styles.body}>
          {draft.map((item, i) => (
            <div key={item.id} className={styles.row}>
              <input
                type="checkbox"
                id={`p13n-${item.id}`}
                checked={item.visible}
                onChange={(e) =>
                  setDraft((list) => list.map((x) => (x.id === item.id ? { ...x, visible: e.target.checked } : x)))
                }
              />
              <label htmlFor={`p13n-${item.id}`}>{item.title}</label>
              {reorderable && (
                <span className={styles.move}>
                  <button
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={t('fiori.dialog.move_up_item', { name: item.title })}>
                    ▲
                  </button>
                  <button
                    disabled={i === draft.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={t('fiori.dialog.move_down_item', { name: item.title })}>
                    ▼
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
        <div className={styles.footer}>
          <button className={styles.transparent} onClick={() => setDraft(defaults)}>
            {t('fiori.dialog.reset')}
          </button>
          <span className={styles.grow} />
          <button className={styles.emphasized} onClick={() => onOk(draft)}>
            {t('fiori.dialog.ok')}
          </button>
          <button className={styles.transparent} onClick={onCancel}>
            {t('fiori.dialog.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
