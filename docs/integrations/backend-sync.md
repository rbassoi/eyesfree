# Syncing profiles through your backend

A profile is a small JSON object (or a 17-character EF1 code) with no medical data, so you can store it on the user's account and restore it on every device.

## Storage adapter with offline cache

```ts
import { createEyesFree, localStorageAdapter } from '@eyesfree/web';
import type { StorageAdapter } from '@eyesfree/web';

const cache = localStorageAdapter();

export const apiStorage: StorageAdapter = {
  async get(key) {
    try {
      const res = await fetch('/api/me/preferences/eyesfree', { credentials: 'include' });
      if (res.ok) {
        const { code } = await res.json();     // e.g. "EF1.hm211.100.150.250"
        if (code) cache.set(key, code);
        return code ?? cache.get(key);
      }
    } catch { /* offline */ }
    return cache.get(key);                      // fall back to the local copy
  },
  async set(key, value) {
    cache.set(key, value);
    await fetch('/api/me/preferences/eyesfree', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: JSON.parse(value) }),
    });
  },
  async remove(key) {
    cache.remove(key);
    await fetch('/api/me/preferences/eyesfree', { method: 'DELETE', credentials: 'include' });
  },
};

export const eyesfree = createEyesFree({ storage: apiStorage });
```

`parseProfile()` accepts either JSON or an EF1 code, so the server can store whichever is more convenient.

## Server-side validation (Node)

```ts
import { validateProfile, normalizeProfile, encodeProfile } from '@eyesfree/core';

app.put('/api/me/preferences/eyesfree', (req, res) => {
  const { valid, errors } = validateProfile(req.body.profile);
  if (!valid) return res.status(422).json({ errors });
  const code = encodeProfile(normalizeProfile(req.body.profile));
  db.users.update(req.user.id, { eyesfree: code });
  res.json({ code });
});
```

Or validate with any JSON Schema validator against [`spec/vision-profile.schema.json`](../../spec/vision-profile.schema.json).

## Privacy

The profile records UI preferences, not a prescription. Still, treat it like any accessibility setting. Tie it to the user's consent and settings, and include it in data export and deletion requests.
