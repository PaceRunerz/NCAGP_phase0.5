# NCAGP — National Cyber Audit Governance Platform

> **Sovereign cyber audit intelligence for Government of India**  
> Built for NIC · Ministry of Electronics & Information Technology (MEITY)

---

## What This Is

NCAGP is a full-stack government-grade platform that acts as the **operating system for cyber audits** across all Indian government departments. It replaces email-based audit reports with a tamper-evident, role-enforced, real-time intelligence system.

```
It is NOT a scanner. It is NOT a SIEM.
It is the permanent memory and accountability layer of cyber governance.
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     UI Layer (Next.js 16)                    │
│  Role-specific dashboards · Middleware RBAC · Dark theme     │
└─────────────────────────┬───────────────────────────────────┘
                          │ REST API
┌─────────────────────────▼───────────────────────────────────┐
│                  API Gateway (NestJS)                        │
│  RS256 JWT · TOTP MFA · Rate limiting · RLS interceptor      │
└──┬──────────┬──────────┬──────────┬──────────┬─────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
 Auth      Findings   Evidence   Ledger    Ingest
 Service   Engine     Engine    (Append-  (Scanner
           (State     (SHA-256   only)      API)
           Machine)   + MinIO)
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Data Layer                                │
│  PostgreSQL (RLS) · MinIO (Object Store) · Hash Chain       │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (Turbopack), React, Tailwind CSS |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL with Row-Level Security |
| ORM | Prisma |
| Auth | RS256 JWT + TOTP MFA (speakeasy) |
| Object Store | MinIO (S3-compatible) |
| Fonts | IBM Plex Sans, Rajdhani, IBM Plex Mono |

---

## Project Structure

```
ncagp/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma                    ← Full data model (8 domains)
│   │   ├── migrations/
│   │   │   ├── 001_security_hardening.sql   ← RLS + triggers
│   │   │   └── 002_features_fixed.sql       ← Feature additions
│   │   └── seed.ts                          ← Sample data
│   └── src/
│       ├── main.ts                          ← Entry point + Helmet security
│       ├── app.module.ts                    ← Module wiring + RLS interceptor
│       ├── auth/
│       │   ├── auth.service.ts              ← Login, MFA, logout, lockout
│       │   ├── auth.controller.ts           ← POST /auth/login, /mfa, /logout
│       │   ├── auth.module.ts
│       │   ├── roles.decorator.ts           ← @Roles(), @CurrentUser()
│       │   └── guards/auth.guard.ts         ← JWT + RBAC + OrgScope guards
│       │   └── strategies/jwt.strategy.ts   ← RS256 + session check
│       ├── ledger/
│       │   ├── ledger.service.ts            ← Hash-chained immutable ledger
│       │   ├── ledger.controller.ts         ← GET /ledger, POST /verify-chain
│       │   └── ledger.module.ts
│       ├── findings/
│       │   ├── findings.service.ts          ← State machine + heatmap query
│       │   ├── findings.controller.ts       ← All findings routes
│       │   └── findings.module.ts
│       ├── evidence/
│       │   ├── evidence.service.ts          ← SHA-256 hash + storage
│       │   ├── evidence.controller.ts       ← Upload + supersede + verify
│       │   └── evidence.module.ts
│       ├── ingest/                          ← Scanner API (Nessus/OpenVAS webhook)
│       ├── apikeys/                         ← Scanner API key management
│       ├── organizations/                   ← Org CRUD
│       ├── assets/                          ← Asset register
│       ├── reports/                         ← PDF report generation (pdfkit)
│       ├── alerts/                          ← SLA breach email alerts (Gmail SMTP)
│       ├── storage/
│       │   └── storage.service.ts           ← MinIO wrapper
│       └── rls/
│           └── rls.interceptor.ts           ← Postgres session vars per request
│
└── frontend/
    └── src/
        ├── app/
        │   ├── (app)/                       ← Authenticated route group
        │   │   ├── dashboard/               ← NIC_ADMIN — National Heatmap
        │   │   ├── dept-dashboard/          ← DEPT_CISO + DEPT_SECURITY
        │   │   ├── audit-dashboard/         ← VENDOR_ADMIN + AUDITOR
        │   │   ├── review-dashboard/        ← REVIEWER + OBSERVER
        │   │   ├── findings/
        │   │   ├── evidence/
        │   │   ├── ledger/
        │   │   ├── organizations/
        │   │   ├── assets/
        │   │   └── settings/
        │   └── login/
        ├── components/
        │   ├── Sidebar.tsx                  ← Role-aware navigation
        │   ├── Footer.tsx                   ← Government footer
        │   ├── AppShell.tsx                 ← Layout wrapper
        │   ├── FeedbackWidget.tsx           ← Issue reporting
        │   ├── dashboard/NationalRiskHeatmap.tsx
        │   ├── evidence/EvidencePortal.tsx
        │   └── ui/                          ← Card, Badge, Button, Select, etc.
        └── lib/
            ├── useData.ts                   ← Auto-refresh data hook
            ├── auth.ts                      ← Token + cookie management
            └── utils.ts                     ← apiFetch, token helpers
