import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) { setLoading(false); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (u) { setToken(t); setUser(u); }
        else localStorage.removeItem('token');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!r.ok) throw new Error((await r.json()).detail);
    const { token: t, user: u } = await r.json();
    localStorage.setItem('token', t); setToken(t); setUser(u);
    return u;
  };

  const register = async (name, email, password) => {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    if (!r.ok) throw new Error((await r.json()).detail);
    const { token: t, user: u } = await r.json();
    localStorage.setItem('token', t); setToken(t); setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem('token'); setToken(null); setUser(null);
  };

  const updateUser = (userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  };

  const refreshUser = async () => {
    const t = localStorage.getItem('token');
    if (!t) return;
    const r = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } });
    if (r.ok) setUser(await r.json());
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
