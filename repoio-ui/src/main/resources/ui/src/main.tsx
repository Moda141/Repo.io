import React from 'react';
import { createRoot } from 'react-dom/client';
import AppRoot from './AppRoot';

// OpenMetadata design tokens + utility layer, ported verbatim from
// openmetadata-ui/src/main/resources/ui/src/styles. All `--om-*` custom
// properties and `@om-` LESS vars are renamed to `--repoio-*` / `@repoio-`
// for brand isolation; everything else — radii, spacing, type scale,
// shadows, Tailwind-ish utility classes, light + dark colour tokens — is
// identical to upstream.
//
// Load order matters: tokens → variables (via app.less) → repoio global
// reset.
import './styles/tokens.css';
import './styles/app.less';
import './styles/components-index.less';
import './styles/global.css';
import './locale/i18n';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);
