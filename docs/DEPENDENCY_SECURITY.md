# Dependency Security Plan

## Current Status

`npm audit --audit-level=moderate` reports vulnerabilities inherited from the Expo / React Native toolchain.

- `@xmldom/xmldom` through Expo config packages.
- `tar` through Expo CLI cache tooling.
- `postcss` through Expo Metro config.
- `uuid` through Expo / xcode tooling.
- `js-yaml` through React Native Metro/Jest tooling.

## Mitigation Plan

1. Do not run `npm audit fix --force` without a dedicated upgrade branch because it proposes breaking upgrades to Expo / React Native.
2. Schedule an Expo SDK upgrade and validate native MapLibre compatibility before merging.
3. Keep CI/build machines isolated from untrusted archives until `tar` is resolved upstream through the Expo upgrade.
4. Re-run `npm audit --audit-level=moderate` after each Expo SDK upgrade.
5. Treat new direct dependency advisories as blocking unless a documented exception exists here.
