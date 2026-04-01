// ─────────────────────────────────────────────────────────────────
// NCAGP — useData hook
// File: src/lib/useData.ts
//
// Fixes stale data problem:
// 1. Refreshes when user navigates back to the tab
// 2. Refreshes when window regains focus
// 3. Provides manual refresh
// 4. Shows loading/error state
// ─────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseDataOptions {
  refreshOnFocus?: boolean;     // Re-fetch when tab gets focus (default: true)
  refreshOnVisible?: boolean;   // Re-fetch when user comes back to tab (default: true)
  pollInterval?: number;        // Auto-poll in ms (default: 0 = no polling)
}

export function useData<T>(
  fetcher: () => Promise<T>,
  deps: any[] = [],
  options: UseDataOptions = {},
) {
  const { refreshOnFocus = true, refreshOnVisible = true, pollInterval = 0 } = options;

  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mounted.current) setData(result);
    } catch (err: any) {
      if (mounted.current) setError(err.message || 'Failed to load data');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, deps); // eslint-disable-line

  // Initial load
  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
  }, [load]);

  // Refresh on window focus — fixes "navigate back and data is stale"
  useEffect(() => {
    if (!refreshOnFocus) return;
    const onFocus = () => load(true); // silent = true (no loading spinner)
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load, refreshOnFocus]);

  // Refresh when tab becomes visible again
  useEffect(() => {
    if (!refreshOnVisible) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load, refreshOnVisible]);

  // Optional polling
  useEffect(() => {
    if (!pollInterval) return;
    const id = setInterval(() => load(true), pollInterval);
    return () => clearInterval(id);
  }, [load, pollInterval]);

  return {
    data,
    loading,
    error,
    refresh: () => load(false),
    silentRefresh: () => load(true),
    setData,
  };
}

// ── Typed API fetcher ──────────────────────────────────────────────

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('ncagp_token')
    : null;

  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}
