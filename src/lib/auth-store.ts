// ── Auth Store Bridge ──
// Adapts the new landing-page auth store (@/stores/auth-store)
// to the format the pharmacy module expects.
// Pharmacy components import useAuthStore from here.

import { create } from "zustand";
import { useAuthStore as useNewAuthStore } from "@/stores/auth-store";

/* ── Types that pharmacy components expect ── */
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
}

export interface LoggedInSession {
  token: string;
  user: { id: string; username: string; role: string; fullName?: string };
  permissions: string[];
  business: BusinessInfo;
}

/* ── Bridge Store ── */
interface AuthState {
  session: LoggedInSession | null;
  setSession: (session: LoggedInSession | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  setSession: (session) => set({ session }),
  logout: () => {
    set({ session: null });
    useNewAuthStore.getState().logout();
  },
}));

/* ── Sync: When the new auth store changes, update the bridge ── */
useNewAuthStore.subscribe((newState) => {
  const currentBridge = get().session;

  if (newState.isAuthenticated && newState.session) {
    const s = newState.session;
    // Only update if business ID changed (avoid infinite loops)
    if (currentBridge?.business.id !== s.business.id) {
      const mapped: LoggedInSession = {
        token: `bridge_${s.user.id}`,
        user: {
          id: s.user.id,
          username: s.user.name.toLowerCase().replace(/\s+/g, "."),
          role: "owner",
          fullName: s.user.name,
        },
        permissions: ["*"], // Full access for now
        business: {
          id: s.business.id,
          name: s.business.name,
          address: s.business.address || null,
          shopCode: s.business.shopCode,
          businessType: {
            slug: s.business.businessType.slug,
            name: s.business.businessType.name,
            color: "emerald",
            icon: s.business.businessType.icon,
          },
        },
      };
      set({ session: mapped });
    }
  } else if (!newState.isAuthenticated && currentBridge) {
    set({ session: null });
  }
});

// Trigger initial sync
if (useNewAuthStore.getState().isAuthenticated) {
  const s = useNewAuthStore.getState().session!;
  useAuthStore.getState().setSession({
    token: `bridge_${s.user.id}`,
    user: {
      id: s.user.id,
      username: s.user.name.toLowerCase().replace(/\s+/g, "."),
      role: "owner",
      fullName: s.user.name,
    },
    permissions: ["*"],
    business: {
      id: s.business.id,
      name: s.business.name,
      address: s.business.address || null,
      shopCode: s.business.shopCode,
      businessType: {
        slug: s.business.businessType.slug,
        name: s.business.businessType.name,
        color: "emerald",
        icon: s.business.businessType.icon,
      },
    },
  });
}