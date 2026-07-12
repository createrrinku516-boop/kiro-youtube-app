const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://good-chicken-tap.loca.lt/api';

const getHeaders = (data?: any) => {
  const headers: any = {
    'bypass-tunnel-reminder': 'true' // bypass localtunnel interstitial
  };
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

export const apiClient = {
  get: async (endpoint: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: getHeaders()
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'API request failed');
    }
    return response.json();
  },

  post: async (endpoint: string, data: any) => {
    const isFormData = data instanceof FormData;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(data),
      body: isFormData ? data : JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'API request failed');
    }
    return response.json();
  },

  put: async (endpoint: string, data: any) => {
    const isFormData = data instanceof FormData;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(data),
      body: isFormData ? data : JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'API request failed');
    }
    return response.json();
  },

  delete: async (endpoint: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'API request failed');
    }
    return response.json();
  },
};
