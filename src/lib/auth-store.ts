// ── InventoryOS: Auth Store ──
// Manages the multi-step authentication flow state

import { create } from "zustand";

export type AppStep =
  | "landing"        // Hero page with explanation
  | "phone"          // Enter phone number
  | "otp"            // Enter OTP code
  | "discovery"      // Show existing businesses or empty state
  | "add-business"   // Select business type + enter details
  | "create-login"   // Create admin username & password
  | "login"          // Login with username & password
  | "dashboard";     // Logged in!

export interface BusinessInfo {
  id: string;
  name: string;
  address: string | null;
  businessType: {
    slug: string;
    name: string;
    color: string;
    icon: string;
  };
  hasCredentials: boolean;
  businessUsers: { id: string; username: string; role: string }[];
}

export interface LoggedInSession {
  token: string;
  user: { id: string; username: string; role: string };
  business: {
    id: string;
    name: string;
    address: string | null;
    businessType: { slug: string; name: string; color: string; icon: string };
  };
}

interface AuthState {
  // Current step in the flow
  step: AppStep;
  setStep: (step: AppStep) => void;

  // Phone number
  phone: string;
  setPhone: (phone: string) => void;

  // User info (after OTP verified)
  userId: string | null;
  userName: string | null;
  setUserId: (id: string) => void;
  setUserName: (name: string | null) => void;

  // Businesses linked to this phone
  businesses: BusinessInfo[];
  setBusinesses: (businesses: BusinessInfo[]) => void;

  // Selected business (for login)
  selectedBusiness: BusinessInfo | null;
  setSelectedBusiness: (business: BusinessInfo | null) => void;

  // Selected business type slug for new registration
  selectedBusinessTypeSlug: string;
  setSelectedBusinessTypeSlug: (slug: string) => void;

  // New business details (during registration)
  newBusinessName: string;
  setNewBusinessName: (name: string) => void;
  newBusinessAddress: string;
  setNewBusinessAddress: (address: string) => void;

  // Login credentials
  username: string;
  setUsername: (username: string) => void;
  password: string;
  setPassword: (password: string) => void;

  // Logged-in session
  session: LoggedInSession | null;
  setSession: (session: LoggedInSession | null) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Reset everything
  reset: () => void;
}

const initialState = {
  step: "landing" as AppStep,
  phone: "",
  userId: null,
  userName: null,
  businesses: [],
  selectedBusiness: null,
  selectedBusinessTypeSlug: "pharmacy",
  newBusinessName: "",
  newBusinessAddress: "",
  username: "",
  password: "",
  session: null,
  isLoading: false,
  error: null,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,

  setStep: (step) => set({ step, error: null }),
  setPhone: (phone) => set({ phone }),
  setUserId: (id) => set({ userId: id }),
  setUserName: (name) => set({ userName: name }),
  setBusinesses: (businesses) => set({ businesses }),
  setSelectedBusiness: (business) => set({ selectedBusiness: business }),
  setSelectedBusinessTypeSlug: (slug) => set({ selectedBusinessTypeSlug: slug }),
  setNewBusinessName: (name) => set({ newBusinessName: name }),
  setNewBusinessAddress: (address) => set({ newBusinessAddress: address }),
  setUsername: (username) => set({ username }),
  setPassword: (password) => set({ password }),
  setSession: (session) => set({ session }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
