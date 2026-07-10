'use client';

import { useAuthStore } from '@/stores/auth-store';

/**
 * Returns the current business ID from the auth session.
 * All CCTV module components should use this instead of hardcoded BUSINESS_ID.
 */
export function useCctvBusinessId(): string {
  const session = useAuthStore((s) => s.session);
  return session?.business?.id ?? '';
}