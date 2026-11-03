import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import FioriShellBar from './FioriShellBar';
import FioriSideNav from './FioriSideNav';
import styles from './AppShell.module.css';

const NAV_OPEN_KEY = 'repoio-sidenav-open';
const COLLAPSED_KEY = 'repoio-sidenav-collapsed';

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* storage unavailable — keep in-memory state only */
  }
}

/**
 * AppShell — SAP Fiori Horizon layout
 *
 * Reference: design-reference/sap-s4hana/01-overview-page.svg
 *
 *   Shell Bar (52px, white) — always visible
 *   Side Nav  — hidden by default, opened from the shell bar menu (☰) button,
 *               as in SAP S/4HANA Cloud. When open it can collapse to 48px.
 *   Content   — scrollable, offset by the side nav width when it is open.
 */
export default function AppShell() {
  const [navOpen, setNavOpen] = useState<boolean>(() => readFlag(NAV_OPEN_KEY, false));
  const [collapsed, setCollapsed] = useState<boolean>(() => readFlag(COLLAPSED_KEY, false));

  useEffect(() => writeFlag(NAV_OPEN_KEY, navOpen), [navOpen]);
  useEffect(() => writeFlag(COLLAPSED_KEY, collapsed), [collapsed]);

  const navWidth = !navOpen
    ? '0px'
    : collapsed
      ? 'var(--sapSideNav_CollapsedWidth)'
      : 'var(--sapSideNav_Width)';

  return (
    <div className={styles.shell}>
      <FioriShellBar navOpen={navOpen} onMenuToggle={() => setNavOpen((o) => !o)} />

      <div className={styles.body}>
        {navOpen && (
          <FioriSideNav collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        )}

        <main className={styles.content} style={{ marginInlineStart: navWidth }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
