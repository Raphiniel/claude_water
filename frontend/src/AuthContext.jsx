import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from './apiConfig';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
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
      return null;
    }
  }, []);

  const fetchMe = useCallback(async (accessToken) => {
    const res = await axios.get(`${API_BASE}/api/me/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
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
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const me = await fetchMe(token);
        setUser({ token, ...me });
      } catch (err) {
        if (err.response?.status === 401) {
          const fresh = await refreshAccessToken();
          if (fresh) {
            try {
              const me = await fetchMe(fresh);
              setUser({ token: fresh, ...me });
            } catch {
              logout();
            }
          } else {
            logout();
          }
        } else {
          logout();
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [fetchMe, refreshAccessToken, logout]);

  // ── Axios response interceptor: auto-refresh on any 401 ───────────────────
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        const url = String(originalRequest?.url || '');
        const isAuthRequest =
          url.includes('/api/token/refresh/') ||
          (url.includes('/api/token/') && String(originalRequest?.method || '').toLowerCase() === 'post');

        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !isAuthRequest
        ) {
          originalRequest._retry = true;
          const fresh = await refreshAccessToken();
          if (fresh) {
            originalRequest.headers.Authorization = `Bearer ${fresh}`;
            try {
              const me = await fetchMe(fresh);
              setUser({ token: fresh, ...me });
            } catch {
              setUser({ token: fresh });
            }
            return axios(originalRequest);
          }
          logout();
        }
        return Promise.reject(error);
      },
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [fetchMe, refreshAccessToken, logout]);

  // ── Login (stores tokens + profile from /api/me/) ─────────────────────────
  const login = useCallback(
    async (access, refresh) => {
      const me = await fetchMe(access);
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      setUser({ token: access, ...me });
    },
    [fetchMe],
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
