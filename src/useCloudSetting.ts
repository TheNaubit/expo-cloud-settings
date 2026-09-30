import { useCallback, useMemo } from 'react';

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
  const parsed = raw === 'true' ? true : raw === 'false' ? false : null;
  const value = parsed ?? defaultValue ?? null;

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
  const parsed = raw === null || raw.trim().length === 0 ? NaN : Number(raw);
  const value = Number.isFinite(parsed) ? parsed : (defaultValue ?? null);

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

  // Parse only when the stored string changes so the returned object keeps its identity
  const parsed = useMemo((): { readonly ok: boolean; readonly value: T | null } => {
    if (raw === null) return { ok: false, value: null };
    try {
      return { ok: true, value: JSON.parse(raw) as T };
    } catch {
      return { ok: false, value: null };
    }
  }, [raw]);

  const value = parsed.ok ? parsed.value : (defaultValue ?? null);

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
