import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import { isAdminUser } from '@/lib/access';
import type { AppUser, LoginResponse, UserRole } from '@/types/auth';

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  sector: string;
  active?: boolean;
}

interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  sector?: string;
  active?: boolean;
}

interface AuthState {
  token: string | null;
  user: AppUser | null;
  users: AppUser[];
  loading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  createUser: (input: CreateUserInput) => Promise<void>;
  updateUser: (id: string, input: UpdateUserInput) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  setError: (message: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      users: [],
      loading: false,
      error: null,

      login: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const data = await api.post<LoginResponse>('/api/auth/login', { email, password });
          localStorage.setItem('lawcrm-token', data.token);
          set({ token: data.token, user: data.user, loading: false });
        } catch (error) {
          set({ loading: false, error: error instanceof Error ? error.message : 'Falha no login' });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('lawcrm-token');
        set({ token: null, user: null, users: [], error: null });
      },

      fetchMe: async () => {
        const token = localStorage.getItem('lawcrm-token');
        if (!token) {
          set({ token: null, user: null });
          return;
        }

        set({ loading: true, error: null, token });
        try {
          const data = await api.get<{ user: AppUser }>('/api/auth/me');
          set({ user: data.user, loading: false });
        } catch (error) {
          localStorage.removeItem('lawcrm-token');
          set({ token: null, user: null, loading: false, users: [] });
          throw error;
        }
      },

      fetchUsers: async () => {
        if (!isAdminUser(get().user)) {
          return;
        }
        const data = await api.get<{ users: AppUser[] }>('/api/users');
        set({ users: data.users });
      },

      createUser: async (input) => {
        await api.post('/api/users', input);
        await get().fetchUsers();
      },

      updateUser: async (id, input) => {
        await api.put(`/api/users/${id}`, input);
        await get().fetchUsers();
        if (get().user?.id === id) {
          await get().fetchMe();
        }
      },

      deleteUser: async (id) => {
        await api.delete(`/api/users/${id}`);
        await get().fetchUsers();
      },

      setError: (message) => set({ error: message }),
    }),
    {
      name: 'lawcrm-auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
