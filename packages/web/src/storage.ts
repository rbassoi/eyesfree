/**
 * Pluggable persistence. Methods may be sync or async, so the same interface wraps
 * `localStorage`, React Native `AsyncStorage`, IndexedDB, Capacitor Preferences, a cookie,
 * or your own backend API (to sync the profile across a user's devices).
 */
export interface StorageAdapter {
  get(key: string): string | null | undefined | Promise<string | null | undefined>;
  set(key: string, value: string): void | Promise<void>;
  remove(key: string): void | Promise<void>;
}

/** Anything with the Web Storage / AsyncStorage shape (`getItem`, `setItem`, `removeItem`). */
export interface StorageLike {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

/** Wraps any object with the `getItem` / `setItem` / `removeItem` shape (localStorage, AsyncStorage…). */
export function storageFrom(store: StorageLike): StorageAdapter {
  return {
    get: (key) => store.getItem(key),
    set: (key, value) => store.setItem(key, value),
    remove: (key) => store.removeItem(key),
  };
}

/**
 * `localStorage` adapter that never throws (private mode, disabled storage, SSR, sandboxed
 * iframes) — failures degrade to "not persisted".
 */
export function localStorageAdapter(storage?: Storage): StorageAdapter {
  const resolve = (): Storage | null => {
    try {
      return storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    } catch {
      return null;
    }
  };
  return {
    get(key) {
      try {
        return resolve()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        resolve()?.setItem(key, value);
      } catch {
        /* quota / disabled storage: ignore */
      }
    },
    remove(key) {
      try {
        resolve()?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

/** In-memory adapter (tests, SSR, kiosks, "don't remember me" mode). */
export function memoryAdapter(initial: Record<string, string> = {}): StorageAdapter & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
    dump: () => Object.fromEntries(data),
  };
}
