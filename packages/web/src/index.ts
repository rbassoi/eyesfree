/**
 * @eyesfree/web — apply EyesFree optical compensation to any web page, PWA, WebView,
 * Capacitor / Ionic / Cordova / Electron / Tauri app.
 *
 * Original project: https://github.com/rbassoi/eyesfree — Apache-2.0
 */
export { EyesFree, createEyesFree, DOM_CHANGE_EVENT } from './engine.js';
export type {
  EyesFreeChangeSource,
  EyesFreeEventMap,
  EyesFreeOptions,
  EyesFreeState,
  FilterScope,
  SurfaceMode,
} from './engine.js';

export { localStorageAdapter, memoryAdapter, storageFrom } from './storage.js';
export type { StorageAdapter, StorageLike } from './storage.js';

export { DEFS_ID, filterMarkup, filterPrimitives, getDefs, planNeedsFilter, removeFilter, upsertFilter } from './svg.js';
export type { FilterColorSpace, FilterPrimitive, FilterRegion } from './svg.js';

export {
  ATTRIBUTES,
  CLASSES,
  clearVariables,
  CSS_VARS,
  cssVariables,
  ensureStyles,
  EYESFREE_CSS,
  setVariables,
  STYLE_ELEMENT_ID,
} from './styles.js';

export { applyPreview, clearPreview, simulateDefocus } from './preview.js';

export { createWorkerSource, ImageCompensator } from './worker.js';
export type { ImageCompensatorOptions, PixelBuffer } from './worker.js';
