import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import styles from './AppShell.module.css';

const STORAGE_KEY = 'repoio-sidebar-collapsed';

/**
 * AppShell — the three-region layout OpenMetadata uses:
 *   <aside class="app-sidebar">   (72px collapsed / 228px expanded)
 *   <header class="app-navbar-header">   (80px, 20/24 padding)
 *   <main class="page-container">        (24px top, 24px side, 16px bottom)
 * The collapsed state persists per browser (OpenMetadata persists it via
 * user preferences; we keep it local for now until the /me endpoint
 * lands). Side spacing and header padding come from
 * variables.less @sidebar-width, @layout-header-height,
 * @layout-header-padding.
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
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />
      <div className={styles.main}>
        <header className={styles.header}>
          <TopBar />
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
