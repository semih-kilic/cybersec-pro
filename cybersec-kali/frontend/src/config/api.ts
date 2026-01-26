export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const apiUrl = (path: string) => {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  return API_URL ? `${API_URL}${path}` : path;
};
