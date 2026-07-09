import { create } from 'zustand';

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

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isAuthenticated: false,
  businesses: [],
  setSession: (session) => set({ session, isAuthenticated: true }),
  logout: () => set({ session: null, isAuthenticated: false, businesses: [] }),
  reset: () => set({ session: null, isAuthenticated: false, businesses: [] }),
}));