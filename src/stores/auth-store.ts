import { create } from 'zustand';

export interface BusinessTypeInfo {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color?: string;
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
  sessionToken?: string;
  expiresAt?: string;
  user: {
    id: string;
    name: string;
    username?: string;
    role?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    avatar?: string;
  };
  permissions?: Record<string, boolean>;
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