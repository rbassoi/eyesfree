# Integration guides

Pick your platform. Every guide ends with the same checklist, so the user experience stays consistent across apps.

| Platform | Guide | Package |
|---|---|---|
| Plain HTML, CMS (WordPress, Drupal), static sites | [web-vanilla.md](web-vanilla.md) | `@eyesfree/browser` |
| React, Next.js, Remix, Vite | [react.md](react.md) | `@eyesfree/react` |
| Vue, Nuxt, Angular, Svelte/SvelteKit, Solid, Lit | [frameworks.md](frameworks.md) | `@eyesfree/web` + `@eyesfree/calibrator` |
| Capacitor, Ionic, Cordova, Electron, Tauri, native WebViews | [hybrid-and-webviews.md](hybrid-and-webviews.md) | `@eyesfree/web` or `@eyesfree/browser` |
| React Native, Expo | [react-native.md](react-native.md) | `@eyesfree/react-native` |
| Flutter | [flutter.md](flutter.md) | reference port (Dart) |
| iOS (SwiftUI/UIKit), Android (Compose/Views) | [native.md](native.md) | reference snippets |
| Sync profiles across devices through your backend | [backend-sync.md](backend-sync.md) | `StorageAdapter` |
| Canvas, charts, maps, PDF viewers | [raster-content.md](raster-content.md) | `ImageCompensator` |

## UX checklist (all platforms)

- [ ] Add an entry point that is easy to find without glasses: a large **"👓 No glasses?"** button in the header or the accessibility settings.
- [ ] Use a step-2 sample sentence typical of your app: an amount, a date, a dosage.
- [ ] Show a clear **on/off** state and a one-tap way to turn compensation off.
- [ ] Persist the profile, so users calibrate once per device.
- [ ] Don't apply compensation to the calibration screen itself (the provided wizards handle this).
- [ ] Mention that EyesFree is a reading aid, not a medical device, for example in your help page.
- [ ] Credit the project, as the Apache-2.0 NOTICE requires: "Optical compensation powered by EyesFree".
