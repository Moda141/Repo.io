import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Catches render-tree errors in child routes.
 * Mirrors OpenMetadata's ErrorBoundary: full-page Result with a Reload action.
 * React does NOT catch async errors or event-handler errors here — those must
 * surface through TanStack Query's `onError` or a toast from the mutation.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[Repo.io] uncaught error in render tree:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <Result
        status="500"
        title="Something went wrong"
        subTitle={this.state.error?.message}
        extra={
          <Button type="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        }
      />
    );
  }
}
