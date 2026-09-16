import { createContext, type RefObject } from 'react';
export type JourneyNavigation = {
  url: string;
  guard: ((proceed: () => void) => void) | null;
};
export const Navigation = createContext<RefObject<JourneyNavigation> | null>(null);
