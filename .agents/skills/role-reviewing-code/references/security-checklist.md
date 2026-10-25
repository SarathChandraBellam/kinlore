# Security checklist

Use when a change touches input handling, authentication or authorization, secrets, crypto, dependencies, file or network I/O,
or agent configuration (skills, MCP servers).

- **Secrets**: nothing hard-coded, logged, echoed in errors or committed. Environment variables are referenced by name only.
- **Injection**: check for SQL, shell, path traversal, template injection, unsafe deserialization and SSRF. User input never
  reaches an interpreter unescaped.
- **AuthN and AuthZ**: every new entry point checks identity *and* permission. Check for IDOR, where the caller can access another user's record by changing an id.
- **Data exposure**: check for PII in logs, errors or responses, and for overly broad CORS, scopes or file permissions.
- **Dependencies**: each new package is needed, maintained and pinned, with no typosquat-looking names, and the lockfile is updated.
- **Crypto**: use standard libraries, never hand-rolled crypto. No MD5 or SHA-1 for security purposes. Use constant-time comparison for secrets.
- **Agent surface**: new skills don't instruct agents to fetch and run remote code. New tools and MCP servers follow least privilege.

For each finding, report the severity (critical, high, medium or low), the location, the exploit scenario and the fix.
