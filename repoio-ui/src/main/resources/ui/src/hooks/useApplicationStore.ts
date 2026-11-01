import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

interface ApplicationState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  signOut: () => void;
}

/**
 * Global Zustand store for app-level state that outlives route changes:
 * auth, feature flags, UI preferences. Only durable settings live here;
 * data goes through TanStack Query.
 */
export const useApplicationStore = create<ApplicationState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      signOut: () => {
        localStorage.removeItem('repoio-token');
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'repoio-app',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
    }
  )
);