```

---

## Role-Based Access Control

Seven roles with strict data isolation:

| Role | Home Dashboard | Access Scope |
|------|---------------|-------------|
| `NIC_ADMIN` | `/dashboard` | Everything — full system |
| `DEPT_CISO` | `/dept-dashboard` | Own department only |
| `DEPT_SECURITY` | `/dept-dashboard` | Own department only |
| `VENDOR_ADMIN` | `/audit-dashboard` | Assigned audits only |
| `AUDITOR` | `/audit-dashboard` | Assigned audits only |
| `REVIEWER` | `/review-dashboard` | Read-only, all orgs |
| `OBSERVER` | `/review-dashboard` | Read-only, no export |

**Three layers of enforcement:**
1. **Next.js Middleware** — route-level redirect before page loads
2. **NestJS Guards** — `RolesGuard` + `OrgScopeGuard` on every endpoint
3. **PostgreSQL RLS** — `SET app.user_org_id` enforced at DB query level

---

## The 5-Step Audit Workflow

```
Step 1  →  Step 2  →  Step 3  →  Step 4  →  Step 5
AUDITOR    DEPT       DEPT       AUDITOR    NIC_ADMIN
Submit     Fix        Upload     Validate   Approve
Finding    Issue      Evidence   Evidence   Closure
```

Every transition is recorded in the immutable ledger.

---

## Immutable Audit Ledger

Every action in the system writes an entry:

```
event_id → user_id → action → entity → timestamp → hash_prev → hash_current
```

- SHA-256 hash chain — each entry hashes the previous
- DB trigger blocks `UPDATE` and `DELETE`
- `POST /api/ledger/verify-chain` recomputes all hashes to detect tampering
- Court-grade non-repudiation

---

## Scanner API Ingestion

Automated scanners push findings without human data entry:

```bash
# Nessus / OpenVAS / SonarQube webhook
curl -X POST https://ncagp.nic.in/api/v1/ingest/scanner \
  -H "X-API-Key: ncagp_sk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "audit_id": "uuid-of-audit",
    "severity": "critical",
    "title": "SSL Certificate Expired",
    "description": "Port 443 certificate expired 14 days ago",
    "host": "portal.mha.gov.in",
    "port": "443",
    "cve": ["CVE-2023-1234"],
    "cvss_score": 9.1
  }'
```

Generate API keys in `Settings → API Keys`. Scopes: `FINDINGS_WRITE`, `FINDINGS_READ`, `EVIDENCE_WRITE`, `FULL_ACCESS`.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| PostgreSQL | 15+ | https://postgresql.org/download |
| Docker | any | https://docker.com (for MinIO only) |
| OpenSSL | any | Usually pre-installed |

---

## Complete Setup Guide

### Step 1 — PostgreSQL Database

```bash
# Connect as superuser
psql -U postgres

# Create DB + user
CREATE DATABASE ncagp;
CREATE USER ncagp_app WITH PASSWORD 'ChangeThis!123';
GRANT ALL PRIVILEGES ON DATABASE ncagp TO ncagp_app;
\c ncagp
GRANT ALL ON SCHEMA public TO ncagp_app;
\q
```

### Step 2 — MinIO Object Store (local dev)

```bash
# Start with Docker
docker run -d \
  --name ncagp-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Open http://localhost:9001 → login with minioadmin/minioadmin
# Create bucket called: ncagp-evidence
```

### Step 3 — Generate RS256 JWT Keys

```bash
mkdir -p keys
# Generate 4096-bit RSA key pair
openssl genrsa -out keys/private.pem 4096
openssl rsa -in keys/private.pem -pubout -out keys/public.pem

# View the keys — you'll paste them into .env
cat keys/private.pem
cat keys/public.pem
```

### Step 4 — Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy env file and fill in values
cp .env.example .env
# Edit .env — paste your RS256 keys, DB password, etc.

# Generate Prisma client
npx prisma generate

# Run Prisma migrations (creates all tables)
npx prisma migrate dev --name init

# Apply security hardening (RLS, triggers, indexes)
PGPASSWORD=ChangeThis!123 psql -U ncagp_app -d ncagp \
  -f prisma/migrations/001_security_hardening.sql

# Apply feature additions
psql -U ncagp_app -d ncagp -f prisma/migrations/002_features_fixed.sql

# Seed database (creates orgs, users, sample findings)
npx ts-node prisma/seed.ts

# Start development server
npm run start:dev
```

Backend runs at: **http://localhost:3000/api**

### Step 5 — Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at: **http://localhost:3001**

### Step 6 — Verify Everything Works

```bash
# Test login
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nic.in","password":"Admin@1234!"}' | python3 -m json.tool

# Save token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nic.in","password":"Admin@1234!"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# Get risk heatmap
curl -s http://localhost:3000/api/findings/risk-heatmap \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# List findings
curl -s http://localhost:3000/api/findings \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Verify ledger chain integrity
curl -s -X POST http://localhost:3000/api/ledger/verify-chain \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool
```

