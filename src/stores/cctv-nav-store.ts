import { create } from 'zustand';
import type { CCTVViewType } from '@/modules/cctv-shop/types';

interface CCTVNavState {
  activeView: CCTVViewType;
  contextId: string | null;
  previousView: CCTVViewType | null;
  viewHistory: CCTVViewType[];

  navigate: (view: CCTVViewType, contextId?: string) => void;
  goBack: () => void;
  reset: () => void;
}

const initialState: Omit<CCTVNavState, 'navigate' | 'goBack' | 'reset'> = {
  activeView: 'dashboard',
  contextId: null,
  previousView: null,
  viewHistory: [],
};

export const useCCTVNavStore = create<CCTVNavState>((set, get) => ({
  ...initialState,

  navigate: (view: CCTVViewType, contextId?: string) => {
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