# Security policy

Kinlore is local-first. Family recordings and metadata must not leave the
machine without an explicit user action.

## Supported versions

This project is pre-1.0. Security fixes land on the default branch.

## Report a vulnerability

Please **do not** open a public GitHub issue for security reports.

Use [GitHub private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-vulnerability)
on this repository when it is enabled, or contact the maintainers privately.

Include:

- A description of the issue and its impact (especially anything that could
  expose an archive, bypass consent, or contact the network without consent)
- Steps to reproduce, affected revision, and any suggested fix

You should hear back within 7 days. Please give us a reasonable window to
release a fix before public disclosure.

## Data on the machine

- Archive media and JSON stay in the folder the family chose.
- Optional encryption wraps files with AES-256-GCM. The data key is wrapped by
  a passphrase and a recovery key. The raw data key is not written into the
  archive. Copy the folder before turning encryption on.
- API keys, if saved, go to a secret file outside the archive (`secrets.json`
  under the app user-data directory, mode `0600` on Unix). The renderer is not
  given the key back. This build does not send that key anywhere.
- Sealed recordings are hidden by the app until their date. They are not a
  substitute for encryption.

## What we will not do

- Read, print, or commit secrets (`.env`, keys, keychain material)
- Add analytics, accounts, or background uploads
