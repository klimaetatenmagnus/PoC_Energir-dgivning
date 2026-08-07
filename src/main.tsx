import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { loadAppConfig } from "./runtimeConfig.ts";
import { TransitionOverlayProvider } from "./context/TransitionOverlayContext";
import "./punkt.scss";
import "./index.css";
import "./styles/components.css";

if (typeof window !== "undefined") {
  window.pktIconPath = "/punkt-assets/icons/";
}

/**
 * I produksjon lastes CSS-bundelen asynkront (media="print" til den er lastet,
 * se temaLandingPlugin i vite.config.ts) slik at det statiske innholdet tegnes
 * umiddelbart. Vent på stylesheet(ene) før React mountes så appen aldri vises
 * ustylet. I dev finnes ingen data-app-css-lenker og funksjonen returnerer straks.
 */
function waitForAppCss(): Promise<void> {
  const links = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[data-app-css]')
  ).filter((link) => link.media !== "all" && !link.sheet);

  if (links.length === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let remaining = links.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
    };
    // Fail-safe: mount uansett hvis CSS-en aldri laster
    setTimeout(resolve, 4000);
    for (const link of links) {
      link.addEventListener("load", done, { once: true });
      link.addEventListener("error", done, { once: true });
    }
  });
}

async function bootstrap() {
  try {
    await loadAppConfig();
  } catch {
    // Stille feil - default config brukes
  }

  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Root element not found");
  }

  await waitForAppCss();

  const isAdminRoute = window.location.pathname.startsWith("/admin");

  if (isAdminRoute) {
    // Admin-appen lastes lazy — den skal ikke inn i besøkendes bundle
    const { AdminApp } = await import("./admin/AdminApp.tsx");
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
