/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type KaarobarPosApi = {
  getStatus: () => Promise<{
    online: boolean;
    pendingSyncCount: number;
    mode: string;
  }>;
  enqueueSale: (sale: unknown) => Promise<{ pendingSyncCount: number }>;
  cacheCatalog: (catalog: unknown[]) => Promise<{ ok: boolean; count: number }>;
  getCachedCatalog: () => Promise<{ items: unknown[]; cached_at?: string }>;
  syncOutbox: (opts: {
    token: string;
    businessId: string;
    branchId: string;
  }) => Promise<{
    synced: number;
    results: unknown[];
    pendingSyncCount?: number;
  }>;
};

declare global {
  interface Window {
    kaarobarPos?: KaarobarPosApi;
  }
}

export {};
