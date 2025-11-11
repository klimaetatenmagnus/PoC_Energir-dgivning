import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { loadAppConfig } from "./runtimeConfig.ts";
import { TransitionOverlayProvider } from "./context/TransitionOverlayContext";
import "./punkt.scss";
import "./index.css";
import "./styles/components.css";

async function bootstrap() {
  try {
    await loadAppConfig();
  } catch (error) {
    console.warn("[app-config] Falling back to default config", error);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <TransitionOverlayProvider>
        <App />
      </TransitionOverlayProvider>
    </React.StrictMode>
  );
}

void bootstrap();
