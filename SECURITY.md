# Security Policy

## Supported versions

Only the latest minor release receives security fixes during the 0.x series.

## Reporting a vulnerability

**Please do not open public issues for security problems.** Use GitHub's [private vulnerability reporting](../../security/advisories/new). We aim to acknowledge reports within 3 business days and to ship a fix or mitigation within 30 days.

## Scope notes

EyesFree runs entirely on the client, makes no network requests and stores only a small preference object. Relevant areas include:

- Injection through the calibrator's attributes or messages (all text is HTML-escaped)
- Parsing of untrusted profile codes from URLs (`decodeProfile` is strict and regex-validated)
- The Web Worker built from library source (use `workerUrl` under strict CSP)
- Denial of service through extremely large images passed to `ImageCompensator`, which is the caller's responsibility to bound
