import { useCallback, useEffect, useState } from 'react';

const TOKEN_KEY = 'servicepath_token';
const API_BASE = import.meta.env.VITE_API_URL || '';

export const getToken = () => {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (token) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
};

export async function apiRequest(method, path, body) {
  const token = getToken();
  let response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the service right now. Please try again in a moment.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) window.dispatchEvent(new Event('session-expired'));
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }
  return data;
}

export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });

  const load = useCallback(async () => {
    if (!path) return;
    try {
      setState({ data: await apiRequest('GET', path), error: null, loading: false });
    } catch (error) {
      setState({ data: null, error: error.message, loading: false });
    }
  }, [path]);

  useEffect(() => {
    setState((s) => ({ ...s, loading: Boolean(path) }));
    load();
  }, [load, path]);

  return { ...state, reload: load };
}
