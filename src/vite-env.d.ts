/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTOFLEX_API_URL: string;
  readonly VITE_IAM_URL: string;
  readonly VITE_IAM_API_KEY: string;
  readonly VITE_IAM_CUSTOMER_DOMAIN_APPLICATION_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
