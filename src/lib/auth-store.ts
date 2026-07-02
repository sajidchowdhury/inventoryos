// ── InventoryOS: Auth Store ──
// Manages the multi-step authentication flow state with session persistence

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppStep =
  | "landing"        // Hero page with the two doors
  | "phone"          // Owner door: enter phone number
  | "otp"            // Owner door: enter OTP code
  | "discovery"      // Owner door: pick a business (straight in, no password)
  | "add-business"   // Owner door: select business type + enter details
  | "create-login"   // Owner door: create admin username & password
  | "login"          // (legacy) per-business username & password
  | "staff-login"    // Staff door: shop code + username + password
  | "dashboard";     // Logged in!

export type AccountType = "owner" | "staff";

export interface BusinessInfo {
  id: string;
  name: string;
  address: string | null;
  shopCode?: string | null;
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
  user: { id: string; username: string; role: string; fullName?: string };
  permissions: string[];
  business: {
    id: string;
    name: string;
    address: string | null;
    shopCode?: string | null;
    businessType: { slug: string; name: string; color: string; icon: string };
  };
}

interface AuthState {
  // Current step in the flow
  step: AppStep;
  setStep: (step: AppStep) => void;

  // Which door the user is going through ("owner" via OTP, or "staff" via shop code)
  accountType: AccountType | null;
  setAccountType: (type: AccountType | null) => void;

  // Phone number
  phone: string;
  setPhone: (phone: string) => void;

  // Short-lived proof that the phone was OTP-verified (used by owner-login).
  phoneToken: string | null;
  setPhoneToken: (token: string | null) => void;

  // Long-lived trusted-device token (persisted) — lets this device skip OTP.
  deviceToken: string | null;
  setDeviceToken: (token: string | null) => void;

  // Whether the owner opted to trust this device during OTP.
  trustDevice: boolean;
  setTrustDevice: (trust: boolean) => void;

  // Staff door: the shop code (or shop phone) the staff member is logging into.
  staffShopKey: string;
  setStaffShopKey: (key: string) => void;

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

  // Loading states (NOT persisted)
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Reset everything
  reset: () => void;
}

const initialState = {
  step: "landing" as AppStep,
  accountType: null as AccountType | null,
  phone: "",
  phoneToken: null as string | null,
  trustDevice: false,
  staffShopKey: "",
  userId: null,
  userName: null,
  businesses: [] as BusinessInfo[],
  selectedBusiness: null as BusinessInfo | null,
  selectedBusinessTypeSlug: "pharmacy",
  newBusinessName: "",
  newBusinessAddress: "",
  username: "",
  password: "",
  session: null as LoggedInSession | null,
  isLoading: false,
  error: null as string | null,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...initialState,
      // deviceToken lives outside initialState so reset()/"Start Over" keeps the
      // device trusted; it is only cleared on explicit logout.
      deviceToken: null as string | null,

      setStep: (step) => set({ step, error: null }),
      setAccountType: (accountType) => set({ accountType }),
      setPhone: (phone) => set({ phone }),
      setPhoneToken: (phoneToken) => set({ phoneToken }),
      setDeviceToken: (deviceToken) => set({ deviceToken }),
      setTrustDevice: (trustDevice) => set({ trustDevice }),
      setStaffShopKey: (staffShopKey) => set({ staffShopKey }),
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

      reset: () =>
        set({
          ...initialState,
          isLoading: false,
          error: null,
        }),
    }),
    {
      name: "inventoryos-auth",
      // Only persist these fields — never persist loading/error/short-lived tokens.
      // deviceToken is persisted so a returning owner can skip OTP; phoneToken is
      // intentionally NOT persisted (short-lived, re-issued each visit).
      partialize: (state) => ({
        step: state.step,
        accountType: state.accountType,
        phone: state.phone,
        userId: state.userId,
        userName: state.userName,
        businesses: state.businesses,
        selectedBusiness: state.selectedBusiness,
        selectedBusinessTypeSlug: state.selectedBusinessTypeSlug,
        session: state.session,
        deviceToken: state.deviceToken,
      }),
    }
  )
);
