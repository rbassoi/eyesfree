# Vue · Angular · Svelte · Solid · Lit

All of these use the framework-agnostic engine (`@eyesfree/web`) and the `<eyesfree-calibrator>` Web Component.

```bash
npm install @eyesfree/web @eyesfree/calibrator
```

## Vue 3 / Nuxt

```ts
// eyesfree.ts: one shared engine plus a reactive ref
import { shallowRef } from 'vue';
import { createEyesFree } from '@eyesfree/web';
import '@eyesfree/calibrator/define';

export const eyesfree = createEyesFree({ root: '#app' });
export const eyesfreeState = shallowRef(eyesfree.getState());
eyesfree.subscribe((s) => (eyesfreeState.value = s));
```

```ts
// vite.config.ts: tell Vue that eyesfree-* tags are custom elements
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('eyesfree-') } } });
```

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { eyesfree, eyesfreeState } from './eyesfree';
const cal = ref<HTMLElement & { engine: unknown; start(): void }>();
onMounted(() => { cal.value!.engine = eyesfree; cal.value!.start(); });
</script>

<template>
  <eyesfree-calibrator ref="cal" locale="en" @eyesfree-complete="$router.push('/')" />
  <p v-if="eyesfreeState.plan.active">Reading mode is on</p>
</template>
```

With Nuxt, create the engine in a client-only plugin (`plugins/eyesfree.client.ts`).

## Angular

```ts
// app.config.ts / main.ts
import { createEyesFree } from '@eyesfree/web';
import { defineCalibrator } from '@eyesfree/calibrator';
defineCalibrator();
export const EYESFREE = new InjectionToken('eyesfree', { factory: () => createEyesFree({ root: 'app-root' }) });
```

```ts
@Component({
  selector: 'app-vision',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<eyesfree-calibrator #cal locale="en" (eyesfree-complete)="done()"></eyesfree-calibrator>`,
})
export class VisionComponent implements AfterViewInit {
  @ViewChild('cal') cal!: ElementRef;
  engine = inject(EYESFREE);
  router = inject(Router);
  ngAfterViewInit() { this.cal.nativeElement.engine = this.engine; this.cal.nativeElement.start(); }
  done() { this.router.navigateByUrl('/'); }
}
```

For signals: `state = signal(engine.getState()); engine.subscribe(s => this.state.set(s));`

## Svelte / SvelteKit

```ts
// eyesfree.ts
import { readable } from 'svelte/store';
import { createEyesFree } from '@eyesfree/web';
import '@eyesfree/calibrator/define';

export const engine = createEyesFree({ root: 'body' });
export const eyesfree = readable(engine.getState(), (set) => engine.subscribe(set));
```

```svelte
<script>
  import { onMount } from 'svelte';
  import { engine, eyesfree } from './eyesfree';
  let cal;
  onMount(() => { cal.engine = engine; cal.start(); });
</script>

<eyesfree-calibrator bind:this={cal} on:eyesfree-complete={() => history.back()} />
{#if $eyesfree.plan.active}<p>Reading mode on</p>{/if}
```

In SvelteKit, import `eyesfree.ts` only in the browser (`if (browser)`, or from `onMount`).

## SolidJS

```tsx
const engine = createEyesFree();
const [state, setState] = createSignal(engine.getState());
engine.subscribe(setState);
```

## Lit

```ts
@customElement('my-settings')
class MySettings extends LitElement {
  render() { return html`<eyesfree-calibrator .engine=${engine} @eyesfree-complete=${this.done}></eyesfree-calibrator>`; }
}
```

> **Shadow DOM caveat:** the wizard's preview filters live in the main document. Browsers do not consistently resolve `url(#id)` from inside a shadow root to document-level SVG definitions. If your component renders `<eyesfree-calibrator>` inside its own shadow root, test the previews in every target browser. Otherwise, render the calibrator in light DOM or call `openCalibratorDialog()`.
