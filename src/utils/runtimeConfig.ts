const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

const resolveApiBaseUrl = (): string => {
  const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!configuredBaseUrl) {
    return '';
  }

  return trimTrailingSlashes(configuredBaseUrl);
};

const API_BASE_URL = resolveApiBaseUrl();

export const resolveProxyEndpoint = (path: string): string => {
  if (!API_BASE_URL) {
    return path;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const getApiBaseUrl = (): string => API_BASE_URL;
