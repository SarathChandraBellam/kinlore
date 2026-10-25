# Plan 002

Keep the Electron shell. Put rules in `@kinlore/core`, questions in
`@kinlore/interview`, retrieval in `@kinlore/ask`, file and zip reading in
`@kinlore/ingest`, keys in `@kinlore/secrets`, and empty engines in
`@kinlore/engine`. Main owns the archive through `ArchiveSession`. The
renderer only calls `window.kinlore`.

Encryption is an `ArchiveCodec` applied by `encryptExistingArchive`, not a
branch inside the plaintext writer. Releases share
`.github/workflows/package-installers.yml`. Both staging and production refuse
to publish until `scripts/release-assets.mjs` sees an AppImage, an exe, a dmg,
and `SHA256SUMS`.

Speech models and remote HTTP clients stay out. Families type words or import
subtitles.
