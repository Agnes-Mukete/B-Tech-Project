import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user:        null,
      accessToken: null,
      loading:     false,
      error:       null,

      login: async (identifier, password) => {
        set({ loading: true, error: null });
        try {
          const { data } = await authAPI.login({ identifier, password });
          const { accessToken, user } = data.data;
          localStorage.setItem('accessToken', accessToken);
          set({ user, accessToken, loading: false });
          return { ok: true, user };
        } catch (err) {
          const msg = err.response?.data?.message || 'Login failed';
          set({ error: msg, loading: false });
          return { ok: false, error: msg };
        }
      },

      logout: async () => {
        try { await authAPI.logout(); } catch (_) {}
        localStorage.removeItem('accessToken');
        set({ user: null, accessToken: null });
      },

      register: async (payload) => {
        set({ loading: true, error: null });
        try {
          const { data } = await authAPI.register(payload);
          const { accessToken, user } = data.data;
          localStorage.setItem('accessToken', accessToken);
          set({ user, accessToken, loading: false });
          return { ok: true, user };
        } catch (err) {
          const msg = err.response?.data?.message || 'Registration failed';
          set({ error: msg, loading: false });
          return { ok: false, error: msg };
        }
      },

      socialLogin: async (provider, payload) => {
        set({ loading: true, error: null });
        try {
          const fn = provider === 'google' ? authAPI.googleLogin : authAPI.appleLogin;
          const { data } = await fn(payload);
          const { accessToken, user } = data.data;
          localStorage.setItem('accessToken', accessToken);
          set({ user, accessToken, loading: false });
          return { ok: true, user };
        } catch (err) {
          const msg = err.response?.data?.message || `${provider} login failed`;
          set({ error: msg, loading: false });
          return { ok: false, error: msg };
        }
      },

      clearError: () => set({ error: null }),

      isAuthenticated: () => !!get().user && !!get().accessToken,
      isAdmin:         () => ['admin', 'superAdmin'].includes(get().user?.role),
      isSuperAdmin:    () => ['admin', 'superAdmin'].includes(get().user?.role),
      isAgencyAdmin:   () => get().user?.role === 'agencyAdmin',
      isFleetManager:  () => ['agencyAdmin', 'fleetManager'].includes(get().user?.role),
      isDriver:        () => get().user?.role === 'driver',
      isPassenger:     () => get().user?.role === 'passenger',
    }),
    {
      name: 'movesmart-auth',
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken }),
    }
  )
);

export default useAuthStore;
