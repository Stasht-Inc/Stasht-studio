/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  // add more environment variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected at build time by vite.config.ts's `define` — the ISO timestamp of
// when this bundle was built, shown in the profile menu as the build version.
declare const __APP_BUILD_TIME__: string;