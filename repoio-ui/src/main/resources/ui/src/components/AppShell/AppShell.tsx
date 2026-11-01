import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import styles from './AppShell.module.css';

const { Sider, Header, Content } = Layout;

/**
 * AppShell — the three-pane layout mirrored from OpenMetadata:
 *   84px dark icon rail (left)
 *   64px white top bar with global search + user menu
 *   content area with the active route's page.
 *
 * This is the only chrome the user sees on every logged-in route;
 * pages do not render their own header or sidebar.
 */
export default function AppShell() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={84}
        theme="dark"
        collapsible={false}
        className={styles.sider}>
        <Sidebar />
      </Sider>
      <Layout>
        <Header className={styles.header}>
          <TopBar />
        </Header>
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
