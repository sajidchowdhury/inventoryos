'use client';

import { useAuthStore } from '@/stores/auth-store';

export function useCCTVBusinessId(): string {
  const session = useAuthStore((s) => s.session);
  return session?.business?.id ?? '';
}
