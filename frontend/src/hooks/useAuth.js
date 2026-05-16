import { useState, useCallback, useEffect } from "react";

function decodeToken(token) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem("compilot_token"));
  const [storedUser, setStoredUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("compilot_user") ?? "null");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    function sync() {
      setToken(localStorage.getItem("compilot_token"));
      try {
        setStoredUser(JSON.parse(localStorage.getItem("compilot_user") ?? "null"));
      } catch {
        setStoredUser(null);
      }
    }
    window.addEventListener("compilot:auth", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("compilot:auth", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const payload = token ? decodeToken(token) : null;
  const isAuthenticated = !!payload && payload.exp * 1000 > Date.now();
  const user = isAuthenticated ? storedUser : null;

  const _setAndBroadcast = useCallback((t, u) => {
    if (t) {
      localStorage.setItem("compilot_token", t);
      if (u) localStorage.setItem("compilot_user", JSON.stringify(u));
    } else {
      localStorage.removeItem("compilot_token");
      localStorage.removeItem("compilot_user");
    }
    setToken(t);
    setStoredUser(u ?? null);
    window.dispatchEvent(new Event("compilot:auth"));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Login failed");
    }
    const data = await res.json();
    _setAndBroadcast(data.token, data.user);
    return data.user;
  }, [_setAndBroadcast]);

  const register = useCallback(async (email, password) => {
    const res = await fetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Registration failed");
    }
    const data = await res.json();
    _setAndBroadcast(data.token, data.user);
    return data.user;
  }, [_setAndBroadcast]);

  const logout = useCallback(() => {
    _setAndBroadcast(null, null);
  }, [_setAndBroadcast]);

  return { token, user, isAuthenticated, login, register, logout };
}
