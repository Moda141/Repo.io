import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell/AppShell';
import HomePage from './pages/Home/HomePage';
import ExplorePage from './pages/Explore/ExplorePage';
import EntityListPage from './pages/Entity/EntityListPage';
import EntityDetailPage from './pages/Entity/EntityDetailPage';
import ChangeRequestsPage from './pages/ChangeRequests/ChangeRequestsPage';
import PipelinesPage from './pages/Pipelines/PipelinesPage';
import SettingsPage from './pages/Settings/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import { ROUTES } from './constants/routes';

/**
 * App — route table.
 * Shell routes nest under AppShell (sidebar + header), full-bleed routes
 * (future login, callback, print views) can be siblings outside it.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to={ROUTES.HOME} replace />} />
        <Route path={ROUTES.HOME} element={<HomePage />} />
        <Route path={ROUTES.EXPLORE} element={<ExplorePage />} />
        <Route path={ROUTES.ENTITY_LIST} element={<EntityListPage />} />
        <Route path={ROUTES.ENTITY_DETAIL} element={<EntityDetailPage />} />
        <Route path={ROUTES.CHANGE_REQUESTS} element={<ChangeRequestsPage />} />
        <Route path={ROUTES.PIPELINES} element={<PipelinesPage />} />
        <Route path={`${ROUTES.SETTINGS}/*`} element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
