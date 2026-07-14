import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api';
import { clearCache } from '../utils/cache';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setUser(u); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = () => {
      // Only flag expiry when someone was actually signed in — the initial
      // /me probe also 401s for logged-out visitors.
      if (userRef.current) setSessionExpired(true);
      setUser(null);
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  const errorMessage = (detail, fallback) => {
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map(d => d?.msg).filter(Boolean).join('; ') || fallback;
    }
    return fallback;
  };

  const login = async (email, password) => {
    const r = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(errorMessage(body.detail, 'Could not sign in. Please try again.'));
    }
    const { user: u } = await r.json();
    clearCache();
    setSessionExpired(false);
    setUser(u);
    return u;
  };

  const register = async (name, email, password) => {
    const r = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(errorMessage(body.detail, 'Could not create account. Please try again.'));
    }
    const { user: u } = await r.json();
    clearCache();
    setSessionExpired(false);
    setUser(u);
    return u;
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    clearCache();
    setUser(null);
  };

  const updateUser = (userData) => setUser(prev => ({ ...prev, ...userData }));

  const refreshUser = async () => {
    const r = await apiFetch('/api/auth/me');
    if (r.ok) setUser(await r.json());
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, updateUser, sessionExpired, dismissSessionExpired: () => setSessionExpired(false) }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
