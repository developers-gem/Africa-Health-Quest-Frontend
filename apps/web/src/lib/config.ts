/** Public build-time configuration. Never place secrets in VITE_* variables — they ship to the browser. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000").replace(
  /\/+$/,
  "",
);
