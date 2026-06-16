import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE,
  withCredentials: true,
});

// ── Attach access token ────────────────────────────────────────────
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('accessToken');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ── Auto-refresh on 401 ────────────────────────────────────────────
let refreshing = false;
let queue = [];

api.interceptors.response.use(
  r => r,
  async err => {
    const orig = err.config;
    if (err.response?.status === 401 && !orig._retry) {
      if (refreshing) {
        return new Promise((res, rej) => queue.push({ res, rej }))
          .then(token => { orig.headers.Authorization = `Bearer ${token}`; return api(orig); });
      }
      orig._retry = true;
      refreshing = true;
      try {
        const { data } = await axios.post(`${BASE}/auth/refresh`, {}, { withCredentials: true });
        const newToken = data.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        queue.forEach(p => p.res(newToken));
        queue = [];
        orig.headers.Authorization = `Bearer ${newToken}`;
        return api(orig);
      } catch (e) {
        queue.forEach(p => p.rej(e));
        queue = [];
        localStorage.removeItem('accessToken');
        window.location.href = '/';
      } finally { refreshing = false; }
    }
    return Promise.reject(err);
  }
);

// ── Auth ───────────────────────────────────────────────────────────
export const authAPI = {
  login:         (d) => api.post('/auth/login', d),
  register:      (d) => api.post('/auth/register', d),
  logout:        ()  => api.post('/auth/logout'),
  refresh:       ()  => api.post('/auth/refresh'),
  forgotPassword:(d) => api.post('/auth/forgot-password', d),
  resetPassword: (d) => api.post('/auth/reset-password', d),
  googleLogin:   (d) => api.post('/auth/google', d),
  appleLogin:    (d) => api.post('/auth/apple', d),
};

// ── Agencies ───────────────────────────────────────────────────────
export const agencyAPI = {
  listPublic:       (p) => api.get('/agencies', { params: p }),
  listAdmin:        (p) => api.get('/agencies/admin', { params: p }),
  getStats:         ()  => api.get('/agencies/stats'),
  register:         (d) => api.post('/agencies', d),
  getOne:           (id)=> api.get(`/agencies/${id}`),
  updateStatus:     (id, d) => api.patch(`/agencies/${id}/status`, d),
  toggleVisibility: (id)    => api.patch(`/agencies/${id}/visibility`),
  submitRating:     (id, d) => api.post(`/agencies/${id}/ratings`, d),
  getRatings:       (id, p) => api.get(`/agencies/${id}/ratings`, { params: p }),
  getTrips:         (id, p) => api.get(`/agencies/${id}/trips`, { params: p }),
};

// ── Users ──────────────────────────────────────────────────────────
export const userAPI = {
  getMe:       ()      => api.get('/users/me'),
  updateMe:    (d)     => api.patch('/users/me', d),
  list:        (p)     => api.get('/users', { params: p }),
  create:      (d)     => api.post('/users', d),
  getOne:      (id)    => api.get(`/users/${id}`),
  update:      (id, d) => api.put(`/users/${id}`, d),
  updateStatus:(id, d) => api.patch(`/users/${id}/status`, d),
};

// ── Notifications ──────────────────────────────────────────────────
export const notificationAPI = {
  list:        (p)  => api.get('/notifications', { params: p }),
  unreadCount: ()   => api.get('/notifications/unread-count'),
  markRead:    (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: ()   => api.patch('/notifications/read-all'),
  remove:      (id) => api.delete(`/notifications/${id}`),
};

// ── Vehicles ───────────────────────────────────────────────────────
export const vehicleAPI = {
  list:        (p)     => api.get('/vehicles', { params: p }),
  create:      (d)     => api.post('/vehicles', d),
  getOne:      (id)    => api.get(`/vehicles/${id}`),
  update:      (id, d) => api.put(`/vehicles/${id}`, d),
  updateStatus:(id, d) => api.patch(`/vehicles/${id}/status`, d),
};

// ── Routes ─────────────────────────────────────────────────────────
export const routeAPI = {
  list:   (p)     => api.get('/routes', { params: p }),
  create: (d)     => api.post('/routes', d),
  getOne: (id)    => api.get(`/routes/${id}`),
  update: (id, d) => api.put(`/routes/${id}`, d),
};

// ── Trips ──────────────────────────────────────────────────────────
export const tripAPI = {
  list:     (p)  => api.get('/trips', { params: p }),
  create:   (d)  => api.post('/trips', d),
  start:    (id) => api.patch(`/trips/${id}/start`),
  end:      (id) => api.patch(`/trips/${id}/end`),
  getSeats: (id) => api.get(`/trips/${id}/seats`),
};

// ── Bookings ───────────────────────────────────────────────────────
export const bookingAPI = {
  create:    (d)  => api.post('/bookings', d),
  myBookings:(p)  => api.get('/bookings/my', { params: p }),
  getOne:    (id) => api.get(`/bookings/${id}`),
  cancel:    (id) => api.delete(`/bookings/${id}`),
};

// ── Incidents ──────────────────────────────────────────────────────
export const incidentAPI = {
  submit:  (d)     => api.post('/incidents', d),
  list:    (p)     => api.get('/incidents', { params: p }),
  resolve: (id, d) => api.patch(`/incidents/${id}/resolve`, d),
};

// ── Analytics ──────────────────────────────────────────────────────
export const analyticsAPI = {
  overview:         (p) => api.get('/analytics/overview', { params: p }),
  peakHours:        (p) => api.get('/analytics/peak-hours', { params: p }),
  vehicleStatus:    (p) => api.get('/analytics/vehicle-status', { params: p }),
  routePerformance: (p) => api.get('/analytics/route-performance', { params: p }),
  driverPerformance:(p) => api.get('/analytics/driver-performance', { params: p }),
};

export const aiAPI = {
  fleetChat: (message) => api.post('/ai/fleet-chat', { message }),
};

// ── GPS ────────────────────────────────────────────────────────────
export const gpsAPI = {
  livePositions: (agencyId) => api.get(`/gps/live/${agencyId}`),
  tripHistory:   (tripId, p)=> api.get(`/gps/${tripId}`, { params: p }),
};

export default api;
