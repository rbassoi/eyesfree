# Capacitor · Ionic · Cordova · Electron · Tauri · native WebViews

Hybrid apps render HTML, so they use the web engine directly. The interesting part is **sharing the profile with the native side**, so a user who calibrates in the native app doesn't have to repeat it in an embedded WebView (or the other way round).

## Capacitor / Ionic

```ts
import { Preferences } from '@capacitor/preferences';
import { createEyesFree } from '@eyesfree/web';
import { openCalibratorDialog } from '@eyesfree/calibrator';

const capacitorStorage = {
  get: async (key: string) => (await Preferences.get({ key })).value,
  set: (key: string, value: string) => Preferences.set({ key, value }),
  remove: (key: string) => Preferences.remove({ key }),
};

export const eyesfree = createEyesFree({ root: 'ion-app', storage: capacitorStorage });
```

Using `Preferences` (instead of `localStorage`) keeps the profile when the OS clears WebView storage, and lets native plugins read it.

With Ionic, `ion-app` works well as root. Ionic overlays (`ion-modal`, `ion-popover`) are teleported inside `ion-app`, so they are compensated too.

## Electron / Tauri

These work exactly like the web. For a desktop-wide setting, persist through IPC:

```ts
const ipcStorage = {
  get: (k) => window.api.getSetting(k),
  set: (k, v) => window.api.setSetting(k, v),
  remove: (k) => window.api.deleteSetting(k),
};
```

Remember that desktop reading distance (50–70 cm) differs from phone distance, so offer a separate calibration.

## Native app → WebView hand-off

The simplest contract is the **EF1 code in the URL**. The engine reads `?eyesfree=` (or `#eyesfree=`) on `init()` and persists the result.

**iOS (Swift)**

```swift
let code = UserDefaults.standard.string(forKey: "eyesfree:code") ?? ""
var comps = URLComponents(string: "https://help.example.com/")!
comps.queryItems = [URLQueryItem(name: "eyesfree", value: code)]
webView.load(URLRequest(url: comps.url!))
```

**Android (Kotlin)**

```kotlin
val code = prefs.getString("eyesfree:code", null)
val url = Uri.parse("https://help.example.com/").buildUpon()
    .apply { if (code != null) appendQueryParameter("eyesfree", code) }
    .build().toString()
webView.loadUrl(url)
```

**React Native (`react-native-webview`)**

```tsx
const { shareCode } = useEyesFree();
<WebView source={{ uri: `https://help.example.com/?eyesfree=${shareCode ?? ''}` }} />
```

### Live updates (without reloading)

Inject JavaScript that calls the engine. With the browser bundle, `eyesfree.mount()` exposes the engine; keep a reference on `window`:

```js
// in the web app
window.eyesfreeEngine = eyesfree.mount().engine;
```

```swift
webView.evaluateJavaScript("window.eyesfreeEngine.importProfile('\(code)')")
```

```kotlin
webView.evaluateJavascript("window.eyesfreeEngine.importProfile('$code')", null)
```

### WebView → native

```js
engine.subscribe(({ profile }) => {
  const code = profile ? eyesfree.encodeProfile(profile) : null;
  window.webkit?.messageHandlers?.eyesfree?.postMessage(code);   // iOS WKScriptMessageHandler
  window.EyesFreeBridge?.onProfile(code);                        // Android @JavascriptInterface
  window.ReactNativeWebView?.postMessage(JSON.stringify({ eyesfree: code }));
});
```

## WebView compatibility

`feConvolveMatrix` and `filter: url(#id)` on HTML elements are supported by WKWebView (iOS 14+), Android System WebView (Chromium) and the WebViews used by Electron and Tauri. On very old Android WebViews the filter is ignored. Spacing and shadows still apply, so the experience degrades gracefully.
