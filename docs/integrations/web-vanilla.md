# Plain HTML / CMS / static sites

## Option A: zero code

```html
<script src="https://unpkg.com/@eyesfree/browser@0.1.0/dist/eyesfree.min.js"
        data-eyesfree-auto data-root="main" data-locale="en" defer></script>

<button data-eyesfree-open>👓 No glasses?</button>
<button data-eyesfree-toggle>Reading mode on/off</button>
```

## Option B: a few lines of JavaScript

```html
<script src="https://unpkg.com/@eyesfree/browser@0.1.0/dist/eyesfree.min.js"></script>
<script>
  const { engine, open } = eyesfree.mount({ root: '#app', locale: 'pt-BR' });

  document.querySelector('#glasses').addEventListener('click', open);

  engine.subscribe(({ plan, profile }) => {
    document.querySelector('#badge').textContent = plan.active ? 'Reading mode ON' : '';
  });
</script>
```

## Option C: ES modules, no bundler

```html
<script type="module">
  import { mount } from 'https://cdn.jsdelivr.net/npm/@eyesfree/browser@0.1.0/dist/eyesfree.esm.min.js';
  mount({ root: 'body' });
</script>
```

## Inline wizard instead of a dialog

```html
<eyesfree-calibrator id="cal" locale="es" sample-text="Su cita es el 12/03 a las 14:30"></eyesfree-calibrator>
<script>
  const { engine } = eyesfree.mount();
  const cal = document.querySelector('#cal');
  cal.engine = engine;
  cal.start();
  cal.addEventListener('eyesfree-complete', () => (location.hash = '#home'));
</script>
```

## WordPress

Enqueue the script in your theme's `functions.php`:

```php
wp_enqueue_script('eyesfree', 'https://unpkg.com/@eyesfree/browser@0.1.0/dist/eyesfree.min.js', [], null, true);
wp_add_inline_script('eyesfree', "eyesfree.mount({ root: '.site' });");
```

Then add a Custom HTML block with `<button data-eyesfree-open>👓 No glasses?</button>`.

## Strict Content-Security-Policy

```html
<link rel="stylesheet" href="/vendor/eyesfree.css">
<script src="/vendor/eyesfree.min.js"></script>
<script nonce="…">
  eyesfree.mount({ injectStyles: false });
  const compensator = new eyesfree.ImageCompensator({ workerUrl: '/vendor/eyesfree.worker.js' });
</script>
```

Copy the three files from `node_modules/@eyesfree/browser/dist/`. The calibrator injects a small stylesheet, so pass `nonce` on the element (`<eyesfree-calibrator nonce="…">`) or allow it via `style-src 'nonce-…'`.
