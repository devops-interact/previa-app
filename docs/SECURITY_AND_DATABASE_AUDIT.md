# Security & Secure Database Management — Audit Extract

**Source:** PRD Mexican Financial AI Agent  
**Extracted:** Safe development/cybersecurity and secure database management recommendations.

---

## 1. Safe Development & Cybersecurity

### 1.1 Security Model (Mandatory)

- **Backend-First (Zero Trust Frontend):** All AI-generated code MUST follow this. Frontend never talks to the database directly.
- **Compliance check before any code:**  
  *"Is this code asking the Frontend to talk to the Database?"*  
  → If YES: reject; use Backend API/Server Action instead.  
  → If NO: proceed and ensure all other rules are followed.

### 1.2 Backend-Only Data Access

| Rule | Description |
|------|-------------|
| **NEVER** put business logic in Client Components | Client = view layer only |
| **NEVER** use `supabase-js` client methods (`.select`, `.insert`, `.update`, `.delete`) in frontend | All data access via backend |
| **ALWAYS** use Server Actions, API Routes, or Edge Functions | For all data access |
| **Frontend speaks to APIs only** | Never directly to database |

### 1.3 Storage Security

| Rule | Description |
|------|-------------|
| **NO PUBLIC BUCKETS** | Never set `public: true` |
| **UUID FILENAMES** | Use `crypto.randomUUID()` for filenames (prevents enumeration) |
| **SIGNED URLS ONLY** | Never expose direct storage paths; use time-limited signed URLs (e.g. 1 hour) |
| **Validate file type and size** | Allowlist MIME types and enforce max file size (e.g. 10MB) |

### 1.4 Payments & Webhooks

| Rule | Description |
|------|-------------|
| **NEVER** trust `req.body` directly | Always verify first |
| **ALWAYS** verify webhook signatures | Use provider SDK methods (e.g. Stripe `constructEvent`) |
| **REJECT on failure** | Return 400 immediately if verification fails |
| **Replay prevention** | Check timestamps where applicable |
| **Idempotency** | Handle duplicate webhook deliveries safely |

### 1.5 Environment & Secrets

| Rule | Description |
|------|-------------|
| **NEVER** hardcode secrets | Use `process.env.VAR_NAME` |
| **NEVER** commit secrets | Use `.env.local` (gitignored) |
| **ALWAYS** validate at build time | Zod (or equivalent) schema for env |
| **WARN on detection** | If secret appears in code, replace and alert |

**Required validations (examples):** API keys (prefix checks), URLs, encryption keys (min length 32 for token encryption), etc.

### 1.6 Input Validation & Rate Limiting

| Rule | Description |
|------|-------------|
| **TRUST NO ONE** | Validate ALL inputs with Zod (or equivalent) |
| **RATE LIMIT** | Apply to all mutation endpoints; priority: auth, payments, AI queries |
| **RFC format** | Use strict regex for Mexican RFC where applicable |
| **Amount/currency bounds** | e.g. positive, max 999999999, allowed currencies |

### 1.7 Integration Security (Bank/Payment)

- **Credentials:** Store in Supabase Vault (encrypted); never in code or logs; support rotation; log all credential access.
- **OAuth:** AES-256 at rest; refresh server-side only; minimum scopes; track consent/expiry.
- **API:** TLS 1.2+; always validate certificates; prefer mTLS where available; request signing per provider spec.
- **Webhooks:** Verify ALL webhooks; replay prevention; idempotency.
- **Data:** PII minimization; classify fields; audit trail for data access; retention per SAT (5-year minimum).
- **Errors:** Never expose credential errors in messages; rate limiting with exponential backoff; circuit breaker recommended.

### 1.8 Infrastructure & Application Security

- **Encryption at rest:** AES-256 (e.g. Supabase default).
- **Encryption in transit:** TLS 1.3.
- **Key management:** Supabase Vault / AWS KMS.
- **Auth:** OAuth 2.0 + PKCE; SAML 2.0 for SSO; MFA (TOTP, WebAuthn).
- **Sessions:** HttpOnly cookies; server-managed session tokens.
- **Authorization:** Backend-enforced RBAC via service role only.
- **Audit logging:** Full audit trail (e.g. DB triggers).
- **WAF / DDoS:** e.g. Cloudflare / Vercel.

### 1.9 Email / OAuth Token Security

- **Token storage:** Supabase Vault; AES-256-GCM; server-side only; never exposed to frontend.
- **Email access:** Read-only; never send or delete on user’s behalf.
- **Attachments:** Stored with UUID filenames; access via signed URLs.
- **Organization isolation:** Users only access their org’s data.
- **OAuth callback:** Validate state parameter.
- **Audit:** Log all access; configurable data retention.

### 1.10 Banking / Payment Credentials

- **Credential storage:** Never store bank credentials in application; use OAuth tokens only.
- **Access mode:** Read-only where possible.
- **Token management:** Vault, AES-256-GCM, rotation, never to frontend.
- **Webhooks:** Mandatory signature verification; idempotency; reconciliation checks.

### 1.11 Natural Language to SQL (NL2SQL)

