const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

export const api = {
  // documents
  uploadDocument: (file) => {
    const form = new FormData();
    form.append("file", file);
    return req("/documents", { method: "POST", body: form });
  },
  listDocuments: () => req("/documents"),
  getDocument: (id) => req(`/documents/${id}`),
  getDocumentFacts: (id) => req(`/documents/${id}/facts`),

  // facts
  listFacts: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    ).toString();
    return req(`/facts${qs ? "?" + qs : ""}`);
  },
  getFact: (id) => req(`/facts/${id}`),
  getFactRelationships: (id) => req(`/facts/${id}/relationships`),

  // relationships
  listRelationships: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    ).toString();
    return req(`/relationships${qs ? "?" + qs : ""}`);
  },
};
