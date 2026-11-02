import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell/AppShell';
import HomePage from './pages/Home/HomePage';
import ExplorePage from './pages/Explore/ExplorePage';
import SearchResultsPage from './pages/Search/SearchResultsPage';
import QueryBuilderPage from './pages/Search/QueryBuilderPage';
import SavedViewsPage from './pages/Search/SavedViewsPage';
import ExportWizardPage from './pages/Search/ExportWizardPage';
import EntityListPage from './pages/Entity/EntityListPage';
import EntityDetailPage from './pages/Entity/EntityDetailPage';
import EntityNewPage from './pages/Entity/EntityNewPage';
import EntityEditPage from './pages/Entity/EntityEditPage';
import DuplicateListPage from './pages/Entity/DuplicateListPage';
import DuplicateReviewPage from './pages/Entity/DuplicateReviewPage';
import EntityMergePage from './pages/Entity/EntityMergePage';
import HierarchyPage from './pages/Entity/HierarchyPage';
import LineagePage from './pages/Entity/LineagePage';
import ChangeRequestsPage from './pages/ChangeRequests/ChangeRequestsPage';
import ChangeRequestNewPage from './pages/ChangeRequests/ChangeRequestNewPage';
import ChangeRequestDetailPage from './pages/ChangeRequests/ChangeRequestDetailPage';
import MyRequestsPage from './pages/ChangeRequests/MyRequestsPage';
import PipelinesPage from './pages/Pipelines/PipelinesPage';
import SettingsPage from './pages/Settings/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import { ROUTES } from './constants/routes';

/**
 * App — route table.
 * Shell routes nest under AppShell (sidebar + header), full-bleed routes
 * (future login, callback, print views) can be siblings outside it.
 *
 * Static sub-routes come BEFORE the dynamic :id route so react-router
 * matches /new, /duplicates, /merge instead of treating them as an id.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to={ROUTES.HOME} replace />} />
        <Route path={ROUTES.HOME} element={<HomePage />} />
        <Route path={ROUTES.EXPLORE} element={<ExplorePage />} />

        {/* Search & Discovery */}
        <Route path={ROUTES.SEARCH} element={<SearchResultsPage />} />
        <Route path={ROUTES.QUERY} element={<QueryBuilderPage />} />
        <Route path={ROUTES.VIEWS} element={<SavedViewsPage />} />
        <Route path={ROUTES.VIEW_DETAIL} element={<SavedViewsPage />} />
        <Route path={ROUTES.EXPORT} element={<ExportWizardPage />} />

        {/* Entity — order matters (static before :id) */}
        <Route path={ROUTES.ENTITY_LIST} element={<EntityListPage />} />
        <Route path={ROUTES.ENTITY_NEW} element={<EntityNewPage />} />
        <Route path={ROUTES.DUPLICATE_LIST} element={<DuplicateListPage />} />
        <Route path={ROUTES.DUPLICATE_REVIEW} element={<DuplicateReviewPage />} />
        <Route path={ROUTES.ENTITY_MERGE} element={<EntityMergePage />} />
        <Route path={ROUTES.ENTITY_EDIT} element={<EntityEditPage />} />
        <Route path={ROUTES.ENTITY_HIERARCHY} element={<HierarchyPage />} />
        <Route path={ROUTES.ENTITY_LINEAGE} element={<LineagePage />} />
        <Route path={ROUTES.ENTITY_DETAIL} element={<EntityDetailPage />} />

        {/* Change requests — static before :crId */}
        <Route path={ROUTES.CHANGE_REQUEST_NEW} element={<ChangeRequestNewPage />} />
        <Route path={ROUTES.CHANGE_REQUEST_MINE} element={<MyRequestsPage />} />
        <Route path={ROUTES.CHANGE_REQUESTS} element={<ChangeRequestsPage />} />
        <Route path={ROUTES.CHANGE_REQUEST_DETAIL} element={<ChangeRequestDetailPage />} />

        <Route path={ROUTES.PIPELINES} element={<PipelinesPage />} />
        <Route path={`${ROUTES.SETTINGS}/*`} element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
