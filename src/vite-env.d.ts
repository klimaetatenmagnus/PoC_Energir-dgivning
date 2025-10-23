/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SOLAR_BASE_URL?: string;
  readonly VITE_SKIP_REMOTE_CONFIG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
