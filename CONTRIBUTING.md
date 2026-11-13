# Contributing to EyesFree

Thank you for helping people read without their glasses! Contributions of every kind are welcome: code, translations, ports, documentation, design and, especially, **vision science and user testing**.

## Ways to help

| Area | Examples |
|---|---|
| 🌍 Translations | Add a locale to `packages/calibrator/src/i18n.ts` (and the RN messages) |
| 🔬 Vision science | Better presets, per-distance tuning, dark-mode kernels, user-study protocols |
| 📱 Ports | Flutter package, Swift package, Kotlin library, Skia component for RN |
| ♿ Accessibility | Screen-reader testing, cognitive-load review of the wizard copy |
| 🧪 Testing | Real-device reports (browser, OS, DPI, distance) using the demo |

If you test with real users, please follow ethical practice: informed consent, no collection of health data without a proper legal basis, and an IRB or ethics board where applicable.

## Development setup

Requirements: Node ≥ 18 and npm ≥ 9.

```bash
npm install
npm run build      # tsc -b (all packages) + esbuild browser bundles
npm test           # vitest (jsdom for DOM packages)
npm run demo       # http://localhost:5173
```

Useful scripts:

| Script | Description |
|---|---|
| `npm run typecheck` | Type-check every package via project references |
| `npm run test:watch` | Watch mode |
| `npm run demo:build` | Build and copy the bundle into `apps/demo/vendor` |
| `npm run clean` | Remove build outputs |

## Project rules

1. **`@eyesfree/core` stays pure.** No DOM, no storage, no dependencies. New optical rules go here first, with tests.
2. **Adapters render plans; they never re-derive maths.** If an adapter needs a number, add it to `RenderPlan`.
3. **Keep `convolveRGBA` and `toneMapRGBA` self-contained.** They are serialised into the Web Worker.
4. **Spec changes are versioned.** Changing a preset value, the EF1 format or the pipeline order requires updating [`docs/profile-spec.md`](docs/profile-spec.md), the reference tables in the tests and the CHANGELOG. Breaking changes need a new `version`.
5. **Accessibility is a feature.** UI changes must keep keyboard support, ARIA semantics, 56 px targets and work at 320 px width.
6. **No telemetry, ever.**

## Code style

- TypeScript `strict`, ES2020 output, ESM only.
- Public functions get TSDoc comments.
- Prefer small pure functions and explicit names over cleverness.
- Tests live in `packages/<name>/test/*.test.ts(x)`.

## Commit & PR

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(web): …`, `fix(core): …`, `docs: …`.
- One topic per PR. Include tests and docs updates.
- Describe how you verified visual changes (browser, device, DPI) and attach before/after screenshots if possible.

## Releasing (maintainers)

1. Update versions in every `packages/*/package.json` (keep them in lockstep) and in `VERSION` inside `packages/core/src/index.ts`.
2. Update `CHANGELOG.md`.
3. `npm run verify`
4. `npm publish --workspaces --access public`
5. Tag `vX.Y.Z` and create a GitHub release. The Pages workflow redeploys the demo.

## License of contributions

By contributing you agree that your contributions are licensed under the [Apache License 2.0](LICENSE) (inbound = outbound), and you may add yourself to [AUTHORS](AUTHORS).
