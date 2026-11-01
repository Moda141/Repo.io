import React from 'react';
import { createRoot } from 'react-dom/client';
import AppRoot from './AppRoot';
import './styles/global.css';
import './locale/i18n';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);
