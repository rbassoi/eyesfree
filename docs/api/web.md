# `@eyesfree/web` API

The DOM engine, storage adapters, SVG and CSS helpers, and the Web Worker image compensator.

```bash
npm install @eyesfree/web
```

## `new EyesFree(options?)` / `createEyesFree(options?)`

`createEyesFree` builds the engine and calls `init()` right away.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `root` | `HTMLElement \| string \| null` | `document.body` | Element (or selector) that receives compensation. Resolved lazily. |
| `storage` | `StorageAdapter \| false` | `localStorageAdapter()` | Persistence; `false` disables it. |
| `storageKey` | `string` | `'eyesfree:profile'` | |
| `autoRestore` | `boolean` | `true` | Restore the saved profile in `init()`. |
| `urlParam` | `string \| false` | `'eyesfree'` | Query/hash parameter carrying an EF1 code. |
| `scope` | `'root' \| 'opt-in' \| 'none'` | `'root'` | Where the SVG filter applies ([details](../architecture.md#filter-scopes)). |
| `surfaceMode` | `'tone' \| 'palette' \| 'both'` | `'tone'` | How luminance headroom is created ([details](../architecture.md#surface-modes)). |
| `magnify` | `boolean` | `true` | Apply `fontScale` with CSS `zoom` on the root's children, so layout reflows. Set `false` to handle size yourself via `--eyesfree-font-scale`. |
| `sync` | `boolean` | `true` | Cross-tab sync via `BroadcastChannel`. |
| `injectStyles` | `boolean` | `true` | Set `false` if you ship `@eyesfree/web/eyesfree.css`. |
| `nonce` | `string` | | CSP nonce for the injected `<style>`. |
| `filterId` | `string` | `'eyesfree-filter'` | |
| `colorSpace` | `'sRGB' \| 'linearRGB'` | `'sRGB'` | |
| `document` | `Document` | global | For iframes and tests. |

### Methods

| Method | Returns | Description |
|---|---|---|
| `init()` | `Promise<VisionProfile \| null>` | Restores (URL first, then storage) and renders. Idempotent. Re-arms after `destroy()`. |
| `ready` | `Promise<…>` | Getter equivalent to `init()`. |
| `apply(partial, { persist? })` | `VisionProfile` | Merges with the current profile, enables, renders, persists, broadcasts. |
| `update(partial)` | `VisionProfile` | Like `apply` but keeps the current `enabled` flag. |
| `enable()` / `disable()` / `toggle()` | | `disable` keeps the profile for one-tap re-enable. |
| `reset()` | `void` | Forgets the profile (storage included). |
| `suspend()` | `() => void` | Pauses rendering until the returned function is called. Nests. |
| `isActive()` / `isSuspended()` | `boolean` | |
| `getState()` | `{ ready, profile, plan }` | Immutable snapshot (stable reference between changes). |
| `getProfile()` | `VisionProfile \| null` | |
| `subscribe(listener)` | unsubscribe fn | Works with `useSyncExternalStore`, Svelte `readable`, RxJS… |
| `on('change' \| 'error', handler)` | unsubscribe fn | `change` payload: `{ state, source }` with `source` = `init \| apply \| reset \| sync \| url`. |
| `setRoot(el \| selector)` | | Moves compensation to another element. |
| `getRoot()` | `HTMLElement \| null` | |
| `getShareCode()` | `string \| null` | EF1 code. |
| `getShareUrl(base?)` | `string \| null` | URL with `?eyesfree=EF1…`. |
| `exportProfile()` / `importProfile(raw)` | | JSON / JSON, EF1 or object. |
| `destroy()` | | Removes DOM artefacts and stops sync. |

### DOM event

`document` receives `eyesfree:change` (`DOM_CHANGE_EVENT`) with `detail = { ready, profile, plan, source }`, so code outside any framework can react:

```js
document.addEventListener('eyesfree:change', (e) => console.log(e.detail.profile));
```

### Markup hooks

| Attribute | Effect |
|---|---|
| `data-eyesfree-ignore` | Element and subtree keep their own spacing and text-shadow. |
| `data-eyesfree-text` | With `scope: 'opt-in'`, only these elements get the SVG filter. |
| `data-eyesfree-surface` | With `surfaceMode: 'palette' \| 'both'`, gets the surface colour. |

### CSS custom properties (set on the root)

`--eyesfree-filter`, `--eyesfree-text-shadow`, `--eyesfree-text-stroke`, `--eyesfree-letter-spacing`, `--eyesfree-word-spacing`, `--eyesfree-font-scale`, `--eyesfree-font-weight-delta`, `--eyesfree-bg`, `--eyesfree-surface-bg`, `--eyesfree-border`, `--eyesfree-fg`.

Use them in your own CSS:

```css
.eyesfree-active .price { font-size: calc(1.25rem * var(--eyesfree-font-scale, 1)); }
```

## Storage adapters

```ts
interface StorageAdapter {
  get(key): string | null | undefined | Promise<…>;
  set(key, value): void | Promise<void>;
  remove(key): void | Promise<void>;
}
```

| Factory | Description |
|---|---|
| `localStorageAdapter(storage?)` | Never throws (private mode, quota, sandbox). |
| `memoryAdapter(initial?)` | In-memory, with `dump()` for tests. |
| `storageFrom(obj)` | Wraps any `getItem/setItem/removeItem` object (localStorage, sessionStorage, AsyncStorage, localForage…). |

Backend sync example: [integrations/backend-sync.md](../integrations/backend-sync.md).

## `ImageCompensator`

```ts
const c = new ImageCompensator({ mode: 'auto', workerUrl?: '/eyesfree.worker.js' });
await c.compensateCanvas(canvas, engine.getState().plan);       // in place
const out = await c.process(imageData, profileOrPlan);            // ImageData-like
const canvasEl = await c.compensateImage(imgElement, profile);    // new canvas
c.usesWorker;  // true when running in a Worker
c.terminate();
```

| Option | Default | Description |
|---|---|---|
| `mode` | `'auto'` | `'worker'` rejects when no worker can be created; `'main-thread'` never spawns one. |
| `workerUrl` | inline `blob:` | Static worker script, for strict CSP. Ship `@eyesfree/browser/worker`. |
| `pixelRatio` | auto | Buffer pixels per CSS px (converts the blur radius). `compensateCanvas` derives it from the canvas' CSS size. |

`createWorkerSource()` returns the worker script as a string.

## Low-level helpers

| Export | Description |
|---|---|
| `applyPreview(el, profileOrPlan, { filterId })` | Inline preview on one element (used by the wizard). Clips the filter to the element. |
| `clearPreview(el)` | |
| `simulateDefocus(el, { blurPx?, contrast? })` | Dev tool: blurs an element like an uncorrected eye (default σ 2.5 px ≈ +2.00 D at 30–40 cm). Returns an undo fn. |
| `upsertFilter(id, plan, { doc?, colorSpace?, region?, backdrop? })` / `removeFilter(id)` | Manage SVG filters. `region`: `default`, `element` or `padded`. |
| `filterPrimitives(plan, backdrop?)` | The filter as data (tag + attributes), e.g. to port it to another renderer. |
| `filterMarkup(id, plan)` | Static SVG string (SSR, copy-paste). |
| `cssVariables(plan, filterValue)` | Map of CSS variables. |
| `ensureStyles(doc, nonce?)`, `EYESFREE_CSS`, `CLASSES`, `ATTRIBUTES`, `CSS_VARS` | Stylesheet primitives. |
