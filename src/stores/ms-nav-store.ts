import { create } from 'zustand';
import type { MSViewType } from '@/modules/mobile-shop/types';

interface MSNavState {
  activeView: MSViewType;
  contextId: string | null;
  previousView: MSViewType | null;
  viewHistory: MSViewType[];

  navigate: (view: MSViewType, contextId?: string) => void;
  goBack: () => void;
  reset: () => void;
}

const initialState: Omit<MSNavState, 'navigate' | 'goBack' | 'reset'> = {
  activeView: 'dashboard',
  contextId: null,
  previousView: null,
  viewHistory: [],
};

export const useMSNavStore = create<MSNavState>((set, get) => ({
  ...initialState,

  navigate: (view: MSViewType, contextId?: string) => {
    const { activeView, viewHistory } = get();
    set({
      previousView: activeView,
      activeView: view,
      contextId: contextId ?? null,
      viewHistory: [...viewHistory.slice(-19), activeView],
    });
  },

  goBack: () => {
    const { viewHistory } = get();
    if (viewHistory.length === 0) {
      set({ activeView: 'dashboard', previousView: null, contextId: null });
      return;
    }
    const prev = viewHistory[viewHistory.length - 1];
    set({
      activeView: prev,
      previousView: get().activeView,
      contextId: null,
      viewHistory: viewHistory.slice(0, -1),
    });
  },

  reset: () => set(initialState),
}));