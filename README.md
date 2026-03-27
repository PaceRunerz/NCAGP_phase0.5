# NCAGP — National Cyber Audit Governance Platform
## Complete Setup Guide

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| PostgreSQL | 15+ | https://postgresql.org/download |
| Docker | any | https://docker.com (for MinIO only) |
| OpenSSL | any | Usually pre-installed |

---

## Step 1 — PostgreSQL Database

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

---

## Step 2 — MinIO Object Store (local dev)

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

---

## Step 3 — Generate RS256 JWT Keys

```bash
mkdir -p keys
# Generate 4096-bit RSA key pair
openssl genrsa -out keys/private.pem 4096
openssl rsa -in keys/private.pem -pubout -out keys/public.pem

# View the keys — you'll paste them into .env
cat keys/private.pem
cat keys/public.pem
```

---

## Step 4 — Backend Setup

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

# Seed database (creates orgs, users, sample findings)
npx ts-node prisma/seed.ts

# Start development server
npm run start:dev
```

Backend runs at: **http://localhost:3000/api**

---

## Step 5 — Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at: **http://localhost:3001**

---

## Step 6 — Verify Everything Works

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

## Default Login Credentials (after seed)

| Role | Email | Password |
|------|-------|----------|
| NIC Admin | admin@nic.in | Admin@1234! |
| MHA CISO | ciso@mha.gov.in | Dept@5678! |
| MHA Security | security@mha.gov.in | Dept@5678! |
| Auditor | auditor@credsec.in | Dept@5678! |

**Open http://localhost:3001 in your browser to use the UI.**

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

PORT=3000
NODE_ENV=development
FRONTEND_URL="http://localhost:3001"
```

---

## Project File Structure

```
ncagp/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma              ← Full data model (8 domains)
│   │   ├── migrations/
│   │   │   └── 001_security_hardening.sql  ← RLS + triggers
│   │   └── seed.ts                    ← Sample data
│   └── src/
│       ├── main.ts                    ← Entry point + Helmet security
│       ├── app.module.ts              ← Module wiring + RLS interceptor
│       ├── auth/
│       │   ├── auth.service.ts        ← Login, MFA, logout, lockout
│       │   ├── auth.controller.ts     ← POST /auth/login, /mfa, /logout
│       │   ├── auth.module.ts
│       │   ├── roles.decorator.ts     ← @Roles(), @CurrentUser()
│       │   └── guards/auth.guard.ts   ← JWT + RBAC + OrgScope guards
│       │   └── strategies/jwt.strategy.ts  ← RS256 + session check
│       ├── ledger/
│       │   ├── ledger.service.ts      ← Hash-chained immutable ledger
│       │   ├── ledger.controller.ts   ← GET /ledger, POST /verify-chain
│       │   └── ledger.module.ts
│       ├── findings/
│       │   ├── findings.service.ts    ← State machine + heatmap query
│       │   ├── findings.controller.ts ← All findings routes
│       │   └── findings.module.ts
│       ├── evidence/
│       │   ├── evidence.service.ts    ← SHA-256 hash + storage
│       │   ├── evidence.controller.ts ← Upload + supersede + verify
│       │   └── evidence.module.ts
│       ├── organizations/             ← Org CRUD
│       ├── assets/                    ← Asset register
│       ├── storage/
│       │   └── storage.service.ts     ← MinIO wrapper
│       └── rls/
│           └── rls.interceptor.ts     ← Postgres session vars per request
│
└── frontend/
    └── src/
        ├── app/
        │   ├── login/page.tsx         ← Login + MFA flow
        │   ├── dashboard/page.tsx     ← National risk heatmap
        │   ├── findings/page.tsx      ← Findings list + filters
        │   ├── findings/[id]/evidence/page.tsx  ← Evidence upload
        │   └── ledger/page.tsx        ← Audit trail + chain verify
        ├── components/
        │   ├── Sidebar.tsx            ← Nav + user info + logout
        │   ├── dashboard/NationalRiskHeatmap.tsx
        │   ├── evidence/EvidencePortal.tsx
        │   └── ui/                    ← Card, Badge, Button, Select, etc.
        └── lib/utils.ts               ← apiFetch, token helpers
```

---

## Security Architecture Summary

| Layer | Control | Implementation |
|-------|---------|----------------|
| JWT | RS256 asymmetric | `auth.module.ts` + `jwt.strategy.ts` |
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

*Sovereign infrastructure for Government of India.*
*Build it like it matters. Because it does.*
