const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || response.statusText || 'Request failed');
  }

  if (response.status === 204) return null;
  return response.json();
}
