import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/constants/routes';
import { DEFAULT_PINNED, MAIN_SECTIONS, SPACES, type MainItem } from './navigationConfig';
import styles from './NavigationMenu.module.css';

/**
 * NavigationMenu — SAP Fiori Navigation Menu, Compact.
 *
 * Reference: design-reference/sap-s4hana/components/navigation-menu.svg
 * (Compact · Main Menu and All Spaces). A 288px popover under the shell bar
 * ☰ button. It overlays the page and closes on outside click, Escape, or
 * navigation. Content lives in navigationConfig.ts.
 */

const PIN_KEY = 'repoio-nav-pinned';

const Svg = ({ children, size = 16 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {children}
  </svg>
);
const s = { stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const Icon = {
  home: <Svg><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" {...s} /></Svg>,
  folder: (
    <Svg>
      <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" {...s} />
      <path d="M7 12h10M7 15h6" {...s} />
    </Svg>
  ),
  spaces: (
    <Svg>
      <rect x="7" y="7" width="13" height="13" rx="2" {...s} />
      <path d="M4 16V5a1 1 0 0 1 1-1h11" {...s} />
    </Svg>
  ),
  settings: (
    <Svg>
      <circle cx="12" cy="12" r="3" {...s} />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" {...s} />
    </Svg>
  ),
  search: (
    <Svg size={14}>
      <circle cx="11" cy="11" r="7" {...s} />
      <path d="M20 20l-4-4" {...s} />
    </Svg>
  ),
  pin: <Svg><path d="M14 3l7 7-3 1-4 4 1 4-1 1-4-4-5 5M8 11l5-5" {...s} /></Svg>,
  pinOn: (
    <Svg>
      <path d="M14 3l7 7-3 1-4 4 1 4-1 1-9-9 1-1 4 1 4-4z" fill="currentColor" />
      <path d="M8 16l-5 5" {...s} />
    </Svg>
  ),
  chevronDown: (
    <svg className={styles.chevDown} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  chevronNext: (
    <svg className={styles.chevNext} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  back: (
    <svg className={styles.chevBack} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

function readPinned(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(PIN_KEY) ?? 'null');
    return Array.isArray(v) ? v : DEFAULT_PINNED;
  } catch {
    return DEFAULT_PINNED;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Element that toggles the menu; clicks on it are not "outside". */
  anchorRef: React.RefObject<HTMLElement>;
}

export default function NavigationMenu({ open, onClose, anchorRef }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const location = useLocation();
  const [level, setLevel] = useState<'main' | 'spaces'>('main');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ favorites: true, my_spaces: true });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ entities: true });
  const [openSpace, setOpenSpace] = useState<string | null>('mdm');
  const [query, setQuery] = useState('');
  const [pinned, setPinned] = useState<string[]>(readPinned);

  useEffect(() => {
    try {
      localStorage.setItem(PIN_KEY, JSON.stringify(pinned));
    } catch {
      /* storage unavailable */
    }
  }, [pinned]);

  // Reset to the main level each time the menu opens.
  useEffect(() => {
    if (open) {
      setLevel('main');
      setQuery('');
    }
  }, [open]);

  // Close when the route changes.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (!target.isConnected) return; // element re-rendered inside the menu
      if (ref.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        anchorRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const el = level === 'spaces' ? ref.current?.querySelector<HTMLElement>('input') : ref.current?.querySelector<HTMLElement>('a,button');
    el?.focus();
  }, [open, level]);

  if (!open) return null;

  const L = (key: string) => t(`nav.menu.${key}`);
  const linkClass = (extra = '') => ({ isActive }: { isActive: boolean }) =>
    `${styles.row} ${extra} ${isActive ? styles.active : ''}`;

  function renderMainItem(item: MainItem) {
    switch (item.kind) {
      case 'group': {
        const expanded = !!openGroups[item.key];
        return (
          <div key={item.key}>
            <button
              className={`${styles.row} ${styles.group}`}
              aria-expanded={expanded}
              onClick={() => setOpenGroups((g) => ({ ...g, [item.key]: !expanded }))}>
              {Icon.folder}
              <span className={styles.label}>{L(item.key)}</span>
              {Icon.chevronDown}
            </button>
            {expanded &&
              item.children.map((c) => (
                <NavLink key={c.key} to={c.to} className={linkClass(styles.child)}>
                  <span className={styles.label}>{L(c.key)}</span>
                </NavLink>
              ))}
          </div>
        );
      }
      case 'page':
        return (
          <NavLink key={item.key} to={item.to} className={linkClass(styles.group)}>
            {Icon.folder}
            <span className={styles.label}>{L(item.key)}</span>
            {Icon.chevronNext}
          </NavLink>
        );
      case 'space':
        return (
          <button
            key={item.key}
            className={`${styles.row} ${styles.plain}`}
            onClick={() => {
              setOpenSpace(item.spaceId);
              setLevel('spaces');
            }}>
            <span className={styles.label}>{L(item.key)}</span>
            <span className={styles.vbar} aria-hidden="true" />
            {Icon.chevronNext}
          </button>
        );
      case 'link':
        return (
          <NavLink key={item.key} to={item.to} className={linkClass(styles.plain)}>
            <span className={styles.label}>{L(item.key)}</span>
          </NavLink>
        );
    }
  }

  const q = query.trim().toLowerCase();
  const pageMatches = (key: string) => !q || L(key).toLowerCase().includes(q);
  const spaceMatches = (sp: (typeof SPACES)[number]) => pageMatches(sp.key) || sp.pages.some((p) => pageMatches(p.key));
  const togglePin = (id: string) => setPinned((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function spaceRow(sp: (typeof SPACES)[number], withPages: boolean) {
    const isPinned = pinned.includes(sp.id);
    const expanded = withPages && (openSpace === sp.id || (!!q && sp.pages.some((p) => pageMatches(p.key))));
    return (
      <div key={`${withPages ? 'all' : 'pin'}-${sp.id}`}>
        <div className={styles.spaceRow}>
          <button
            className={`${styles.row} ${styles.spaceBtn}`}
            aria-expanded={withPages ? expanded : undefined}
            onClick={() => withPages && setOpenSpace(openSpace === sp.id ? null : sp.id)}>
            {withPages && Icon.chevronDown}
            <span className={styles.label}>{L(sp.key)}</span>
          </button>
          <button
            className={styles.pin}
            aria-pressed={isPinned}
            aria-label={`${isPinned ? L('unpin') : L('pin')}: ${L(sp.key)}`}
            onClick={() => togglePin(sp.id)}>
            {isPinned ? Icon.pinOn : Icon.pin}
          </button>
        </div>
        {expanded && (
          <div className={styles.pages}>
            {sp.pages
              .filter((p) => !q || pageMatches(p.key) || pageMatches(sp.key))
              .map((p) => (
                <NavLink key={p.key} to={p.to} className={linkClass()}>
                  <span className={styles.label}>{L(p.key)}</span>
                </NavLink>
              ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <nav ref={ref} className={styles.menu} aria-label={t('shell.menu', 'Menu')}>
      {level === 'main' ? (
        <>
          <div className={styles.scroll}>
            <NavLink to={ROUTES.HOME} className={linkClass()}>
              {Icon.home}
              <span className={styles.label}>{L('home')}</span>
            </NavLink>
            {MAIN_SECTIONS.map((sec) => {
              const expanded = !!openSections[sec.key];
              return (
                <div key={sec.key}>
                  <button
                    className={`${styles.row} ${styles.section}`}
                    aria-expanded={expanded}
                    onClick={() => setOpenSections((o) => ({ ...o, [sec.key]: !expanded }))}>
                    <span className={styles.label}>{L(sec.key)}</span>
                    {Icon.chevronDown}
                  </button>
                  {expanded && sec.items.map(renderMainItem)}
                </div>
              );
            })}
          </div>
          <div className={styles.footer}>
            <button className={styles.row} onClick={() => setLevel('spaces')}>
              {Icon.spaces}
              <span className={styles.label}>{L('all_spaces')}</span>
            </button>
            <NavLink to={ROUTES.SETTINGS} className={linkClass()}>
              {Icon.settings}
              <span className={styles.label}>{t('nav.settings', 'Settings')}</span>
            </NavLink>
          </div>
        </>
      ) : (
        <>
          <div className={styles.head}>
            <button className={styles.back} onClick={() => setLevel('main')} aria-label={L('back')}>
              {Icon.back}
            </button>
            <label className={styles.search}>
              <input
                id="nav-spaces-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={L('search')}
                aria-label={L('search_spaces')}
              />
              {Icon.search}
            </label>
          </div>
          <div className={styles.scroll}>
            <div className={styles.listHeader}>
              <span>{L('pinned_spaces')}</span>
              {pinned.length > 0 && <button onClick={() => setPinned([])}>{L('unpin_all')}</button>}
            </div>
            {SPACES.filter((sp) => pinned.includes(sp.id) && spaceMatches(sp)).map((sp) => spaceRow(sp, false))}
            {pinned.length === 0 && <div className={styles.empty}>{L('no_pinned')}</div>}
            <div className={styles.listHeader}>
              <span>{L('all_spaces')}</span>
            </div>
            {SPACES.filter(spaceMatches).map((sp) => spaceRow(sp, true))}
            {!SPACES.some(spaceMatches) && <div className={styles.empty}>{t('nav.menu.no_results', { q: query.trim() })}</div>}
          </div>
        </>
      )}
    </nav>
  );
}
