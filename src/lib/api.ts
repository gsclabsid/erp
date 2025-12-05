// API client for backend API
// In browser, always use relative path to go through Vite proxy
// In Node.js (server-side), use the full URL if provided
const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    // Server-side: use full URL if provided
    return import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }
  // Browser: always use relative path to go through Vite proxy
  return '/api';
};

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // If endpoint is already a full URL, use it as-is (for external APIs)
  // Otherwise, prepend the base URL
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${getApiBaseUrl()}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => apiRequest<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, data?: any) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  put: <T>(endpoint: string, data?: any) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: <T>(endpoint: string) => apiRequest<T>(endpoint, { method: 'DELETE' }),
};

