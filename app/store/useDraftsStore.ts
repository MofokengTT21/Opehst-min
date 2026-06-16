import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DraftsState {
  drafts: Record<string, string>;
  setDraft: (key: string, text: string) => void;
  removeDraft: (key: string) => void;
  clearAllDrafts: () => void;
}

export const useDraftsStore = create<DraftsState>()(
  persist(
    (set) => ({
      drafts: {},
      setDraft: (key, text) =>
        set((state) => {
          if (!text || text.trim().length === 0) {
            const newDrafts = { ...state.drafts };
            delete newDrafts[key];
            return { drafts: newDrafts };
          }
          return { drafts: { ...state.drafts, [key]: text } };
        }),
      removeDraft: (key) =>
        set((state) => {
          const newDrafts = { ...state.drafts };
          delete newDrafts[key];
          return { drafts: newDrafts };
        }),
      clearAllDrafts: () => set({ drafts: {} }),
    }),
    {
      name: 'opehst-drafts-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