---

## .env Template (backend/.env)

```env
DATABASE_URL="postgresql://ncagp_app:ChangeThis!123@localhost:5432/ncagp"

# Paste full PEM — replace literal newlines with \n
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
JWT_EXPIRES_IN="8h"

STORAGE_ENDPOINT="http://localhost:9000"
STORAGE_ACCESS_KEY="minioadmin"
STORAGE_SECRET_KEY="minioadmin"
STORAGE_BUCKET="ncagp-evidence"

# Optional — for SLA email alerts
SMTP_USER="your.gmail@gmail.com"
SMTP_PASS="gmail-app-password"   # Generate at myaccount.google.com/apppasswords

PORT=3000
NODE_ENV=development
FRONTEND_URL="http://localhost:3001"
```

---

## Default Login Credentials (after seed)

| Role | Email | Password |
|------|-------|----------|
| `NIC_ADMIN` | `admin@nic.in` | `Admin@1234!` |
| `DEPT_CISO` | `ciso@mha.gov.in` | `Dept@5678!` |
| `DEPT_SECURITY` | `security@mha.gov.in` | `Dept@5678!` |
| `VENDOR_ADMIN` | `vendor@credsec.in` | `Dept@5678!` |
| `AUDITOR` | `auditor@credsec.in` | `Dept@5678!` |
| `REVIEWER` | `reviewer@nic.in` | `Dept@5678!` |
| `OBSERVER` | `observer@nic.in` | `Dept@5678!` |

**Open http://localhost:3001 in your browser to use the UI.**

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login with email + password |
| POST | `/api/auth/mfa/verify` | Verify TOTP code |
| POST | `/api/auth/logout` | Invalidate session |
| GET | `/api/auth/mfa/status` | Check MFA status |
| POST | `/api/auth/mfa/setup` | Generate QR code |
| POST | `/api/auth/mfa/enable` | Enable MFA after setup |
| POST | `/api/auth/mfa/disable` | Disable MFA |

### Findings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/findings` | List findings (org-scoped) |
| POST | `/api/findings` | Create finding |
| PATCH | `/api/findings/:id/status` | Transition state |
| GET | `/api/findings/:id/history` | Full audit trail |
| GET | `/api/findings/risk-heatmap` | National risk scores |

### Evidence
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/findings/:id/evidence` | Upload evidence file |
| GET | `/api/evidence/:id/verify` | Verify SHA-256 hash |
| POST | `/api/evidence/:id/supersede` | Supersede evidence |

### Scanner Ingestion
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/ingest/scanner` | X-API-Key | Single finding |
| POST | `/api/v1/ingest/scanner/batch` | X-API-Key | Up to 500 findings |

### Ledger
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ledger` | Query ledger entries |
| POST | `/api/ledger/verify-chain` | Verify chain integrity |

### Reports
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/national-risk` | Download PDF report |

---

## Where Data Lives

| Data | Location | View command |
|------|----------|-------------|
| Findings, users, orgs | PostgreSQL `ncagp` DB | `psql -U ncagp_app -d ncagp -c "SELECT * FROM findings;"` |
| Evidence files | MinIO `ncagp-evidence` bucket | `http://localhost:9001` → minioadmin/minioadmin |
| Audit ledger | PostgreSQL `audit_ledger` table | `psql -U ncagp_app -d ncagp -c "SELECT * FROM audit_ledger ORDER BY timestamp DESC LIMIT 20;"` |
| Sessions | PostgreSQL `sessions` table | `psql -U ncagp_app -d ncagp -c "SELECT * FROM sessions;"` |
| Feedback issues | Browser localStorage | Key: `ncagp_feedback_issues` |

---

## Security Architecture

| Layer | Control | Implementation |
|-------|---------|----------------|
| JWT | RS256 asymmetric 4096-bit | `auth.module.ts` + `jwt.strategy.ts` |
| MFA | TOTP (speakeasy) | `auth.service.ts` |
| Session revocation | DB session table | Checked on every request |
| Account lockout | 5 attempts → 15 min lock | `auth.service.ts` |
| RBAC | 7-role model | `@Roles()` + `RolesGuard` |
| Multi-tenancy | App + DB layer | `OrgScopeGuard` + PostgreSQL RLS |
| Ledger tamper-evidence | SHA-256 hash chain | `ledger.service.ts` |
| Evidence integrity | SHA-256 pre-upload | `evidence.service.ts` |
| File safety | MIME allowlist | `evidence.service.ts` |
| DB immutability | PostgreSQL triggers | `001_security_hardening.sql` |
| Transport security | Helmet + HSTS | `main.ts` |
| Rate limiting | 100 req/min global | `ThrottlerModule` |
| Data residency | ap-south-1 India | Storage metadata |

---

## License
Made with ❤️ with PaceRunerz Alchemy
For internal use only — not for public distribution.

---

*Sovereign infrastructure for Government of India.*  
*Build it like it matters. Because it does.*
