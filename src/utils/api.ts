// @ts-nocheck
import realData from '../data/realData.json';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getHeaders = (data) => {
  const headers = {};
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

// Simple offline API mocker
const mockApi = async (endpoint) => {
  if (endpoint.startsWith('/videos/related') || endpoint.match(/\/videos\/[a-zA-Z0-9_-]+\/related/)) {
    // Return 10 random videos for related
    return [...realData].sort(() => 0.5 - Math.random()).slice(0, 10);
  }
  if (endpoint.startsWith('/videos/shorts')) {
    return [...realData].sort(() => 0.5 - Math.random()).slice(0, 5).map(v => ({...v, isShort: true}));
  }
  if (endpoint.startsWith('/videos/') && endpoint !== '/videos/') {
    const id = endpoint.split('/')[2];
    const video = realData.find(v => v.id === id || v.youtube_id === id) || realData[0];
    return video;
  }
  if (endpoint.startsWith('/videos')) {
    // Parse query params if any
    const [path, query] = endpoint.split('?');
    let category = 'All';
    let searchQuery = '';
    
    if (query) {
      const params = new URLSearchParams(query);
      category = params.get('category') || 'All';
      searchQuery = params.get('search') || '';
    }
    
    let filtered = realData;
    if (category !== 'All') {
      filtered = filtered.filter(v => (v.category || 'All').toLowerCase() === category.toLowerCase());
    }
    if (searchQuery) {
      filtered = filtered.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    return {
      videos: filtered.slice(0, 50),
      totalPages: 1,
      currentPage: 1
    };
  }
  if (endpoint.startsWith('/comments/')) {
    return [
      { id: 1, userId: 1, userName: 'Offline User', avatar: 'https://ui-avatars.com/api/?name=O', text: 'Amazing video!', likes: 5, time: '2 hours ago' }
    ];
  }
  return null;
};

export const apiClient = {
  get: async (endpoint) => {
    try {
      const offlineData = await mockApi(endpoint);
      if (offlineData) return offlineData;
    } catch (e) {
      console.error("Offline Mock Error", e);
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: getHeaders()
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'API request failed');
    }
    return response.json();
  },

  post: async (endpoint, data) => {
    if (endpoint === '/ai/ask') {
      return { success: true, answer: "I'm currently offline, but this is a great video!" };
    }
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

  put: async (endpoint, data) => {
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

  delete: async (endpoint) => {
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
