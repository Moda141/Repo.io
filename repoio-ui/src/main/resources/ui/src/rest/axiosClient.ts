import axios, { AxiosError, type AxiosInstance } from 'axios';
import { queryClient } from '@/queryClient';

/**
 * Shared axios client for Repo.io REST calls.
 * - Base path is /api (dev proxy routes to Dropwizard; prod is same-origin).
 * - Request interceptor attaches the bearer token from localStorage.
 * - Response interceptor clears the TanStack cache on 401 so a re-auth
 *   does not leak the previous principal's cached data.
 */
export const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('repoio-token');
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const status = err.response?.status;
    if (status === 401) {
      localStorage.removeItem('repoio-token');
      queryClient.clear();
      // Full reload to re-trigger auth; a client-side redirect would
      // leave stale providers (I18n, Theme) attached to the old principal.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);
