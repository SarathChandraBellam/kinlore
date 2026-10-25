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

## What we will not do

- Read, print, or commit secrets (`.env`, keys, keychain material)
- Add analytics, accounts, or background uploads
