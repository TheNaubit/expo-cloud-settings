import { useCallback, useMemo, useRef } from 'react';

import { useCloudSettingRaw } from './CloudSettingsProvider';

export function useCloudSetting(
  key: string,
  defaultValue?: string
): readonly [string | null, (value: string | null) => void] {
  const [raw, setRaw] = useCloudSettingRaw(key);
  const value = raw ?? defaultValue ?? null;
  return [value, setRaw] as const;
}

export function useCloudSettingBool(
  key: string,
  defaultValue?: boolean
): readonly [boolean | null, (value: boolean | null) => void] {
  const [raw, setRaw] = useCloudSettingRaw(key);
  const defaultRef = useRef(defaultValue);
  defaultRef.current = defaultValue;

  const value = useMemo(() => {
    if (raw === null) return defaultRef.current ?? null;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return defaultRef.current ?? null;
  }, [raw]);

  const setter = useCallback(
    (newValue: boolean | null) => {
      setRaw(newValue === null ? null : JSON.stringify(newValue));
    },
    [setRaw]
  );

  return [value, setter] as const;
}

export function useCloudSettingNumber(
  key: string,
  defaultValue?: number
): readonly [number | null, (value: number | null) => void] {
  const [raw, setRaw] = useCloudSettingRaw(key);
  const defaultRef = useRef(defaultValue);
  defaultRef.current = defaultValue;

  const value = useMemo(() => {
    if (raw === null || raw.length === 0) return defaultRef.current ?? null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return defaultRef.current ?? null;
    return parsed;
  }, [raw]);

  const setter = useCallback(
    (newValue: number | null) => {
      if (newValue !== null && !Number.isFinite(newValue)) {
        throw new Error('CloudSettings: value must be a finite number');
      }
      setRaw(newValue === null ? null : JSON.stringify(newValue));
    },
    [setRaw]
  );

  return [value, setter] as const;
}

export function useCloudSettingObject<T>(
  key: string,
  defaultValue?: T
): readonly [T | null, (value: T | null) => void] {
  const [raw, setRaw] = useCloudSettingRaw(key);
  const defaultRef = useRef(defaultValue);
  defaultRef.current = defaultValue;

  const value = useMemo(() => {
    if (raw === null) return defaultRef.current ?? null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return defaultRef.current ?? null;
    }
  }, [raw]);

  const setter = useCallback(
    (newValue: T | null) => {
      if (newValue === null) {
        setRaw(null);
        return;
      }
      let serialized: string;
      try {
        serialized = JSON.stringify(newValue);
      } catch (error) {
        throw new Error(
          `CloudSettings: value is not JSON-serializable: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      if (typeof serialized !== 'string') {
        throw new Error('CloudSettings: value is not JSON-serializable');
      }
      setRaw(serialized);
    },
    [setRaw]
  );

  return [value, setter] as const;
}
