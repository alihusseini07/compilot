import { useState, useEffect, useCallback } from "react";

export function useCompetitors(token) {
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(false);

  const authHeaders = useCallback(() => ({
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [token]);

  const fetchCompetitors = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/competitors", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCompetitors(data.competitors || []);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors]);

  const addCompetitor = useCallback(async (company, displayName = "") => {
    const res = await fetch("/competitors", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ company, display_name: displayName || company }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to add competitor");
    }
    const newComp = await res.json();
    setCompetitors((prev) => [newComp, ...prev]);
    return newComp;
  }, [authHeaders]);

  const removeCompetitor = useCallback(async (company) => {
    const res = await fetch(`/competitors/${encodeURIComponent(company)}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error("Failed to remove competitor");
    }
    setCompetitors((prev) => prev.filter((c) => c.company !== company));
  }, [token]);

  return { competitors, loading, addCompetitor, removeCompetitor, refetch: fetchCompetitors };
}
