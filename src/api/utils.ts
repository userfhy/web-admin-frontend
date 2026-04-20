const apiBase = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");

export const baseUrlApi = (url: string) => `${apiBase}/${url}`;
