import { create } from 'zustand';
import type { UserResponse } from '@itdesk/shared';

interface AuthState {
  accessToken: string | null;
  user: UserResponse | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string) => void;
  setUser: (user: UserResponse) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setTokens: (accessToken) =>
    set({ accessToken, isAuthenticated: true }),

  setUser: (user) => set({ user }),

  logout: () =>
    set({ accessToken: null, user: null, isAuthenticated: false }),
}));
