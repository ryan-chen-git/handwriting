import { useCallback, useState } from 'react';

// Stub of Overleaf's shared/hooks/use-persisted-state. They add event-bus
// fan-out across tabs; for our single-tab use a plain localStorage read/write
// on init and on every set is enough.
export default function usePersistedState<T>(
  key: string,
  defaultValue: T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  });

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    },
    [key],
  );

  return [value, update];
}
