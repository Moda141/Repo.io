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
import PipelineDetailPage from './pages/Pipelines/PipelineDetailPage';
import PipelineEditPage from './pages/Pipelines/PipelineEditPage';
import PipelineNewPage from './pages/Pipelines/PipelineNewPage';
import SourcesPage from './pages/Sources/SourcesPage';
import SourceDetailPage from './pages/Sources/SourceDetailPage';
import SourceNewPage from './pages/Sources/SourceNewPage';
import DQDashboardPage from './pages/Quality/DQDashboardPage';
import DQRuleEditorPage from './pages/Quality/DQRuleEditorPage';
import MatchingRulesPage from './pages/Quality/MatchingRulesPage';
import SurvivorshipPage from './pages/Quality/SurvivorshipPage';
import PlaygroundPage from './pages/Quality/PlaygroundPage';
import SettingsPage from './pages/Settings/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import LoginPage from './pages/Auth/LoginPage';
import ProfilePage from './pages/Profile/ProfilePage';
import NotificationsPage from './pages/Notifications/NotificationsPage';
import WorkflowsListPage from './pages/Workflows/WorkflowsListPage';
import WorkflowBuilderPage from './pages/Workflows/WorkflowBuilderPage';
import WorkflowDetailPage from './pages/Workflows/WorkflowDetailPage';
import WorkflowRunsPage from './pages/Workflows/WorkflowRunsPage';
import AlertsListPage from './pages/Alerts/AlertsListPage';
import AlertEditorPage from './pages/Alerts/AlertEditorPage';
import AlertChannelsPage from './pages/Alerts/AlertChannelsPage';
import AlertHistoryPage from './pages/Alerts/AlertHistoryPage';
import IntegrationsHubPage from './pages/Integrations/IntegrationsHubPage';
import WebhooksPage from './pages/Integrations/WebhooksPage';
import ShareLinksPage from './pages/Integrations/ShareLinksPage';
import EmbedsPage from './pages/Integrations/EmbedsPage';
import ApiReferencePage from './pages/Integrations/ApiReferencePage';
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
      {/* Full-bleed routes (no AppShell) */}
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />

      {/* Shell routes */}
      <Route element={<AppShell />}>
        <Route index element={<Navigate to={ROUTES.HOME} replace />} />
        <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
        <Route path={ROUTES.NOTIFICATIONS} element={<NotificationsPage />} />
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

        {/* Pipelines — static before :pipelineId */}
        <Route path={ROUTES.PIPELINE_NEW} element={<PipelineNewPage />} />
        <Route path={ROUTES.PIPELINE_EDIT} element={<PipelineEditPage />} />
        <Route path={ROUTES.PIPELINE_DETAIL} element={<PipelineDetailPage />} />
        <Route path={ROUTES.PIPELINES} element={<PipelinesPage />} />

        {/* Sources */}
        <Route path={ROUTES.SOURCE_NEW} element={<SourceNewPage />} />
        <Route path={ROUTES.SOURCE_DETAIL} element={<SourceDetailPage />} />
        <Route path={ROUTES.SOURCES} element={<SourcesPage />} />

        {/* Workflows */}
        <Route path={ROUTES.WORKFLOW_NEW} element={<WorkflowBuilderPage />} />
        <Route path={ROUTES.WORKFLOW_EDIT} element={<WorkflowBuilderPage />} />
        <Route path={ROUTES.WORKFLOW_RUNS} element={<WorkflowRunsPage />} />
        <Route path={ROUTES.WORKFLOW_DETAIL} element={<WorkflowDetailPage />} />
        <Route path={ROUTES.WORKFLOWS} element={<WorkflowsListPage />} />

        {/* Alerts */}
        <Route path={ROUTES.ALERT_NEW} element={<AlertEditorPage />} />
        <Route path={ROUTES.ALERT_CHANNELS} element={<AlertChannelsPage />} />
        <Route path={ROUTES.ALERT_HISTORY} element={<AlertHistoryPage />} />
        <Route path={ROUTES.ALERT_DETAIL} element={<AlertEditorPage />} />
        <Route path={ROUTES.ALERTS} element={<AlertsListPage />} />

        {/* Integrations */}
        <Route path={ROUTES.INTEGRATIONS_WEBHOOKS} element={<WebhooksPage />} />
        <Route path={ROUTES.INTEGRATIONS_LINKS} element={<ShareLinksPage />} />
        <Route path={ROUTES.INTEGRATIONS_EMBEDS} element={<EmbedsPage />} />
        <Route path={ROUTES.INTEGRATIONS_API} element={<ApiReferencePage />} />
        <Route path={ROUTES.INTEGRATIONS} element={<IntegrationsHubPage />} />

        {/* Quality & Rules */}
        <Route path={ROUTES.QUALITY} element={<DQDashboardPage />} />
        <Route path={ROUTES.QUALITY_RULES} element={<DQRuleEditorPage />} />
        <Route path={ROUTES.QUALITY_RULE_EDIT} element={<DQRuleEditorPage />} />
        <Route path={ROUTES.MATCHING} element={<MatchingRulesPage />} />
        <Route path={ROUTES.SURVIVORSHIP} element={<SurvivorshipPage />} />
        <Route path={ROUTES.PLAYGROUND} element={<PlaygroundPage />} />

        <Route path={`${ROUTES.SETTINGS}/*`} element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
