import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { OverflowIcon } from './OvpCard';
import styles from './OvpLayout.module.css';

/**
 * Overview Page card personalization.
 *
 *   useCardLayout   — order + hidden cards, persisted per browser for now.
 *                     TODO: move to the user's saved view (Variant
 *                     Management) when the backend endpoint exists.
 *   PersonalizableOvpGrid — masonry grid; drag a card by its header.
 *   CardActionsButton     — the card "…" menu: hide, move earlier / later.
 */

export interface CardLayout {
  order: string[];
  hidden: string[];
}

export function useCardLayout(storageKey: string, defaultIds: string[]) {
  const [layout, setLayout] = useState<CardLayout>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as CardLayout | null;
      if (saved && Array.isArray(saved.order)) {
        const order = saved.order.filter((id) => defaultIds.includes(id));
        return {
          order: [...order, ...defaultIds.filter((id) => !order.includes(id))],
          hidden: (saved.hidden ?? []).filter((id) => defaultIds.includes(id)),
        };
      }
    } catch {
      /* ignore */
    }
    return { order: defaultIds, hidden: [] };
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch {
      /* storage unavailable */
    }
  }, [storageKey, layout]);

  const visible = layout.order.filter((id) => !layout.hidden.includes(id));

  return {
    layout,
    visible,
    setLayout,
    hide: (id: string) => setLayout((l) => ({ ...l, hidden: [...l.hidden, id] })),
    show: (id: string) => setLayout((l) => ({ ...l, hidden: l.hidden.filter((x) => x !== id) })),
    /** Move a visible card one step among visible cards. */
    move: (id: string, delta: -1 | 1) =>
      setLayout((l) => {
        const vis = l.order.filter((x) => !l.hidden.includes(x));
        const i = vis.indexOf(id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= vis.length) return l;
        const order = [...l.order];
        const a = order.indexOf(vis[i]);
        const b = order.indexOf(vis[j]);
        [order[a], order[b]] = [order[b], order[a]];
        return { ...l, order };
      }),
    /** Put the visible cards in this order; hidden cards keep their place at the end. */
    setVisibleOrder: (ids: string[]) =>
      setLayout((l) => ({ ...l, order: [...ids, ...l.order.filter((x) => !ids.includes(x))] })),
    reset: () => setLayout({ order: defaultIds, hidden: [] }),
  };
}

interface CardActions {
  id: string;
  title: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onHide: () => void;
  onMove: (delta: -1 | 1) => void;
}

const CardActionsContext = createContext<CardActions | null>(null);
export const useCardActions = () => useContext(CardActionsContext);

/** Marks an element as the drag handle of its card. Spread onto the header. */
export const dragHandleProps = { 'data-ovp-drag-handle': '' } as const;

export interface PersonalizableCard {
  id: string;
  title: string;
  node: ReactNode;
}

interface GridProps {
  cards: PersonalizableCard[];
  onReorder: (ids: string[]) => void;
  onHide: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  empty: ReactNode;
}

export function PersonalizableOvpGrid({ cards, onReorder, onHide, onMove, empty }: GridProps) {
  const [ids, setIds] = useState(cards.map((c) => c.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const armed = useRef<string | null>(null);

  // Follow the parent's order whenever we are not mid-drag.
  const cardKey = cards.map((c) => c.id).join('|');
  useEffect(() => {
    if (!dragId) setIds(cards.map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey]);

  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
  if (cards.length === 0) return <>{empty}</>;

  return (
    <div className={styles.grid}>
      {ids
        .filter((id) => byId[id])
        .map((id, i, list) => (
          <div
            key={id}
            className={`${styles.slot} ${dragId === id ? styles.dragging : ''} ${overId === id ? styles.over : ''}`}
            draggable={armed.current === id || dragId === id}
            onPointerDown={(e) => {
              const target = e.target as HTMLElement;
              const onHandle = target.closest('[data-ovp-drag-handle]');
              const onControl = target.closest('button, a, input, select, label');
              armed.current = onHandle && !onControl ? id : null;
              e.currentTarget.draggable = armed.current === id;
            }}
            onDragStart={(e) => {
              if (armed.current !== id) {
                e.preventDefault();
                return;
              }
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', id);
              setDragId(id);
            }}
            onDragOver={(e) => {
              if (!dragId || dragId === id) return;
              e.preventDefault();
              setOverId(id);
              const r = e.currentTarget.getBoundingClientRect();
              const before = e.clientY < r.top + r.height / 2;
              setIds((cur) => {
                const next = cur.filter((x) => x !== dragId);
                const at = next.indexOf(id) + (before ? 0 : 1);
                next.splice(at, 0, dragId);
                return next.join('|') === cur.join('|') ? cur : next;
              });
            }}
            onDragEnd={() => {
              armed.current = null;
              setDragId(null);
              setOverId(null);
              onReorder(ids.filter((x) => byId[x]));
            }}>
            <CardActionsContext.Provider
              value={{
                id,
                title: byId[id].title,
                canMoveUp: i > 0,
                canMoveDown: i < list.length - 1,
                onHide: () => onHide(id),
                onMove: (d) => onMove(id, d),
              }}>
              {byId[id].node}
            </CardActionsContext.Provider>
          </div>
        ))}
    </div>
  );
}

/** The card "…" button and its menu. Renders nothing outside a personalizable grid. */
export function CardActionsButton({ className, fallback }: { className?: string; fallback?: () => void }) {
  const { t } = useTranslation();
  const actions = useCardActions();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setPos(null), []);
  useEffect(() => {
    if (!pos) return;
    menuRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        btnRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pos, close]);

  if (!actions) {
    return fallback ? (
      <button className={`${styles.more} ${className ?? ''}`} onClick={fallback} aria-label={t('fiori.more_options')}>
        <OverflowIcon />
      </button>
    ) : null;
  }

  function toggle() {
    if (pos) return close();
    const r = btnRef.current!.getBoundingClientRect();
    const width = 192;
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(window.innerWidth - width - 8, r.left)) });
  }

  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <>
      <button
        ref={btnRef}
        className={`${styles.more} ${className ?? ''}`}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        aria-label={t('fiori.cards.card_options', { title: actions.title })}>
        <OverflowIcon />
      </button>
      {pos &&
        createPortal(
          <div ref={menuRef} className={styles.menu} role="menu" style={{ top: pos.top, left: pos.left }}>
            <button role="menuitem" onClick={run(actions.onHide)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3 3.4M6.6 6.6A17 17 0 0 0 3 12s4 6 9 6a9 9 0 0 0 4-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {t('fiori.cards.hide')}
            </button>
            <button role="menuitem" disabled={!actions.canMoveUp} onClick={run(() => actions.onMove(-1))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {t('fiori.cards.move_up')}
            </button>
            <button role="menuitem" disabled={!actions.canMoveDown} onClick={run(() => actions.onMove(1))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {t('fiori.cards.move_down')}
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

/** Message toast with an optional Undo action (auto-hides after 5s). */
export function UndoToast({ text, onUndo, onDone }: { text: string; onUndo?: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    const id = setTimeout(onDone, 5000);
    return () => clearTimeout(id);
  }, [text, onDone]);
  return createPortal(
    <div className={styles.toast} role="status">
      <span>{text}</span>
      {onUndo && (
        <button
          onClick={() => {
            onUndo();
            onDone();
          }}>
          {t('fiori.cards.undo')}
        </button>
      )}
    </div>,
    document.body
  );
}
