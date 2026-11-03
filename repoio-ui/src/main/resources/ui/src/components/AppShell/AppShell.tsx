import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import FioriShellBar from './FioriShellBar';
import FioriSideNav from './FioriSideNav';
import styles from './AppShell.module.css';

const STORAGE_KEY = 'repoio-sidenav-collapsed';

/**
 * AppShell — SAP Fiori Horizon layout
 *
 * Three regions (matches Fiori floorplan):
 *   <header class="fiori-shell-bar">     44px — Shell Bar
 *   <nav class="fiori-side-nav">         48px collapsed / 272px expanded — Side Navigation
 *   <main class="fiori-content-wrapper"> fills remaining viewport
 *
 * Shell Bar:   always visible at top (position: fixed)
 * Side Nav:    fixed on the left, persists collapse state
 * Content:     scrollable, gets margin-left matching nav width
 */
export default function AppShell() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  return (
    <div className={styles.shell}>
      {/* Fiori Shell Bar — 44px top navigation */}
      <FioriShellBar />

      {/* Body area below shell bar */}
      <div className={styles.body}>
        {/* Fiori Side Navigation */}
        <FioriSideNav
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />

        {/* Main content area */}
        <main
          className={styles.content}
          style={{
            marginInlineStart: collapsed ? 'var(--sapSideNav_CollapsedWidth)' : 'var(--sapSideNav_Width)',
          }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
