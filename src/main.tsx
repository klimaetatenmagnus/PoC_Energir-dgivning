import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { loadAppConfig } from "./runtimeConfig.ts";
import { TransitionOverlayProvider } from "./context/TransitionOverlayContext";
import "./punkt.scss";
import "./index.css";
import "./styles/components.css";
import { AdminApp } from "./admin/AdminApp.tsx";

if (typeof window !== "undefined") {
  window.pktIconPath = "/punkt-assets/icons/";
}

async function bootstrap() {
  try {
    await loadAppConfig();
  } catch (error) {
    console.warn("[app-config] Falling back to default config", error);
  }

  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Root element not found");
  }

  const isAdminRoute = window.location.pathname.startsWith("/admin");

  if (isAdminRoute) {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <AdminApp />
      </React.StrictMode>
    );
    return;
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <TransitionOverlayProvider>
        <App />
      </TransitionOverlayProvider>
    </React.StrictMode>
  );
}

void bootstrap();
