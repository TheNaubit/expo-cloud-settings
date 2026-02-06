import type { EventSubscription } from 'expo-modules-core';

import { CloudSettingsChangeEvent } from './CloudSettings.types';
import ExpoCloudSettingsModule from './ExpoCloudSettingsModule';

// iCloud KVS limits
const MAX_VALUE_BYTES = 1_000_000;

const MAX_KEY_BYTES = 64;

function validateKey(key: string): void {
  if (!key) {
    throw new Error('CloudSettings: key must be a non-empty string');
  }
  if (typeof TextEncoder !== 'undefined') {
    if (new TextEncoder().encode(key).length > MAX_KEY_BYTES) {
      throw new Error(
        `CloudSettings: key must not exceed ${MAX_KEY_BYTES} bytes`
      );
    }
  } else if (key.length * 4 > MAX_KEY_BYTES) {
    throw new Error(
      `CloudSettings: key must not exceed ${MAX_KEY_BYTES} bytes`
    );
  }
}

// Core string operations

export function setString(key: string, value: string): void {
  validateKey(key);
  if (typeof TextEncoder !== 'undefined') {
    if (new TextEncoder().encode(value).length > MAX_VALUE_BYTES) {
      throw new Error(
        `CloudSettings: value exceeds maximum size of ${MAX_VALUE_BYTES} bytes`
      );
    }
  } else if (value.length * 4 > MAX_VALUE_BYTES) {
    throw new Error(
      `CloudSettings: value may exceed maximum size of ${MAX_VALUE_BYTES} bytes`
    );
  }
  ExpoCloudSettingsModule.setString(key, value);
}

export function getString(key: string): string | null {
  validateKey(key);
  return ExpoCloudSettingsModule.getString(key);
}

export function remove(key: string): void {
  validateKey(key);
  ExpoCloudSettingsModule.remove(key);
}

export function getAllKeys(): string[] {
  return ExpoCloudSettingsModule.getAllKeys();
}

export function clear(): void {
  ExpoCloudSettingsModule.clear();
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
  if (raw === null || raw.length === 0) return null;
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
): EventSubscription {
  return ExpoCloudSettingsModule.addListener('onStoreChanged', callback);
}
