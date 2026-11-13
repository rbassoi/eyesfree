import {
  createRenderPlan,
  decodeProfile,
  encodeProfile,
  INACTIVE_PLAN,
  normalizeProfile,
  parseProfile,
  serializeProfile,
} from '@eyesfree/core';
import type { RenderPlan, VisionProfile } from '@eyesfree/core';
import { localStorageAdapter } from './storage.js';
import type { StorageAdapter } from './storage.js';
import { CLASSES, clearVariables, cssVariables, ensureStyles, setVariables } from './styles.js';
import { removeFilter, upsertFilter } from './svg.js';
import type { FilterColorSpace } from './svg.js';

/** Where the optical filter is applied. */
export type FilterScope =
  /** Whole root element (simplest; images and icons are sharpened too). */
  | 'root'
  /** Only elements marked with `data-eyesfree-text` (best performance / precise control). */
  | 'opt-in'
  /** Never apply the SVG filter (spacing + text shadows only). */
  | 'none';

/** How surface compensation (luminance headroom) is achieved. */
export type SurfaceMode =
  /** Tone-map the rendered pixels inside the SVG filter (zero CSS changes needed). */
  | 'tone'
  /** Restyle backgrounds with the EyesFree palette via CSS (`data-eyesfree-surface`). */
  | 'palette'
  /** Both. */
  | 'both';

export interface EyesFreeOptions {
  /** Element (or CSS selector) that receives the compensation. Default: `document.body`. */
  root?: HTMLElement | string | null;
  /** Persistence backend; `false` disables persistence. Default: `localStorage`. */
  storage?: StorageAdapter | false;
  /** Storage key. Default `eyesfree:profile`. */
  storageKey?: string;
  /** Restore the saved profile on `init()`. Default `true`. */
  autoRestore?: boolean;
  /**
   * Query/hash parameter carrying a profile code (`?eyesfree=EF1.nm211.100.100`), so native
   * shells, QR codes and support links can hand a profile to the web app. `false` disables.
   * Default `eyesfree`.
   */
  urlParam?: string | false;
  /** Filter scope. Default `root`. */
  scope?: FilterScope;
  /** Surface compensation strategy. Default `tone`. */
  surfaceMode?: SurfaceMode;
  /**
   * Apply the profile's `fontScale` by zooming the root's children (CSS `zoom`, which
   * reflows layout like browser zoom). Set `false` if your app handles text size itself
   * via the `--eyesfree-font-scale` variable. Default `true`.
   */
  magnify?: boolean;
  /** Synchronise profile changes across tabs with `BroadcastChannel`. Default `true`. */
  sync?: boolean;
  /** Inject the stylesheet automatically. Set `false` if you ship `eyesfree.css`. Default `true`. */
  injectStyles?: boolean;
  /** CSP nonce for the injected `<style>`. */
  nonce?: string;
  /** SVG filter id. Default `eyesfree-filter`. */
  filterId?: string;
  /** Filter colour space. Default `sRGB`. */
  colorSpace?: FilterColorSpace;
  /** Document to operate on (iframes, tests). Default: global `document`. */
  document?: Document;
}

export interface EyesFreeState {
  /** `true` once `init()` finished restoring. */
  ready: boolean;
  /** Current profile (may be disabled), or `null` when the user never calibrated / reset. */
  profile: VisionProfile | null;
  /** Derived render plan (inactive when profile is null or disabled). */
  plan: RenderPlan;
}

export type EyesFreeChangeSource = 'init' | 'apply' | 'reset' | 'sync' | 'url';

export interface EyesFreeEventMap {
  change: { state: EyesFreeState; source: EyesFreeChangeSource };
  error: { error: unknown; operation: 'load' | 'save' | 'remove' };
}

/** DOM event dispatched on the document for framework-free listeners. */
export const DOM_CHANGE_EVENT = 'eyesfree:change';

const CHANNEL_NAME = 'eyesfree';

type Listener<T> = (payload: T) => void;

/**
 * The EyesFree engine: owns the profile, persists it, and renders it onto a root element.
 *
 * ```ts
 * const eyesfree = new EyesFree({ root: '#app' });
 * await eyesfree.init();                       // restores the saved profile
 * eyesfree.apply({ sharpness: 'strong' });     // applies + persists
 * eyesfree.subscribe(state => console.log(state.profile));
 * ```
 */
