import { ConfigProvider } from "antd";
import "antd/dist/antd.variable.min.css";
import "@fontsource-variable/inter";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./om.css";

// Same mechanism OpenMetadata uses: antd 4 variable theme + their default palette (Settings > Preferences > Theme).
ConfigProvider.config({
  theme: { primaryColor: "#1570ef", successColor: "#039855", warningColor: "#dc6803", errorColor: "#d92d20", infoColor: "#1570ef" },
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
