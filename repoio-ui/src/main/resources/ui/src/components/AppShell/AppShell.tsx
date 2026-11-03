import { Outlet } from 'react-router-dom';
import { useCallback, useRef, useState } from 'react';
import FioriShellBar from './FioriShellBar';
import NavigationMenu from './NavigationMenu';
import styles from './AppShell.module.css';

/**
 * AppShell — SAP Fiori Horizon layout
 *
 * References:
 *   design-reference/sap-s4hana/01-overview-page.svg            (shell bar)
 *   design-reference/sap-s4hana/components/navigation-menu.svg  (☰ menu)
 *
 *   Shell Bar (52px, white) — always visible
 *   Navigation Menu — popover under the ☰ button; overlays the page
 *   Content — full width, scrollable
 */
export default function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeNav = useCallback(() => setNavOpen(false), []);

  return (
    <div className={styles.shell}>
      <FioriShellBar
        navOpen={navOpen}
        onMenuToggle={() => setNavOpen((o) => !o)}
        menuButtonRef={menuButtonRef}
      />
      <NavigationMenu open={navOpen} onClose={closeNav} anchorRef={menuButtonRef} />

      <div className={styles.body}>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
