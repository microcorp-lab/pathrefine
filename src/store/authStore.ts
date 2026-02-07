// Stub store - Authentication not available in open source version
import { create } from 'zustand';

interface AuthStore {
  user: null;
  session: null;
  isPro: boolean;
  initialize: () => void;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isPro: false,
  initialize: () => {},
  refreshSession: async () => {},
  signOut: async () => {},
}));