- **Read-only access** for generated queries.
- **Row limit** (e.g. 10,000).
- **Query timeout** (e.g. 30 seconds).
- **Sensitive column masking** (e.g. RFC, financial amounts).
- **Explain** generated SQL to users.

### 1.12 Pre-Launch Security Checklist (from PRD)

- [ ] No client-side database calls (all data ops in Server Actions).
- [ ] RLS enabled on all tables; no RLS policies (Zero-Policy = Deny All).
- [ ] Zod validation on all inputs.
- [ ] Rate limiting on mutations (e.g. Upstash).
- [ ] Webhook signatures verified.
- [ ] Signed URLs for storage; no direct file paths.
- [ ] UUID filenames in storage.
- [ ] Environment variables validated (Zod at build).
- [ ] Secrets not committed (`.env.local`).
- [ ] RPC functions locked (REVOKE after CREATE FUNCTION).

---

## 2. Secure Database Management

### 2.1 Row Level Security (RLS) — “Zero Policy” Rule

| Principle | Implementation |
|-----------|----------------|
| **RLS is mandatory** | Enable on every table at creation |
| **No policies for anon/authenticated** | Zero policies = Deny All for anon and authenticated |
| **Service role only** | All data access via `service_role` in backend (Server Actions / Edge Functions) |
| **Client key = no data access** | `anon` key has no data permissions |

```sql
-- Enable RLS on every table
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfdis ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
-- Do NOT create RLS policies for anon/authenticated.
-- Only service_role (backend) can access data.
```

### 2.2 RPC / Function Lockdown

- **REVOKE from public, anon, authenticated** immediately after creating functions.
- **GRANT EXECUTE** only to `service_role` (explicit allowlist).
- Use **SECURITY DEFINER** only when necessary and with controlled logic.

```sql
REVOKE EXECUTE ON FUNCTION calculate_tax_summary FROM public;
REVOKE EXECUTE ON FUNCTION calculate_tax_summary FROM anon;
REVOKE EXECUTE ON FUNCTION calculate_tax_summary FROM authenticated;
GRANT EXECUTE ON FUNCTION calculate_tax_summary TO service_role;
```

### 2.3 Credential & Token Storage in DB

- **Never store plaintext credentials** in application tables.
- **Encrypted credentials:** Use Vault or encrypted columns (e.g. `access_token_enc`, `refresh_token_enc`, `api_key_enc`); in production prefer Vault or dedicated secure storage.
- **OAuth tokens:** Stored encrypted (e.g. Supabase Vault, AES-256-GCM); server-side only.
- **Email tokens:** Same as above; encryption key min 32 chars; validate via env schema.

### 2.4 Field-Level Encryption & Classification

- **Fields to protect (examples):** RFC, CLABE, bank credentials, OAuth tokens.
- **Data classification:** e.g. public, internal, confidential, restricted.
- **Organization isolation:** Enforced in application layer; all queries scoped by `organization_id` (or equivalent).

### 2.5 Retention & Compliance

- **SAT:** CFDI and related tax data — **minimum 5 years** retention.
- **Audit logs:** e.g. 7 years.
- **User sessions:** e.g. 90 days.
- **Data retention:** Configurable per organization where applicable; document and enforce.

### 2.6 Backup & Recovery (from PRD)

- **Backups:** e.g. S3 Glacier (or equivalent); defined for DB and critical storage.
- **Backup recovery:** Target e.g. &lt; 4 hours RTO where specified.
- **Primary DB:** PostgreSQL (e.g. RDS / Cloud SQL); multi-AZ for HA.

### 2.7 Database Security Configuration (Supabase-Oriented)

- **RLS:** Enabled on all tables; no policies for anon/authenticated.
- **anon key:** Auth only; no data access.
- **service_role:** Backend only; never exposed to client.
- **Storage access:** Signed URLs only; no public bucket URLs.

### 2.8 Compliance (Mexican & General)

- **LFPDPPP:** Mexican personal data protection.
- **SAT:** CFDI storage, validation, retention (5 years).
- **CNBV / Banxico:** If serving financial institutions.
- **PCI DSS:** Level 1 if handling card data.
- **ISO 27001 / 27701, SOC 2 Type II:** Target certifications.

---

## 3. Summary Table

| Area | Key requirement |
|------|-----------------|
| **Architecture** | Backend-first; frontend → API only, never DB |
| **Database access** | RLS on all tables; zero policies; service_role only |
| **Secrets** | Env vars only; validated; never in code or logs |
| **Storage** | Private buckets; UUID filenames; signed URLs only |
| **Webhooks** | Verify signature; reject on failure; idempotency |
| **Input** | Zod (or equivalent) on all inputs; rate limiting |
| **Credentials (DB)** | Vault/encrypted; never plaintext; audit access |
| **Retention** | SAT 5-year minimum; audit logs 7 years |
| **RPC** | REVOKE public/anon/authenticated; GRANT service_role only |
| **Backups** | Defined strategy (e.g. S3 Glacier); RTO target |

This document is an audit extract for implementation and review. Apply it in line with your current stack (e.g. Supabase, Next.js, FastAPI) and your risk and compliance requirements.
