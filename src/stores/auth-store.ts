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
    email: string;
    avatar?: string;
  };
  business: BusinessInfo;
}

interface AuthState {
  session: AuthSession | null;
  isAuthenticated: boolean;
  setSession: (session: AuthSession) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isAuthenticated: false,
  setSession: (session) => set({ session, isAuthenticated: true }),
  logout: () => set({ session: null, isAuthenticated: false }),
}));