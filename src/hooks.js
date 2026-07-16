import { useState, useEffect } from 'react';

// State mirrored to localStorage: reads once on mount (falling back to `initial`
// on a missing key or parse error), writes back on every change. `raw` stores
// the value as a plain string instead of JSON — use it for values that were
// historically written unquoted (e.g. sample-set keys).
export function usePersistentState(key, initial, { raw = false } = {}) {
  const [val, setVal] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      if (s == null) return typeof initial === 'function' ? initial() : initial;
      return raw ? s : JSON.parse(s);
    } catch { return typeof initial === 'function' ? initial() : initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, raw ? val : JSON.stringify(val)); } catch { /* quota / disabled */ }
  }, [key, val, raw]);
  return [val, setVal];
}
