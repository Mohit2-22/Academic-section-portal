const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let err;
    try {
      err = await res.json();
    } catch {
      err = { error: `HTTP ${res.status}` };
    }
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (contentType.includes('json')) return res.json();
  if (contentType.includes('csv') || contentType.includes('octet-stream') || contentType.includes('pdf')) {
    return res.blob();
  }
  return res;
}

export const api = {
  get: (url) => request(url),
  post: (url, data) => request(url, { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }),
  put: (url, data) => request(url, { method: 'PUT', body: JSON.stringify(data) }),
  del: (url) => request(url, { method: 'DELETE' }),
  upload: (url, formData) => request(url, { method: 'POST', body: formData }),
};

export default api;
