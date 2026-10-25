import type { KinloreApi } from '@kinlore/ipc-contract';

declare global {
  interface Window {
    kinlore: KinloreApi;
  }
}

export {};
