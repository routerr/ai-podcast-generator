import { podcastStorageService } from './podcastStorageService';
import { storageService } from './storageService';
import { audioCacheService } from './audioCacheService';

const clearCookiesForCurrentOrigin = (): void => {
  if (typeof document === 'undefined' || !document.cookie) {
    return;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=');
    const name = (separatorIndex > -1 ? cookie.slice(0, separatorIndex) : cookie).trim();
    if (!name) {
      continue;
    }

    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  }
};

const clearCaches = async (): Promise<void> => {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return;
  }

  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
};

const unregisterServiceWorkers = async (): Promise<void> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
};

export const browserResetService = {
  async clearAll(): Promise<void> {
    storageService.clearAllEncryptedKeys();
    storageService.clearAllApiKeys();

    try {
      localStorage.clear();
    } catch (localStorageError) {
      console.error('Failed to clear localStorage during reset:', localStorageError);
    }

    try {
      sessionStorage.clear();
    } catch (sessionStorageError) {
      console.error('Failed to clear sessionStorage during reset:', sessionStorageError);
    }

    clearCookiesForCurrentOrigin();

    try {
      await podcastStorageService.reset();
      await audioCacheService.clear();
    } catch (indexedDbError) {
      console.error('Failed to clear IndexedDB during reset:', indexedDbError);
    }

    try {
      await clearCaches();
    } catch (cacheError) {
      console.error('Failed to clear Cache Storage during reset:', cacheError);
    }

    try {
      await unregisterServiceWorkers();
    } catch (serviceWorkerError) {
      console.error('Failed to unregister service workers during reset:', serviceWorkerError);
    }
  }
};
