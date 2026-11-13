import { createContext } from 'react';
import type { EyesFreeNativeStore } from './store.js';

/** Internal React context shared by the provider, hooks and the calibrator. */
export const StoreContextBridge = createContext<EyesFreeNativeStore | null>(null);
