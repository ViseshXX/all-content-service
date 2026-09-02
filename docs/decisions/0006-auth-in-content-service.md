# 0006 — Curator auth and audit logs live in this service

**Where:** `cms-user.schema.ts` (`cms_users`), `audit-log.schema.ts` (`audit_logs`),
`cms-user.service.ts`, `auth.controller.ts`, `auth/auth.guard.ts`, `auth/roles.guard.ts`

## Decision

Curator credentials are stored in **this service's** database in `cms_users`, not in the
orchestration database. Passwords are bcrypt hashes (cost 12) and are verified locally with
`bcrypt.compare`.

`virtualId` is **not** generated here. On user creation the service calls orchestration's
`generateVirtualID?username=<cmsUsername>`, which registers the username there and returns a
JWE. The service decrypts it (`JOSE_SECRET`, SHA-256 hashed to an AES key), verifies the inner
signed JWT (`JWT_SIGNIN_PRIVATE_KEY`), and reads `virtual_id` from the payload.

Audit entries go to `audit_logs` in this service's database, not to the telemetry service.

Two roles: `admin` (full access plus user management) and `curator` (content operations only),
enforced by `RolesGuard` via the `@Roles(...)` decorator. New users default to `curator`.

## Why

**Credentials here, not in orchestration:** orchestration is shared infrastructure serving
students. Adding a CMS-user table and a password flow to it would mean modifying a service that
other teams depend on, for a concern that is entirely this application's. Keeping it local left
orchestration untouched.

**`virtualId` from orchestration:** orchestration is the authority on identity, and it is what
issues the tokens every downstream call is authenticated with. Minting an id locally would
create two sources of truth for who a user is, and the local one would not be recognised by any
other service.

**Audit logs here, not telemetry:** telemetry is modelled around student learning analytics.
Curator audit trails — who changed which content item, from what to what — do not fit that
shape, and mixing them would pollute a dataset other people query.

**Audit schema designed from the domain**, not copied from the Sunbird AUDIT spec: `auditId`,
`action` (CREATE/UPDATE/DELETE/BULK_UPLOAD/LOGIN/LOGOUT), `resource`
(content/collection/multilingual/bulk_upload/user/auth), `resourceId`, `resourceName`, `actor`
(virtualId/username/role), `changes` as `{ from, to }` per field, `summary`, `ipAddress`,
`timestamp`. The generic spec carried fields with no meaning here and lacked the before/after
diff, which is the main thing a reviewer wants.

## Consequence

Creating a CMS user **requires orchestration to be reachable** — it is a hard dependency, and
the dev VM shuts down nightly. Failure surfaces as "Failed to register user in orchestration
service".

`ALL_ORC_SERVICE_URL` is expected to point at the `tokenStatus` endpoint; the base URL is
derived by stripping that suffix. Changing the env var's shape breaks `generateVirtualID`.

Data analysts have read access to this database, so bcrypt hashes are visible to them. Accepted:
bcrypt is not reversible.

`audit_logs` sets `timestamps: false` and carries its own `timestamp` field — do not add
Mongoose timestamps expecting `createdAt`.

Error logs stay in stdout/stderr; only business actions are audited.
