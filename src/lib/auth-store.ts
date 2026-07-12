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
  permissions: string[] | Record<string, boolean>;
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

/** Build a pharmacy-compatible session from the main auth store data. */
function buildBridgeSession(s: {
  sessionToken?: string;
  user: { id: string; name: string; username?: string; role?: string; fullName?: string };
  permissions?: Record<string, boolean>;
  business: {
    id: string;
    name: string;
    shopCode: string;
    address: string;
    phone?: string;
    businessType: { id: string; name: string; slug: string; icon: string; color?: string };
  };
}): LoggedInSession {
  return {
    token: s.sessionToken || `bridge_${s.user.id}`,
    user: {
      id: s.user.id,
      username: s.user.username || s.user.name.toLowerCase().replace(/\s+/g, "."),
      role: s.user.role || "owner",
      fullName: s.user.fullName || s.user.name,
    },
    permissions: s.permissions || ["*"],
    business: {
      id: s.business.id,
      name: s.business.name,
      address: s.business.address || null,
      shopCode: s.business.shopCode,
      businessType: {
        slug: s.business.businessType.slug,
        name: s.business.businessType.name,
        color: (s.business.businessType as { color?: string }).color || "emerald",
        icon: s.business.businessType.icon,
      },
    },
  };
}

/* ── Sync: When the new auth store changes, update the bridge ── */
useNewAuthStore.subscribe((newState) => {
  const currentBridge = useAuthStore.getState().session;

  if (newState.isAuthenticated && newState.session) {
    const s = newState.session;
    // Only update if business ID changed (avoid infinite loops)
    if (currentBridge?.business.id !== s.business.id) {
      useAuthStore.getState().setSession(buildBridgeSession(s));
    }
  } else if (!newState.isAuthenticated && currentBridge) {
    useAuthStore.getState().setSession(null);
  }
});

// Trigger initial sync
if (useNewAuthStore.getState().isAuthenticated) {
  const s = useNewAuthStore.getState().session!;
  useAuthStore.getState().setSession(buildBridgeSession(s));
}