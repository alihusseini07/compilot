const HISTORY_LIMITS = { daily: 30, weekly: 12, monthly: 12 };

export async function fetchLatest(company) {
  const res = await fetch(`/reports/${encodeURIComponent(company)}/latest`);
  if (!res.ok) throw new Error("Failed to fetch latest reports");
  return res.json();
}

export async function fetchHistory(company, type, limit) {
  const cap = limit ?? HISTORY_LIMITS[type] ?? 30;
  const res = await fetch(`/reports/${encodeURIComponent(company)}/${type}?limit=${cap}`);
  if (!res.ok) throw new Error(`Failed to fetch ${type} history`);
  const data = await res.json();
  return data.reports || [];
}

export async function triggerAnalysis(company, mode, token, date) {
  const headers = token ? { "Authorization": `Bearer ${token}` } : {};
  const params = new URLSearchParams({ mode });
  if (date) params.set("date", date);
  const res = await fetch(`/analyze/${encodeURIComponent(company)}?${params}`, {
    method: "POST",
    headers,
  });
  if (res.status === 422) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Not enough data to generate this report.");
  }
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}
