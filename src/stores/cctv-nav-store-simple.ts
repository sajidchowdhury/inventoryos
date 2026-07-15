import { create } from 'zustand';
import type { CCTVViewType } from '@/modules/cctv-shop/types';

interface CCTVNavState {
  activeView: CCTVViewType;
  contextId: string | null;
  navigate: (view: CCTVViewType, contextId?: string) => void;
  goBack: () => void;
}

export const useCCTVNavStore = create<CCTVNavState>((set) => ({
  activeView: 'dashboard',
  contextId: null,
  navigate: (view, contextId) => set({ activeView: view, contextId: contextId ?? null }),
  goBack: () => set({ activeView: 'dashboard', contextId: null }),
}));
