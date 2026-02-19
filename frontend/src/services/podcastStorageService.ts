import { AppStep, Outline, ResearchResult, Script } from '../types';

const DB_NAME = 'ai_podcast_generator_db';
const DB_VERSION = 1;
const STORE_NAME = 'podcast_sessions';
const LATEST_RECORD_KEY = 'latest';

type PersistedResearchResult = Omit<ResearchResult, 'timestamp'> & {
  timestamp: string;
};

type PersistedPodcastRecord = {
  version: 1;
  savedAt: string;
  currentStep: AppStep;
  topic: string;
  research: PersistedResearchResult | null;
  outline: Outline | null;
  script: Script | null;
  audioBlob: Blob | null;
  audioDuration: number;
};

export interface PersistedPodcastSnapshot {
  currentStep: AppStep;
  topic: string;
  research: ResearchResult | null;
  outline: Outline | null;
  script: Script | null;
  audioBlob: Blob | null;
  audioDuration: number;
}

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

const serializeResearch = (research: ResearchResult | null): PersistedResearchResult | null => {
  if (!research) {
    return null;
  }

  return {
    ...research,
    timestamp: research.timestamp.toISOString()
  };
};

const deserializeResearch = (research: PersistedResearchResult | null): ResearchResult | null => {
  if (!research) {
    return null;
  }

  return {
    ...research,
    timestamp: new Date(research.timestamp)
  };
};

export const podcastStorageService = {
  async save(snapshot: PersistedPodcastSnapshot): Promise<void> {
    if (!isIndexedDbAvailable()) {
      return;
    }

    const payload: PersistedPodcastRecord = {
      version: 1,
      savedAt: new Date().toISOString(),
      currentStep: snapshot.currentStep,
      topic: snapshot.topic,
      research: serializeResearch(snapshot.research),
      outline: snapshot.outline,
      script: snapshot.script,
      audioBlob: snapshot.audioBlob,
      audioDuration: snapshot.audioDuration
    };

    const db = await openDatabase();
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(payload, LATEST_RECORD_KEY);
      await transactionDone(transaction);
    } finally {
      db.close();
    }
  },

  async load(): Promise<PersistedPodcastSnapshot | null> {
    if (!isIndexedDbAvailable()) {
      return null;
    }

    const db = await openDatabase();
    try {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const record = await requestToPromise(store.get(LATEST_RECORD_KEY) as IDBRequest<PersistedPodcastRecord | undefined>);
      await transactionDone(transaction);

      if (!record || record.version !== 1) {
        return null;
      }

      return {
        currentStep: record.currentStep,
        topic: record.topic,
        research: deserializeResearch(record.research),
        outline: record.outline,
        script: record.script,
        audioBlob: record.audioBlob,
        audioDuration: record.audioDuration
      };
    } finally {
      db.close();
    }
  },

  async clear(): Promise<void> {
    if (!isIndexedDbAvailable()) {
      return;
    }

    const db = await openDatabase();
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(LATEST_RECORD_KEY);
      await transactionDone(transaction);
    } finally {
      db.close();
    }
  }
};
