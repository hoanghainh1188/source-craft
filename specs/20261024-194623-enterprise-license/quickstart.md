# Quickstart: Enterprise Offline License & Feature Gate (`enterprise-license`)

**Feature**: `20261024-194623-enterprise-license`
**Date**: 2026-10-24

## 1. Generate Vendor Ed25519 Keypair (One-Time Setup)

```bash
node scripts/issue-license.mjs keygen --out-dir ./keys
```
This outputs:
- `./keys/license-private.pem` (KEEP SECRET — never commit to git)
- `./keys/license-public.pem` (Embed in `src/main/services/license/license-verifier.ts`)

## 2. Issue an Enterprise `.sclicense` File

```bash
node scripts/issue-license.mjs sign \
  --private-key ./keys/license-private.pem \
  --org "Công ty TNHH ACME Việt Nam" \
  --tier enterprise \
  --seats 50 \
  --days 365 \
  --out ./acme-enterprise.sclicense
```

## 3. Activate Offline in SourceCraft

1. Launch SourceCraft (`npm run dev`) with Wi-Fi / network disabled.
2. Open **Settings (Cài đặt)** → **License & Plan (Bản quyền & Gói dịch vụ)**.
3. Click **Activate `.sclicense` file (Kích hoạt tệp `.sclicense`)** and select `acme-enterprise.sclicense`.
4. Verify:
   - Header displays badge `Enterprise · Công ty TNHH ACME Việt Nam`.
   - Settings displays `Enterprise`, `50 seats`, and expiration countdown.
   - Audio/Video/Image sources and all 9 Studio synthesis formats are unlocked.

## 4. Run Automated Verification

```bash
npm test -- tests/unit/license/
npm run lint
npm run build
```
