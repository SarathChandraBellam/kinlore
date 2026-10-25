# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Interviews, library import, real-clip answers, family questions, stories,
  keepsakes, a spoken cookbook, a timeline, and sealed recordings
- Question bank in English, Telugu, Hindi, and Tamil
- Opt-in archive encryption with a passphrase and a recovery key
- Swappable speech and voice engines; none are installed, and nothing is sent
- Staging and production releases fail unless they include a Linux AppImage,
  a Windows installer, a macOS disk image, and `SHA256SUMS`
- Electron + TypeScript + Node monorepo skeleton (`apps/desktop`,
  `packages/core`, `packages/storage`, `packages/ipc-contract`)
- Local JSON KinloreArchive with a `StorageProvider` interface
- Open-source docs, CI, and agent instructions
- Staging and production GitHub Actions release workflows
- `npm run dist` (electron-builder: NSIS, DMG, AppImage; unsigned)

[Unreleased]: https://github.com/kinlore/kinlore/compare/HEAD...HEAD
