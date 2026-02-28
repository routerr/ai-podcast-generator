const DB_NAME = 'ai_podcast_audio_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_segments';

const isIndexedDbAvailable = (): boolean => typeof window !== 'undefined' && 'indexedDB' in window;

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });

const openDatabase = async (): Promise<IDBDatabase> => {
  if (!isIndexedDbAvailable()) {
    throw new Error('IndexedDB is not available.');
  }

  const openRequest = indexedDB.open(DB_NAME, DB_VERSION);
  openRequest.onupgradeneeded = () => {
    const db = openRequest.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  };

  return requestToPromise(openRequest);
};

export const audioCacheService = {
  async set(key: string, blob: Blob): Promise<void> {
    if (!isIndexedDbAvailable()) return;
    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(blob, key);
      await transactionDone(transaction);
      db.close();
    } catch (error) {
      console.warn(`Failed to cache audio blob for key ${key}:`, error);
    }
  },

  async get(key: string): Promise<Blob | null> {
    if (!isIndexedDbAvailable()) return null;
    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key) as IDBRequest<Blob | undefined>;
      const result = await requestToPromise(request);
      await transactionDone(transaction);
      db.close();
      return result || null;
    } catch (error) {
      console.warn(`Failed to read audio cache for key ${key}:`, error);
      return null;
    }
  },

  async clear(): Promise<void> {
    if (!isIndexedDbAvailable()) return;
    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      await transactionDone(transaction);
      db.close();
    } catch (error) {
      console.warn('Failed to clear audio cache:', error);
    }
  }
};
