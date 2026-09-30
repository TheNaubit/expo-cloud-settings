import type { CloudSettingsChangeEvent, CloudSettingsSubscription } from './CloudSettings.types';
import ExpoCloudSettingsModule from './ExpoCloudSettingsModule';

// iCloud KVS limits
const MAX_VALUE_BYTES = 1_000_000;

const MAX_KEY_BYTES = 64;

function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (isHighSurrogate(code) && isLowSurrogate(text.charCodeAt(i + 1))) {
      // Surrogate pair: one 4-byte code point
      bytes += 4;
      i++;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

// Local writes do not fire the native change event, so providers subscribe here.
// A null key list means every key may have changed.
type LocalChangeListener = (keys: readonly string[] | null) => void;

const localChangeListeners = new Set<LocalChangeListener>();

export function subscribeToLocalChanges(listener: LocalChangeListener): () => void {
  localChangeListeners.add(listener);
  return () => {
    localChangeListeners.delete(listener);
  };
}

function notifyLocalChange(keys: readonly string[] | null): void {
  for (const listener of Array.from(localChangeListeners)) {
    listener(keys);
  }
}

function validateKey(key: string): void {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('CloudSettings: key must be a non-empty string');
  }
  if (utf8ByteLength(key) > MAX_KEY_BYTES) {
    throw new Error(`CloudSettings: key must not exceed ${MAX_KEY_BYTES} bytes`);
  }
}

// Core string operations

export function setString(key: string, value: string): void {
  validateKey(key);
  if (typeof value !== 'string') {
    throw new Error('CloudSettings: value must be a string');
  }
  if (utf8ByteLength(value) > MAX_VALUE_BYTES) {
    throw new Error(`CloudSettings: value exceeds maximum size of ${MAX_VALUE_BYTES} bytes`);
  }
  ExpoCloudSettingsModule.setString(key, value);
  notifyLocalChange([key]);
}

export function getString(key: string): string | null {
  validateKey(key);
  return ExpoCloudSettingsModule.getString(key);
}

export function remove(key: string): void {
  validateKey(key);
  ExpoCloudSettingsModule.remove(key);
  notifyLocalChange([key]);
}

export function getAllKeys(): string[] {
  return ExpoCloudSettingsModule.getAllKeys();
}

export function clear(): void {
  ExpoCloudSettingsModule.clear();
  notifyLocalChange(null);
}

export function isAvailable(): boolean {
  return ExpoCloudSettingsModule.isAvailable();
}

// Typed helpers

export function setBool(key: string, value: boolean): void {
  setString(key, JSON.stringify(value));
}

export function getBool(key: string): boolean | null {
  const raw = getString(key);
  if (raw === null) return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

export function setNumber(key: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error('CloudSettings: value must be a finite number');
  }
  setString(key, JSON.stringify(value));
}

export function getNumber(key: string): number | null {
  const raw = getString(key);
  if (raw === null || raw.trim().length === 0) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function setObject<T>(key: string, value: T): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new Error(
      `CloudSettings: value is not JSON-serializable: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (typeof serialized !== 'string') {
    throw new Error('CloudSettings: value is not JSON-serializable');
  }
  setString(key, serialized);
}

export function getObject<T>(key: string): T | null {
  const raw = getString(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Change listener

export function addChangeListener(
  callback: (event: CloudSettingsChangeEvent) => void
): CloudSettingsSubscription {
  return ExpoCloudSettingsModule.addListener('onStoreChanged', callback);
}
