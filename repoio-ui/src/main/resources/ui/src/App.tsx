import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import { repoioTheme } from './styles/theme';
import AppContainer from './components/AppContainer';
import HomePage from './pages/HomePage';
import DiscoverPage from './pages/DiscoverPage';
import StewardshipPage from './pages/StewardshipPage';
import RecordDetailPage from './pages/RecordDetailPage';
import DuplicateReviewPage from './pages/DuplicateReviewPage';
import ChangeRequestsPage from './pages/ChangeRequestsPage';

const qc = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <ConfigProvider theme={repoioTheme}>
        <BrowserRouter>
          <Routes>
            <Route element={<AppContainer />}>
              <Route path="/" element={<Navigate to="/home" />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/discover" element={<DiscoverPage />} />
              <Route path="/stewardship" element={<StewardshipPage />} />
              <Route path="/stewardship/record/:id" element={<RecordDetailPage />} />
              <Route path="/stewardship/duplicates" element={<DuplicateReviewPage />} />
              <Route path="/requests" element={<ChangeRequestsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
