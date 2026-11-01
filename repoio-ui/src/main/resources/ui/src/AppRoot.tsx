import { ConfigProvider, App as AntdApp } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';
import { queryClient } from './queryClient';
import { repoioTheme, antdLocaleFor } from './styles/theme';
import i18n from './locale/i18n';

/**
 * AppRoot — the single mount point. Providers go here in the same order
 * OpenMetadata's AppRoot uses:
 *   Query → Theme → Antd runtime → i18n → Helmet → Router → ErrorBoundary → App.
 * Any provider that needs to read URL/location (Query devtools, i18n RTL) sits
 * INSIDE BrowserRouter.
 */
export default function AppRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n} defaultNS="translation">
        <HelmetProvider>
          <ThemedApp />
        </HelmetProvider>
      </I18nextProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

function ThemedApp() {
  const { i18n: i18nInstance } = useTranslation();
  const isRtl = i18nInstance.dir() === 'rtl';

  useEffect(() => {
    document.documentElement.dir = i18nInstance.dir();
    document.documentElement.lang = i18nInstance.language;
  }, [i18nInstance.language, i18nInstance]);

  return (
    <ConfigProvider
      theme={repoioTheme}
      direction={isRtl ? 'rtl' : 'ltr'}
      locale={antdLocaleFor(i18nInstance.language)}>
      <AntdApp>
        <BrowserRouter>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}
