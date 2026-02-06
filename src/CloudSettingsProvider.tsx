import React, { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore } from 'react';

import { addChangeListener, getString, setString, remove } from './CloudSettings';

type Listener = () => void;

class CloudSettingsStore {
  private cache = new Map<string, string | null>();
  private listeners = new Set<Listener>();

  read(key: string): string | null {
    if (!this.cache.has(key)) {
      try {
        this.cache.set(key, getString(key));
      } catch {
        this.cache.set(key, null);
      }
    }
    return this.cache.get(key) ?? null;
  }

  write(key: string, value: string | null): void {
    this.cache.set(key, value);
    this.notify();
  }

  invalidate(keys: readonly string[]): void {
    let changed = false;
    for (const key of keys) {
      if (this.cache.has(key)) {
        let fresh: string | null;
        try {
          fresh = getString(key);
        } catch {
          fresh = null;
        }
        if (this.cache.get(key) !== fresh) {
          this.cache.set(key, fresh);
          changed = true;
        }
      }
    }
    if (changed) {
      this.notify();
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

const CloudSettingsContext = createContext<CloudSettingsStore | null>(null);

export function CloudSettingsProvider({ children }: { readonly children: React.ReactNode }) {
  const storeRef = useRef<CloudSettingsStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = new CloudSettingsStore();
  }
  const store = storeRef.current;

  useEffect(() => {
    const subscription = addChangeListener((event) => {
      store.invalidate(event.changedKeys);
    });
    return () => subscription.remove();
  }, [store]);

  return (
    <CloudSettingsContext.Provider value={store}>
      {children}
    </CloudSettingsContext.Provider>
  );
}

function useStore(): CloudSettingsStore {
  const store = useContext(CloudSettingsContext);
  if (store === null) {
    throw new Error('useCloudSetting requires <CloudSettingsProvider> as an ancestor');
  }
  return store;
}

export function useCloudSettingRaw(key: string): readonly [string | null, (value: string | null) => void] {
  const store = useStore();

  const subscribe = useCallback(
    (listener: Listener) => store.subscribe(listener),
    [store]
  );

  const getSnapshot = useCallback(() => store.read(key), [store, key]);

  const value = useSyncExternalStore(subscribe, getSnapshot);

  const setter = useCallback(
    (newValue: string | null) => {
      if (newValue === null) {
        remove(key);
      } else {
        setString(key, newValue);
      }
      store.write(key, newValue);
    },
    [store, key]
  );

  return [value, setter] as const;
}
