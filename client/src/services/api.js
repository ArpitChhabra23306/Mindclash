import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    getMe: () => api.get('/auth/me'),
    logout: () => api.post('/auth/logout'),
};

// User API
export const userAPI = {
    getProfile: (username) => api.get(`/users/profile/${username}`),
    updateProfile: (data) => api.put('/users/profile', data),
    follow: (userId) => api.post(`/users/follow/${userId}`),
    unfollow: (userId) => api.delete(`/users/follow/${userId}`),
    getDebates: (userId, page = 1) => api.get(`/users/${userId}/debates?page=${page}`),
    search: (query) => api.get(`/users/search?q=${query}`),
};

// Debate API
export const debateAPI = {
    getLive: (category) => api.get(`/debates/live${category ? `?category=${category}` : ''}`),
    getFeatured: () => api.get('/debates/featured'),
    getById: (id) => api.get(`/debates/${id}`),
    getReplay: (id) => api.get(`/debates/${id}/replay`),
    generateTopic: (data) => api.post('/debates/generate-topic', data),
    assist: (data) => api.post('/debates/assist', data),
};

// Leaderboard API
export const leaderboardAPI = {
    getGlobal: (page = 1) => api.get(`/leaderboard/global?page=${page}`),
    getWeekly: () => api.get('/leaderboard/weekly'),
    getCategory: (category) => api.get(`/leaderboard/category/${category}`),
    getAnonymous: () => api.get('/leaderboard/anonymous'),
};

// Topic API
export const topicAPI = {
    getAll: (params) => api.get('/topics', { params }),
    getTrending: () => api.get('/topics/trending'),
    getFeatured: () => api.get('/topics/featured'),
    getRandom: (category) => api.get(`/topics/random${category ? `?category=${category}` : ''}`),
    generate: (data) => api.post('/topics/generate', data),
    suggest: (data) => api.post('/topics/suggest', data),
    like: (id) => api.post(`/topics/${id}/like`),
};

// Community API
export const communityAPI = {
    getAll: (params) => api.get('/communities', { params }),
    getById: (id) => api.get(`/communities/${id}`),
    create: (data) => api.post('/communities', data),
    join: (id) => api.post(`/communities/${id}/join`),
    leave: (id) => api.delete(`/communities/${id}/leave`),
};

// Marketplace API
export const marketplaceAPI = {
    getItems: (params) => api.get('/marketplace', { params }),
    getFeatured: () => api.get('/marketplace/featured'),
    purchase: (itemId) => api.post(`/marketplace/purchase/${itemId}`),
    getPurchases: () => api.get('/marketplace/my-purchases'),
};

export default api;
