import { createRenderPlan, encodeProfile, INACTIVE_PLAN, normalizeProfile, parseProfile, serializeProfile } from '@eyesfree/core';
import type { RenderPlan, VisionProfile } from '@eyesfree/core';

/** `@react-native-async-storage/async-storage`, `expo-secure-store` wrappers, MMKV adapters… */
export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

export interface NativeState {
  ready: boolean;
  profile: VisionProfile | null;
  plan: RenderPlan;
}

/** Headless profile store for React Native (no DOM). */
export class EyesFreeNativeStore {
  private state: NativeState = { ready: false, profile: null, plan: { ...INACTIVE_PLAN } };
  private listeners = new Set<(s: NativeState) => void>();
  private initPromise: Promise<VisionProfile | null> | null = null;

  constructor(
    private readonly storage: AsyncStorageLike | null = null,
    private readonly storageKey = 'eyesfree:profile',
    private readonly onError?: (error: unknown) => void,
  ) {}

  init(initialProfile?: Partial<VisionProfile> | string | null): Promise<VisionProfile | null> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        let profile: VisionProfile | null = null;
        if (this.storage) {
          try {
            profile = parseProfile(await this.storage.getItem(this.storageKey));
          } catch (e) {
            this.onError?.(e);
          }
        }
        if (!profile && initialProfile) profile = parseProfile(initialProfile);
        this.set(this.state.profile ?? profile, true);
        return this.state.profile;
      })();
    }
    return this.initPromise;
  }

  getState = (): NativeState => this.state;

  subscribe = (listener: (s: NativeState) => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  apply(patch: Partial<VisionProfile>): VisionProfile {
    const next = {
      ...normalizeProfile({ ...(this.state.profile ?? {}), enabled: true, ...patch }),
      updatedAt: new Date().toISOString(),
    };
    this.set(next);
    this.persist(next);
    return next;
  }

  update(patch: Partial<VisionProfile>): VisionProfile {
    return this.apply({ enabled: this.state.profile?.enabled ?? true, ...patch });
  }

  enable(): VisionProfile {
    return this.apply({ enabled: true });
  }

  disable(): VisionProfile | null {
    return this.state.profile ? this.apply({ ...this.state.profile, enabled: false }) : null;
  }

  toggle(): VisionProfile | null {
    return this.state.plan.active ? this.disable() : this.enable();
  }

  reset(): void {
    this.set(null);
    if (this.storage) {
      Promise.resolve()
        .then(() => this.storage!.removeItem(this.storageKey))
        .catch((e) => this.onError?.(e));
    }
  }

  getShareCode(): string | null {
    return this.state.profile ? encodeProfile(this.state.profile) : null;
  }

  importProfile(raw: unknown): VisionProfile | null {
    const p = parseProfile(raw);
    return p ? this.apply(p) : null;
  }

  private set(profile: VisionProfile | null, ready = this.state.ready): void {
    this.state = { ready, profile, plan: createRenderPlan(profile) };
    for (const l of this.listeners) l(this.state);
  }

  private persist(profile: VisionProfile): void {
    if (!this.storage) return;
    Promise.resolve()
      .then(() => this.storage!.setItem(this.storageKey, serializeProfile(profile)))
      .catch((e) => this.onError?.(e));
  }
}
