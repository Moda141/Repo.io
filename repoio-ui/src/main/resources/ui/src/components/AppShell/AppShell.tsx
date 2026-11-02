import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import styles from './AppShell.module.css';

/**
 * AppShell — literal port of OpenMetadata's layout chrome:
 *   84 px white icon rail (bordered) · 64 px white navbar (bordered)
 *   · gray-blue page body (#f8f9fc).
 *
 * No Antd `<Layout>` here — raw divs so we control border/padding
 * exactly as OpenMetadata does.
 */
export default function AppShell() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sider}>
        <Sidebar />
      </aside>
      <div className={styles.main}>
        <header className={styles.navbar}>
          <TopBar />
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
