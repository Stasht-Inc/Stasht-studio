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