export class EyesFree {
  readonly options: Readonly<Required<Omit<EyesFreeOptions, 'root' | 'storage' | 'nonce' | 'document'>>> & {
    storage: StorageAdapter | false;
    nonce: string | undefined;
  };

  private rootOption: HTMLElement | string | null | undefined;
  private renderedRoot: HTMLElement | null = null;
  private docRef: Document | undefined;
  private state: EyesFreeState = { ready: false, profile: null, plan: { ...INACTIVE_PLAN } };
  private readonly listeners = new Set<Listener<EyesFreeState>>();
  private readonly handlers: { [K in keyof EyesFreeEventMap]: Set<Listener<EyesFreeEventMap[K]>> } = {
    change: new Set(),
    error: new Set(),
  };
  private channel: BroadcastChannel | null = null;
  private initPromise: Promise<VisionProfile | null> | null = null;
  private destroyed = false;
  private suspensions = 0;

  constructor(options: EyesFreeOptions = {}) {
    this.rootOption = options.root;
    this.docRef = options.document;
    this.options = {
      storage: options.storage === false ? false : (options.storage ?? localStorageAdapter()),
      storageKey: options.storageKey ?? 'eyesfree:profile',
      autoRestore: options.autoRestore ?? true,
      urlParam: options.urlParam ?? 'eyesfree',
      scope: options.scope ?? 'root',
      surfaceMode: options.surfaceMode ?? 'tone',
      magnify: options.magnify ?? true,
      sync: options.sync ?? true,
      injectStyles: options.injectStyles ?? true,
      nonce: options.nonce,
      filterId: options.filterId ?? 'eyesfree-filter',
      colorSpace: options.colorSpace ?? 'sRGB',
    };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Restores the profile (URL parameter first, then storage) and renders it.
   * Idempotent: calling it again returns the same promise.
   */
  init(): Promise<VisionProfile | null> {
    if (this.destroyed) {
      // Re-initialising after destroy() (e.g. React StrictMode double mount).
      this.destroyed = false;
      this.initPromise = null;
    }
    if (!this.initPromise) this.initPromise = this.doInit();
    return this.initPromise;
  }

  /** Resolves when `init()` completes (calls `init()` if needed). */
  get ready(): Promise<VisionProfile | null> {
    return this.init();
  }

  private async doInit(): Promise<VisionProfile | null> {
    this.openChannel();
    let source: EyesFreeChangeSource = 'init';
    let profile: VisionProfile | null = this.readUrlProfile();
    if (profile) {
      source = 'url';
      void this.persist(profile);
    } else if (this.options.autoRestore && this.options.storage) {
      try {
        profile = parseProfile(await this.options.storage.get(this.options.storageKey));
      } catch (error) {
        this.emit('error', { error, operation: 'load' });
      }
    }
    if (this.destroyed) return null;
    // A call to apply() during init wins over the restored value.
    const current = this.state.profile ?? profile;
    this.setState({ ready: true, profile: current }, source);
    return current;
  }

  /**
   * Removes everything EyesFree added to the DOM and stops cross-tab sync. Subscribers are
   * kept, so calling `init()` again fully revives the engine.
   */
  destroy(): void {
    this.destroyed = true;
    this.unrender();
    this.channel?.close();
    this.channel = null;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** Current immutable state snapshot (stable reference until the next change). */
  getState(): EyesFreeState {
    return this.state;
  }

  /** Current profile or `null`. */
  getProfile(): VisionProfile | null {
    return this.state.profile;
  }

  /** `true` when compensation is currently being rendered. */
  isActive(): boolean {
    return this.state.plan.active;
  }

  /**
   * Applies (and by default persists) a profile. Partial input is merged with the current
   * profile (or the defaults), so `apply({ sharpness: 'strong' })` works.
   */
  apply(profile: Partial<VisionProfile>, options: { persist?: boolean } = {}): VisionProfile {
    const next: VisionProfile = {
      ...normalizeProfile({ ...(this.state.profile ?? {}), enabled: true, ...profile }),
      updatedAt: new Date().toISOString(),
    };
    this.setState({ profile: next }, 'apply');
    if (options.persist !== false) void this.persist(next);
    this.broadcast(next);
    return next;
  }

  /** Alias of {@link apply} that keeps the current `enabled` flag. */
  update(patch: Partial<VisionProfile>, options?: { persist?: boolean }): VisionProfile {
    const enabled = this.state.profile?.enabled ?? true;
    return this.apply({ enabled, ...patch }, options);
  }

  /** Turns compensation on (using the saved profile or the defaults). */
  enable(): VisionProfile {
    return this.apply({ enabled: true });
  }

  /** Turns compensation off but keeps the profile, so it can be re-enabled with one tap. */
  disable(): VisionProfile | null {
    if (!this.state.profile) return null;
    return this.apply({ ...this.state.profile, enabled: false });
  }

  /**
   * Temporarily stops rendering without touching the profile — e.g. while the calibrator
   * is open inside the compensated root, so previews are not compensated twice.
   * Suspensions nest; rendering resumes when every returned function has been called.
   */
  suspend(): () => void {
    this.suspensions++;
    this.render();
    let resumed = false;
    return () => {
      if (resumed) return;
      resumed = true;
      this.suspensions = Math.max(0, this.suspensions - 1);
      this.render();
    };
  }

  /** `true` while at least one {@link suspend} is in effect. */
  isSuspended(): boolean {
    return this.suspensions > 0;
  }

  /** Toggles compensation. */
  toggle(): VisionProfile | null {
    return this.state.plan.active ? this.disable() : this.enable();
  }

  /** Forgets the profile entirely (storage included) and restores normal rendering. */
  reset(): void {
    this.setState({ profile: null }, 'reset');
    if (this.options.storage) {
      Promise.resolve()
        .then(() => (this.options.storage as StorageAdapter).remove(this.options.storageKey))
        .catch((error) => this.emit('error', { error, operation: 'remove' }));
    }
    this.broadcast(null);
  }

  // ---------------------------------------------------------------------------
  // Root element
  // ---------------------------------------------------------------------------

  /** Changes the root element at runtime (e.g. after a framework mounts). */
  setRoot(root: HTMLElement | string | null): void {
    this.unrender();
    this.rootOption = root;
    this.render();
  }

  /** The element compensation is rendered on (resolved lazily). */
  getRoot(): HTMLElement | null {
    const doc = this.doc;
    if (!doc) return null;
    const r = this.rootOption;
    if (r === null || r === undefined) return doc.body;
    if (typeof r === 'string') return doc.querySelector<HTMLElement>(r);
    return r;
  }

  // ---------------------------------------------------------------------------
  // Sharing
  // ---------------------------------------------------------------------------

  /** Compact profile code (`EF1.…`) for QR codes, deep links, native ↔ web hand-off. */
  getShareCode(): string | null {
    return this.state.profile ? encodeProfile(this.state.profile) : null;
  }

  /** URL that carries the current profile in the configured query parameter. */
  getShareUrl(base?: string): string | null {
    const code = this.getShareCode();
    const param = this.options.urlParam;
    if (!code || !param) return null;
    const href = base ?? (typeof location !== 'undefined' ? location.href : 'https://example.invalid/');
    const url = new URL(href);
    url.searchParams.set(param, code);
    return url.toString();
  }

  /** Serialised profile (JSON) — e.g. to sync with your backend. */
  exportProfile(): string | null {
    return this.state.profile ? serializeProfile(this.state.profile) : null;
  }

  /** Imports a JSON string, a profile code or an object. Returns the applied profile or `null`. */
  importProfile(raw: unknown, options?: { persist?: boolean }): VisionProfile | null {
    const p = parseProfile(raw);
    return p ? this.apply(p, options) : null;
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * Subscribes to state changes. Compatible with React's `useSyncExternalStore`, Vue
   * `watchEffect`-style wrappers, Svelte `readable`, RxJS `fromEventPattern`, etc.
   * @returns an unsubscribe function
   */
  subscribe(listener: Listener<EyesFreeState>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Typed event listener. @returns an unsubscribe function */
  on<K extends keyof EyesFreeEventMap>(type: K, handler: Listener<EyesFreeEventMap[K]>): () => void {
    this.handlers[type].add(handler);
    return () => this.handlers[type].delete(handler);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private get doc(): Document | null {
    if (this.docRef) return this.docRef;
    return typeof document !== 'undefined' ? document : null;
  }

  private emit<K extends keyof EyesFreeEventMap>(type: K, payload: EyesFreeEventMap[K]): void {
    for (const h of this.handlers[type]) {
      try {
        h(payload);
      } catch (e) {
        console.error('[eyesfree] listener error', e);
      }
    }
  }

  private setState(patch: Partial<Omit<EyesFreeState, 'plan'>>, source: EyesFreeChangeSource): void {
    if (this.destroyed) return;
    const profile = patch.profile !== undefined ? patch.profile : this.state.profile;
    this.state = {
      ready: patch.ready ?? this.state.ready,
      profile,
      plan: createRenderPlan(profile),
    };
    this.render();
    for (const l of this.listeners) {
      try {
        l(this.state);
      } catch (e) {
        console.error('[eyesfree] subscriber error', e);
      }
    }
    this.emit('change', { state: this.state, source });
    const doc = this.doc;
    if (doc && typeof CustomEvent !== 'undefined') {
      doc.dispatchEvent(new CustomEvent(DOM_CHANGE_EVENT, { detail: { ...this.state, source } }));
    }
  }

  private async persist(profile: VisionProfile): Promise<void> {
    if (!this.options.storage) return;
    try {
      await this.options.storage.set(this.options.storageKey, serializeProfile(profile));
    } catch (error) {
      this.emit('error', { error, operation: 'save' });
    }
  }

  private readUrlProfile(): VisionProfile | null {
    const param = this.options.urlParam;
    if (!param || typeof location === 'undefined') return null;
    try {
      const url = new URL(location.href);
      const fromQuery = url.searchParams.get(param);
      const fromHash = new URLSearchParams(url.hash.replace(/^#/, '')).get(param);
      const code = fromQuery ?? fromHash;
      return code ? decodeProfile(code) : null;
    } catch {
      return null;
    }
  }

  private openChannel(): void {
    if (!this.options.sync || typeof BroadcastChannel === 'undefined' || this.channel) return;
    try {
      this.channel = new BroadcastChannel(`${CHANNEL_NAME}:${this.options.storageKey}`);
      this.channel.onmessage = (ev: MessageEvent) => {
        const data = ev.data as { profile?: unknown } | null;
        if (!data || !('profile' in data)) return;
        this.setState({ profile: data.profile === null ? null : normalizeProfile(data.profile) }, 'sync');
      };
    } catch {
      this.channel = null;
    }
  }

  private broadcast(profile: VisionProfile | null): void {
    try {
      this.channel?.postMessage({ profile });
    } catch {
      /* ignore */
    }
  }

  private render(): void {
    const doc = this.doc;
    const root = this.getRoot();
    if (!doc || !root) return;
    if (this.renderedRoot && this.renderedRoot !== root) this.unrender();

    const { plan } = this.state;
    if (!plan.active || this.suspensions > 0) {
      this.unrender();
      return;
    }

    if (this.options.injectStyles) ensureStyles(doc, this.options.nonce);

    const { surfaceMode, scope, filterId, colorSpace } = this.options;
    const filterPlan = surfaceMode === 'palette' ? { ...plan, tone: null } : plan;
    const filterValue = scope === 'none' ? 'none' : upsertFilter(filterId, filterPlan, { doc, colorSpace });

    setVariables(root, cssVariables(plan, filterValue));
    root.classList.add(CLASSES.active);
    root.classList.toggle(CLASSES.scopeRoot, scope === 'root');
    root.classList.toggle(CLASSES.scopeOptIn, scope === 'opt-in');
    root.classList.toggle(CLASSES.palette, surfaceMode !== 'tone' && plan.surface !== null);
    root.classList.toggle(CLASSES.zoom, this.options.magnify && plan.fontScale !== 1);
    root.setAttribute('data-eyesfree', 'on');
    this.renderedRoot = root;
  }

  private unrender(): void {
    const root = this.renderedRoot;
    if (root) {
      root.classList.remove(CLASSES.active, CLASSES.scopeRoot, CLASSES.scopeOptIn, CLASSES.palette, CLASSES.zoom);
      root.removeAttribute('data-eyesfree');
      clearVariables(root);
    }
    const doc = this.doc;
    if (doc) removeFilter(this.options.filterId, doc);
    this.renderedRoot = null;
  }
}

/** Creates an engine and starts `init()` immediately. Await `engine.ready` if you need to. */
export function createEyesFree(options?: EyesFreeOptions): EyesFree {
  const engine = new EyesFree(options);
  void engine.init();
  return engine;
}
