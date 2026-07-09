import { create } from 'zustand';
import { useNavStore } from '@/lib/nav-store';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';

export interface BusinessTypeInfo {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

export interface BusinessInfo {
  id: string;
  name: string;
  shopCode: string;
  address: string;
  phone: string;
  businessType: BusinessTypeInfo;
}

export interface AuthSession {
  user: {
    id: string;
    name: string;
    fullName?: string;
    username?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    role?: string;
  };
  business: BusinessInfo;
}

interface AuthState {
  session: AuthSession | null;
  isAuthenticated: boolean;
  businesses: BusinessInfo[];
  setSession: (session: AuthSession) => void;
  logout: () => void;
  reset: () => void; // alias for logout — used by pharmacy module
}

function clearAll() {
  useNavStore.getState().resetNav();
  try { useCCTVNavStore.getState().reset(); } catch { /* CCTV store may not be loaded */ }
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isAuthenticated: false,
  businesses: [],
  setSession: (session) => {
    clearAll();
    set({ session, isAuthenticated: true });
  },
  logout: () => {
    clearAll();
    set({ session: null, isAuthenticated: false, businesses: [] });
  },
  reset: () => {
    clearAll();
    set({ session: null, isAuthenticated: false, businesses: [] });
  },
}));