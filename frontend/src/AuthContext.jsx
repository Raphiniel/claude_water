import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_BASE = 'http://localhost:8000';

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Token refresh ──────────────────────────────────────────────────────────
  const refreshAccessToken = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) return null;

    try {
      const res = await axios.post(`${API_BASE}/api/token/refresh/`, { refresh });
      const newAccess = res.data.access;
      localStorage.setItem('access_token', newAccess);
      return newAccess;
    } catch {
      // Refresh token is also expired — full logout
      return null;
    }
  }, []);

  // ── Hard logout (clears storage + state) ──────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  }, []);

  // ── On mount: validate stored token or try refresh ────────────────────────
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) { setLoading(false); return; }

      // Quick check: try hitting a protected endpoint with the stored token
      try {
        await axios.get(`${API_BASE}/api/waterpoints/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser({ token });
      } catch (err) {
        if (err.response?.status === 401) {
          // Token is invalid/expired — try a silent refresh
          const fresh = await refreshAccessToken();
          if (fresh) {
            setUser({ token: fresh });
          } else {
            // Both tokens are dead — clear everything
            logout();
          }
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [refreshAccessToken, logout]);

  // ── Axios response interceptor: auto-refresh on any 401 ───────────────────
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Only retry once (avoid infinite loops)
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          const fresh = await refreshAccessToken();
          if (fresh) {
            originalRequest.headers['Authorization'] = `Bearer ${fresh}`;
            setUser({ token: fresh });
            return axios(originalRequest);
          } else {
            logout();
          }
        }
        return Promise.reject(error);
      },
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [refreshAccessToken, logout]);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback((access, refresh) => {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    setUser({ token: access });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
