# Previa App — Product & Technical Requirements Document

**Version:** 1.0  
**Date:** February 16, 2026  
**Classification:** Executive Prompt / MVP Specification  
**Author:** AI Engineering Team  
**Status:** Draft for Review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision & Persona](#3-product-vision--persona)
4. [Regulatory & Legal Context](#4-regulatory--legal-context)
5. [Functional Requirements](#5-functional-requirements)
6. [Data Sources & Integrations](#6-data-sources--integrations)
7. [Technical Architecture](#7-technical-architecture)
8. [Data Model](#8-data-model)
9. [Agent Workflow & Pipeline](#9-agent-workflow--pipeline)
10. [Alert & Notification System](#10-alert--notification-system)
11. [Security & Compliance Considerations](#11-security--compliance-considerations)
12. [MVP Scope & Phasing](#12-mvp-scope--phasing)
13. [Success Metrics](#13-success-metrics)
14. [Risks & Mitigations](#14-risks--mitigations)
15. [Demo Setup & Running Guide](#15-demo-setup--running-guide)
16. [Appendix — Glossary & References](#16-appendix--glossary--references)

---

## 1. Executive Summary

**Previa App** is an autonomous fiscal compliance screening agent designed for tax accounting teams operating in the Mexican regulatory environment. The agent ingests structured lists of RFC (Registro Federal de Contribuyentes) identifiers — provided via CSV or XLS files — and performs automated deep searches across official Mexican government data sources to detect regulatory flags, sanctions, and certificate irregularities affecting any vendor, client, or enterprise under the user's fiscal purview.

The core value proposition is **proactive risk mitigation**: transforming a manual, error-prone, and time-intensive compliance review process into an automated, auditable, and near-real-time alert pipeline.

**MVP Outcome:** A working agent that accepts a file of RFC entries, cross-references them against SAT and DOF public data, and produces a structured compliance risk report with actionable alerts.

**Architecture Principle — Cloud-Native Split:**  
Previa App follows a decoupled frontend/backend architecture designed for cloud deployment from day one:

- **Backend (Agent API):** Python service containerized with Docker, pushed to Docker Hub, and deployed on a cloud compute provider (Northflank, RunPod, AWS Lambda, or similar). Exposes a REST API that handles file ingestion, screening orchestration, risk scoring, and report generation.
- **Frontend (Dashboard):** Next.js application deployed on Vercel. Provides the user-facing upload interface, real-time screening progress, interactive results explorer, and report downloads.
- **Communication:** Frontend calls the backend API over HTTPS. File uploads go through a presigned-URL flow or direct multipart POST. Long-running scans use polling or server-sent events (SSE) for progress updates.

---

## 2. Problem Statement

### Current State

Fiscal accounting teams in Mexico must manually verify whether their clients, vendors, and associated entities are listed in any of the following public regulatory sanctions:

- **Article 69-B CFF (EFOS/EDOS):** Taxpayers presumed or confirmed to issue invoices for simulated operations (operaciones inexistentes).
- **Article 69 CFF:** Non-compliant taxpayers with firm debts, not-located status, cancelled credits, or criminal fiscal sentences.
- **Digital Certificate Status:** Expired, revoked, or absent CSD/e.firma certificates that could signal fiscal irregularities.

### Pain Points

| Pain Point | Impact |
|---|---|
| Manual RFC-by-RFC lookups on SAT and DOF portals | Hours of analyst time per review cycle |
| DOF publications are unstructured text/PDF tables embedded in legal notices | High risk of missed entries |
| No proactive alerting — discovery is reactive | Potential deduction of simulated invoices (30-day correction window under Art. 69-B) |
| Certificate status not systematically tracked | Undetected CSD revocations leading to invalid CFDI acceptance |
| Audit trail gaps | Difficulty proving due diligence to SAT during audits |

### Business Risk

Under Article 69-B of the CFF, if a taxpayer uses CFDIs from a supplier classified as **definitivo** (confirmed EFOS), they have only **30 calendar days** to demonstrate the operations were real or self-correct their fiscal position — including paying omitted taxes, surcharges, and penalties. Failure to detect this exposure promptly can result in catastrophic financial and legal consequences.

---

## 3. Product Vision & Persona

### Agent Identity

- **Name:** Previa App (pronounced "previa" — evoking "prevención" / prevention)
- **Persona:** She/her — a vigilant fiscal compliance analyst
- **Tone:** Professional, precise, alert-oriented — never alarmist, always evidence-based

### Target Users

| Role | Need |
|---|---|
| Fiscal Director / CFO | Executive dashboard — high-level risk exposure across the entity portfolio |
| Tax Compliance Analyst | Detailed per-RFC alert reports with source links and timestamps |
| External Auditor | Exportable audit trail proving systematic due diligence |

### User Story (Primary)

> *"As an executive of a fiscal/tax accounting team, I need to upload a CSV or XLS file containing RFC numbers and entity names, and receive a comprehensive compliance report identifying which entities are flagged in any official DOF/SAT regulatory list — so I can take timely action before facing fiscal penalties."*

### 3.4 Dashboard Structure (UI)

The application is organized into **four key sections** plus a global **Navbar**. All sections are reachable from the navbar after login.

| # | Section | Purpose |
|---|---|---|
| **1** | **New Dataset / RFC search & upload** | Add RFCs to monitor: single RFC search, bulk upload (CSV/XLSX), or paste list. Validate format and attach optional metadata (relationship, internal ID, tags). New entries feed into watchlists and the Tablero. |
| **2** | **Tablero (Dashboard)** | Central screening view for all RFC watchlists. Shows all monitored RFCs with **all available indicators**: Art. 69, 69 Bis, 69-B, 49 Bis flags; presunto/definitivo/desvirtuado/sentencia favorable; CSD status; risk level. User can **group**, **tag**, **name**, and **manage watchlists** (create, rename, archive, export). Filter and sort by risk, list type, date. |
| **3** | **Chat** | Tax and accounting consultation within the Mexican tax/legal ecosystem. User can ask questions in natural language, **upload files** (PDF, XLSX, CFDI), and share **links or URLs** (e.g. DOF, SAT). Previa App (and Prevenco, where applicable) assists with interpretation of CFF articles, DOF notices, SAT lists, and compliance advice. |
| **4** | **Navbar** | Persistent top navigation: links to **New Dataset / RFC upload**, **Tablero**, **Chat**; user menu (profile, settings, logout); optional alert bell for critical findings; package/consulting hours indicator (e.g. 3 hours/month). |

**Wireframe-style flow:** Login → Navbar (always visible) → choose New Dataset to add RFCs → Tablero to see all watchlists and indicators → Chat for consultation and file/link uploads.

### 3.5 Use Cases

| Use case | Description |
|---|---|
| **Automatic alerts** | Send automatic alerts to clients when taxpayers they monitor are listed under **Articles 69, 69 Bis, 69-B, and 49 Bis** of the CFF and published in the DOF. Alerts cover: taxpayers **presumed** in violation, taxpayers **definitively** found in violation, and taxpayers who **successfully refuted** allegations through legal recourse. |
| **Immediate assistance (Prevenco)** | Previa App is the portal to receive **immediate assistance from Prevenco** when any of the user’s suppliers or clients appear on the published lists. |
| **Consulting hours** | Previa App includes **consulting hours per month** (e.g. **3 hours**); exact quota may vary by package. Consumed in the Chat section for tax/legal consultation. |
| **CSD (Digital Seal Certificate) status** | Allow the user to obtain information on whether a taxpayer (supplier or client) has a **blocked or canceled CSD**, and the **reason**. This flow is **manual** (user requests; result delivered via Chat or Tablero). |
| **Reputational / press risk** | Help the user find out if a supplier or client is **linked to a scandalous or high-risk newspaper article** that could pose reputational or business risk. |
| **DOF notice delivery** | Request the **latest official notice** published in the DOF for any of the scenarios (69, 69 Bis, 69-B, 49 Bis). Users can **subscribe** to receive the latest published notice **even when none of their registered RFCs** appear on that list (e.g. for market or sector monitoring). |

### 3.6 How to Use Previa App

1. **Log in** — Access the portal with credentials (demo: `user@example.com` / `1234`).
2. **Options bar (Navbar)** — From the top bar, the user can:
   - **Add RFCs** (Mexican Taxpayer IDs) for Previa App to monitor.
   - **Register** RFCs (single or bulk), **group** them into watchlists, and **name/tag** them.
   - **Request advice** — Open Chat for tax/accounting consultation (within monthly consulting hours).
   - **Request CSD consultation** — Ask for Digital Seal Certificate status and reason for block/cancellation for any taxpayer.
   - **Request background on newspaper articles** — Ask for press/reputational risk for specific taxpayers.
   - **Request latest DOF notice** — Get the most recent official notice published in the DOF for the relevant scenarios (69, 69 Bis, 69-B, 49 Bis).
   - **Subscribe to DOF notices** — Contract to receive the latest published notice even when none of the user’s registered RFCs are on that list.
3. **Tablero** — Review all watchlists, indicators, and flags in one place; manage groups and tags; export or archive lists.
4. **Chat** — Upload files, paste links/URLs, and ask questions for consultation (consumes consulting hours where applicable).

### 3.7 Design — Color Palette

Previa App uses a consistent palette across the dashboard, Tablero, and Chat. Use these hex values (with `#` prefix in code) for backgrounds, surfaces, accents, and text.

| Token | Hex | Usage |
|---|---|---|
| **Background** | `#E6EDF9` | Page background (lightest). |
| **Surface** | `#D7E6F6` | Cards, panels, raised surfaces. |
| **Primary light** | `#BCD8F9` | Light primary fills, hover states, subtle borders. |
| **Accent** | `#ACD0FF` | Links, primary buttons, focus rings, key CTAs. |
| **Muted** | `#AABACA` | Secondary text, borders, disabled states, tags. |
| **Ink** | `#261F1A` | Body text, headings (dark brown). |
| **Navy** | `#191B56` | Navbar, footer, primary brand, strong accents. |

**Tailwind (CSS variables):** Expose these in `tailwind.config.ts` and/or `app/globals.css` so components can use e.g. `bg-previa-background`, `text-previa-ink`, `bg-previa-navy`. Example extension:

```js
// tailwind.config.ts — theme.extend.colors
colors: {
  previa: {
    background: '#E6EDF9',
    surface: '#D7E6F6',
    'primary-light': '#BCD8F9',
    accent: '#ACD0FF',
    muted: '#AABACA',
    ink: '#261F1A',
    navy: '#191B56',
  },
}
```

**Risk badges (keep distinct):** Keep existing semantic colors for risk levels (e.g. red/orange/yellow/green for CRITICAL/HIGH/MEDIUM/CLEAR) so the Tablero remains scannable; use the palette above for chrome, navbar, and cards.

**Typography:** All UI uses **JetBrains Mono** as the primary font family (headings, body, inputs, tables, Chat). Load via [Google Fonts](https://fonts.google.com/specimen/JetBrains+Mono), [next/font](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) (`next/font/google`, `JetBrains_Mono`), or self-hosted. Apply globally in the root layout (e.g. `font-sans` or `font-mono` mapped to JetBrains Mono in Tailwind).

---

## 4. Regulatory & Legal Context

### 4.1 Article 69-B — Código Fiscal de la Federación (CFF)

**What it is:** The SAT's mechanism for identifying taxpayers that issued CFDIs (invoices) without having the assets, personnel, infrastructure, or material capacity to deliver the goods/services described.

**Classification statuses:**

| Status | Meaning | Risk Level |
|---|---|---|
| **Presunto** | Under investigation — presumption notified | HIGH — Monitor closely |
| **Desvirtuado** | Taxpayer successfully rebutted presumption | LOW — Cleared |
| **Definitivo** | Confirmed — operations declared non-existent | CRITICAL — Immediate action required |
| **Sentencia Favorable** | Court ruling in taxpayer's favor post-definitivo | LOW — Resolved |

**Legal basis consulted:**
- [DOF Oficio 500-05-2021-15394](https://www.dof.gob.mx/nota_detalle_popup.php?codigo=5629553) — Global presumption list (Art. 69-B, para. 1)
- [DOF Oficio 500-05-2025-35855](https://dof.gob.mx/nota_detalle.php?codigo=5776008&fecha=12/12/2025) — Latest 2025 publication

### 4.2 Article 69 — CFF (General Non-Compliance)

Covers four categories of non-compliant taxpayers published by SAT:

1. **Créditos Fiscales Firmes** — Taxpayers with firm, enforceable tax debts
2. **No Localizados** — Taxpayers whose fiscal domicile cannot be verified
3. **Créditos Cancelados** — Cancelled tax credits (often indicating inability to collect)
4. **Sentencia Condenatoria por Delito Fiscal** — Criminal convictions for fiscal crimes

### 4.3 Article 49 Bis — CFF (Relevant DOF Lists)

Article 49 Bis of the CFF is part of the set of provisions whose breach leads to publication of taxpayer lists in the DOF. Previa App monitors and alerts on lists derived from **Articles 69, 69 Bis, 69-B, and 49 Bis**, as published in the Official Gazette of the Federation (presumed, definitive, and refuted cases).

### 4.4 Digital Certificate Compliance

Under Mexican fiscal law, all taxpayers must maintain valid:
- **e.firma (FIEL):** Electronic signature certificate for identity authentication
- **CSD (Certificado de Sello Digital):** Certificate for stamping/signing CFDIs

A revoked, expired, or absent CSD is a red flag — SAT may revoke CSDs as a sanction under Article 17-H of the CFF.

---

### 4.5 Article Coverage & Risk Scoring

Previa App screens RFCs against **four critical Mexican tax compliance articles**:

1. **Article 69-B** — EFOS/EDOS (Empresas que Facturan Operaciones Simuladas)
2. **Article 69** — Non-compliance lists (4 categories)
3. **Article 69 BIS** — Additional compliance requirements
4. **Article 49 BIS** — DOF publication violations

#### Article 69-B — EFOS/EDOS

Companies that issue invoices for simulated operations (shell companies). The SAT publishes lists of taxpayers in the following statuses:

- **Presunto** — Presumed EFOS/EDOS (under investigation)
- **Definitivo** — Definitive EFOS/EDOS (confirmed)
- **Desvirtuado** — Status cleared (taxpayer proved legitimacy)
- **Sentencia Favorable** — Favorable court ruling

**Risk Scoring:**

| Status | Risk Score | Risk Level |
|--------|-----------|------------|
| Definitivo | 100 | CRITICAL |
| Presunto | 80 | CRITICAL |
| Desvirtuado | 10 | LOW |
| Sentencia Favorable | 5 | LOW |

**Implementation:** `backend/app/agent/tools/sat_69b_tool.py`

**Demo RFCs:** `CAL080328S18` (Definitivo), `ACA0604119X3` (Presunto)

#### Article 69 — Non-Compliance Lists

Four categories of non-compliant taxpayers:

1. **Créditos Fiscales Firmes** — Firm, enforceable tax debts
2. **No Localizados** — Taxpayers whose fiscal domicile cannot be verified
3. **Créditos Cancelados** — Cancelled tax credits
4. **Sentencia Condenatoria por Delito Fiscal** — Criminal convictions for fiscal crimes

**Risk Scoring:**

| Category | Risk Score | Risk Level |
|----------|-----------|------------|
| Sentencia Condenatoria | 95 | CRITICAL |
| No Localizado | 70 | HIGH |
| Crédito Firme | 60 | HIGH |
| Crédito Cancelado | 40 | MEDIUM |

**Implementation:** `backend/app/agent/tools/sat_69_tool.py`

**Demo RFCs:** `GFS1109204G1` (No Localizado), `BAD180409H32` (Crédito Firme)

#### Article 69 BIS — Additional Compliance

Additional compliance requirements and sanctions related to fiscal obligations and transparency requirements.

**Implementation:** `backend/app/agent/tools/sat_69_bis_tool.py`

**Status:** Placeholder implementation — no mock data yet.

**Future Scope:** Integration with SAT datasets when available; specific violation type classification; publication date tracking.

#### Article 49 BIS — DOF Publications

Provisions whose breach leads to publication of taxpayer lists in the Diario Oficial de la Federación (DOF). Previa App monitors and alerts on lists derived from Articles 69, 69 BIS, 69-B, and 49 BIS.

**Implementation:** `backend/app/agent/tools/sat_49_bis_tool.py`

**Status:** Placeholder implementation — no mock data yet.

**Future Scope:** DOF publication scraping and parsing; violation type classification; historical publication tracking.

#### Risk Aggregation

Previa App uses **maximum score aggregation** — the highest risk finding determines the overall risk level:

```python
# Example: RFC with multiple findings
findings = {
    "art_69b_status": "presunto",           # Score: 80
    "art_69_categories": ["no_localizado"], # Score: 70
}
# Overall risk = max(80, 70) = 80 → CRITICAL
```

---

### 4.6 Screening Pipeline Details

#### Screening Workflow

For each RFC, Previa App performs the following checks in sequence:

```
1. Validate RFC format
   ↓
2. Screen Art. 69-B (EFOS/EDOS)
   ↓
3. Screen Art. 69 (4 categories)
   ↓
4. Screen Art. 69 BIS
   ↓
5. Screen Art. 49 BIS
   ↓
6. Check certificate status (Phase 2)
   ↓
7. Calculate risk score (max aggregation)
   ↓
8. Store results + audit logs
```

Each screening generates **4 audit log entries** per RFC:
- `sat_69b` — Art. 69-B screening result
- `sat_69` — Art. 69 screening result
- `sat_69_bis` — Art. 69 BIS screening result
- `sat_49_bis` — Art. 49 BIS screening result

#### Data Sources (Production)

| Article | Source | URL | Format | Update Frequency |
|---------|--------|-----|--------|------------------|
| 69-B | SAT Lista de Contribuyentes Art. 69-B | https://www.sat.gob.mx/consulta/operaciones/28821 | CSV/Excel | Monthly (or as published in DOF) |
| 69 | SAT Contribuyentes Incumplidos | https://datos.gob.mx/dataset/contribuyentes_incumplidos | JSON/CSV | Quarterly |
| 69 BIS & 49 BIS | DOF Publications | https://www.dof.gob.mx/ | PDF/HTML | Daily monitoring |

#### API Response Structure (Single RFC Lookup)

```json
{
  "rfc": "CAL080328S18",
  "razon_social": "COMERCIALIZADORA ALCAER, S.A. DE C.V.",
  "risk_score": 100,
  "risk_level": "CRITICAL",
  "art_69b": {
    "found": true,
    "status": "definitivo",
    "oficio_number": "500-39-00-02-02-2021-5221",
    "authority": "SAT",
    "motivo": "Ausencia de Activos, Ausencia de Personal...",
    "dof_url": "https://dof.gob.mx/nota_detalle.php?codigo=5629553"
  },
  "art_69": {
    "found": false,
    "categories": []
  },
  "certificates": {
    "checked": false
  },
  "screened_at": "2026-02-16T20:34:08Z"
}
```

#### Testing

```bash
# Art. 69-B Definitivo (CRITICAL)
curl -X POST http://localhost:8000/api/rfc/CAL080328S18

# Art. 69 No Localizado (HIGH)
curl -X POST http://localhost:8000/api/rfc/GFS1109204G1

# Clean RFC (CLEAR)
curl -X POST http://localhost:8000/api/rfc/ABC123456XY9
```

Upload `backend/tests/fixtures/demo_input.csv` via the frontend to test all articles simultaneously.

#### Future Enhancements

**Phase 2:**
- Real SAT dataset integration
- Certificate status checking (CSD validation)
- XLSX report with article breakdown

**Phase 3:**
- Scheduled re-screening (detect status changes)
- Email alerts on new findings
- DOF publication monitoring with LLM parsing
- Historical trend analysis

---

## 5. Functional Requirements

### 5.1 Core Capabilities (MVP)

| ID | Requirement | Priority | Description |
|---|---|---|---|
| FR-01 | **File Ingestion** | P0 | Accept CSV and XLS/XLSX files containing at minimum: RFC, entity name (razón social). Optional columns: entity type, relationship (client/vendor/partner), internal ID. |
| FR-02 | **RFC Validation** | P0 | Validate RFC format (13 chars for personas físicas, 12 for personas morales) and structure before processing. Flag malformed RFCs. |
| FR-03 | **Art. 69-B Screening** | P0 | Cross-reference every RFC against the SAT's published Article 69-B lists (Presuntos, Definitivos, Desvirtuados, Sentencias Favorables). |
| FR-04 | **Art. 69 Screening** | P0 | Cross-reference every RFC against the SAT's Article 69 non-compliance lists (firm debts, not-located, cancelled credits, criminal sentences). |
| FR-05 | **DOF Search & Note Parsing** | P1 | Automate search on [dof.gob.mx](https://dof.gob.mx/), discover relevant notas (e.g. by codigo), fetch note pages (e.g. [nota_detalle_popup.php?codigo=5629553](https://www.dof.gob.mx/nota_detalle_popup.php?codigo=5629553)), and parse to extract RFC lists and compliance metadata for 69-B and related sanctions. |
| FR-06 | **Certificate Status Check** | P1 | Query the SAT Certificate Recovery Portal to retrieve and evaluate certificate status (active, expired, revoked) for each RFC. |
| FR-07 | **Risk Classification** | P0 | Assign a risk level (CRITICAL / HIGH / MEDIUM / LOW / CLEAR) to each entity based on aggregated findings. |
| FR-08 | **Structured Report Output** | P0 | Generate a downloadable compliance report (XLSX, PDF, and/or JSON) with per-entity findings, risk levels, source URLs, and timestamps. |
| FR-09 | **Alert Notifications** | P1 | Send email/webhook notifications for CRITICAL and HIGH risk findings immediately upon detection. |
| FR-10 | **Audit Trail** | P0 | Log every query, source consulted, result obtained, and timestamp for regulatory audit defensibility. |

### 5.2 UI & Dashboard Requirements

| ID | Requirement | Priority | Description |
|---|---|---|---|
| FR-UI-1 | **New Dataset / RFC upload section** | P0 | Dedicated screen: single RFC search, bulk CSV/XLSX upload, validation, optional metadata (relationship, internal ID). Feeds into watchlists and Tablero. |
| FR-UI-2 | **Tablero (dashboard)** | P0 | Single view of all RFC watchlists with all indicators: Art. 69, 69 Bis, 69-B, 49 Bis; presunto/definitivo/desvirtuado/sentencia favorable; CSD status; risk level. Filter and sort. |
| FR-UI-3 | **Watchlist management** | P0 | Create, rename, archive, export watchlists; **group** and **tag** RFCs; **name** lists for quick identification. |
| FR-UI-4 | **Chat section** | P0 | Tax/accounting consultation in Mexican tax/legal context. **Upload files** (PDF, XLSX, CFDI), paste **links/URLs** (DOF, SAT). Natural-language Q&A; consumption of consulting hours (e.g. 3 h/month) where applicable. |
| FR-UI-5 | **Navbar** | P0 | Persistent top bar: links to New Dataset, Tablero, Chat; user menu; alert bell; optional consulting-hours remaining. |
| FR-UI-6 | **CSD consultation request** | P1 | User can request (manual) check for blocked/canceled CSD for a taxpayer and reason; result in Chat or Tablero. |
| FR-UI-7 | **Newspaper / reputational risk** | P1 | Request background on scandalous or high-risk press coverage linked to a taxpayer. |
| FR-UI-8 | **DOF notice request & subscription** | P1 | Request latest DOF notice for 69/69 Bis/69-B/49 Bis; optional subscription to receive latest notice even when no registered RFCs are on the list. |

### 5.3 Extended Capabilities (Post-MVP)

| ID | Requirement | Priority | Description |
|---|---|---|---|
| FR-11 | Scheduled/periodic re-screening | P2 | Automatically re-run screening on a saved portfolio at configurable intervals (daily/weekly/monthly). |
| FR-12 | Chat deep integration | P2 | Chat linked to Tablero data: "Is RFC XYZ123 flagged?", "Show me all critical alerts from last week." |
| FR-13 | SAT 69-B status change detection | P2 | Detect when an entity's status transitions (e.g., Presunto → Definitivo) and alert immediately. |
| FR-14 | Multi-tenant support | P3 | Support multiple accounting firms/teams with isolated data. |
| FR-15 | CFDI cross-validation | P3 | Accept CFDI XML files and validate emitter RFCs against all lists. |

---

## 6. Data Sources & Integrations

### 6.1 Primary Data Sources

| Source | URL / Endpoint | Data Format | Access Method | Update Frequency |
|---|---|---|---|---|
| **SAT — Lista 69-B** (Official) | `https://www.sat.gob.mx/consultas/76674/consulta-la-relacion-de-contribuyentes-con-operaciones-presuntamente-inexistentes` | HTML / downloadable files | Web scraping + downloadable CSV/XLS from SAT open data | Irregular — upon new DOF publication |
| **SAT — Datos Abiertos** | `http://omawww.sat.gob.mx/cifras_sat/Paginas/DatosAbiertos/index.html` | CSV / Open Data | Direct HTTP download | Periodic (check monthly) |
| **datos.gob.mx — Contribuyentes Incumplidos** | `https://datos.gob.mx/dataset/contribuyentes_incumplidos` | CSV / JSON API | REST API / direct download | Updated periodically by SAT |
| **DOF — Diario Oficial de la Federación** | See [6.1.1 DOF search automation](#611-dof-search-automation) below | HTML (unstructured legal text with embedded tables) | Automated search → note discovery → parsing | Daily publication |
| **SAT — Recuperación de Certificados** | `https://portalsat.plataforma.sat.gob.mx/RecuperacionDeCertificados/faces/consultaCertificados.xhtml` | HTML (JSF web app with CAPTCHA) | Controlled browser automation (Selenium/Playwright) | Real-time |

### 6.1.1 DOF Search Automation

The automation target for fiscal publication discovery is the **Diario Oficial de la Federación** portal. The agent must replicate the manual workflow: search the DOF, find relevant publications (notas), then open and parse each note to extract RFC lists and compliance metadata.

| Step | URL / Action | Purpose |
|---|---|---|
| **1. Search entry point** | [https://dof.gob.mx/](https://dof.gob.mx/) | Main DOF portal — search by date, keyword, or section to discover relevant editions and documents. |
| **2. Result type to automate** | Individual note/detail pages | Each fiscal publication (e.g. Art. 69-B oficios) appears as a **nota** with a unique `codigo`. The agent must discover and fetch these pages. |
| **3. Note detail URL pattern** | `https://www.dof.gob.mx/nota_detalle_popup.php?codigo=XXXXX` | Popup variant — single note content. |
| **3 (alt)** | `https://dof.gob.mx/nota_detalle.php?codigo=XXXXX&fecha=DD/MM/YYYY` | Full-site variant — same content with date in path. |
| **4. Example target result** | [nota_detalle_popup.php?codigo=5629553](https://www.dof.gob.mx/nota_detalle_popup.php?codigo=5629553) | Oficio 500-05-2021-15394 — global list of contribuyentes in Art. 69-B presumption; contains RFC table + razón social + oficio metadata. |

**Automation scope:**

- **Search on** [dof.gob.mx](https://dof.gob.mx/): Use the site’s search (by date range, keyword e.g. “69-B”, “artículo 69-B”, “presunción”) or browse by date to get a list of matching notas and their `codigo` values.
- **Fetch each note**: For each discovered `codigo`, request the note HTML (popup or full URL) and store it for parsing.
- **Parse note content**: Extract from the HTML (or LLM-assisted extraction): oficio number, publication date, authority, and the embedded table of RFC + razón social + oficio de presunción, etc. Normalize and index for cross-reference with the user’s input RFC list.

This DOF search → note discovery → parse flow is the **file search we need to automate on dof.gob.mx**; the concrete output of that search is pages like the example above, which the agent must process to populate Art. 69-B (and related) findings in the compliance report.

### 6.2 Third-Party API Options (Accelerators)

| Provider | Endpoint | Capability | Pricing Model |
|---|---|---|---|
| **Reachcore** | `https://go.reachcore.com/api/rest/listas/l69b` | REST API for 69-B list queries by RFC | API Key — subscription |
| **FacturoPorti** | `https://developers.facturoporti.com.mx/reference/validar-listas-negras-efos-sat` | EFOS validation by RFC | Per-query or subscription |
| **PLD México** | `https://pldmexico.com/lista69b.html` | 69-B list lookups | Subscription |

> **MVP Recommendation:** Use SAT's open data downloads + datos.gob.mx as primary source (free, official). Evaluate Reachcore API as an accelerator for real-time individual RFC lookups. Avoid dependency on a single third-party provider.

### 6.3 Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     VERCEL (Frontend)                            │
│                                                                 │
│  Next.js App — previa.vercel.app                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Navbar: New Dataset | Tablero | Chat | Alerts | User menu  ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ 1. New       │ │ 2. Tablero   │ │ 3. Chat                  │ │
│  │ Dataset /    │ │ (Dashboard)   │ │ (Consultation + files,   │ │
│  │ RFC search   │ │ Watchlists,   │ │  links, URLs; 3h/month   │ │
│  │ & upload     │ │ flags, tags,  │ │  consulting)             │ │
│  │              │ │ groups       │ │                          │ │
│  └──────┬───────┘ └──────┬───────┘ └────────────┬─────────────┘ │
│         └────────────────┴─────────────────────┘                │
│                           │ HTTPS                               │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼  REST API
┌───────────────────────────────────────────────────────────────────┐
│           CLOUD COMPUTE (Northflank / RunPod / Lambda)            │
│           Docker Image: previadocker/previa-api:latest             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    FastAPI Application                        │ │
│  │                                                              │ │
│  │  POST /api/scan          — Upload file, start screening      │ │
│  │  GET  /api/scan/:id      — Poll scan status & progress       │ │
│  │  GET  /api/scan/:id/report — Download generated report       │ │
│  │  GET  /api/health        — Health check                      │ │
│  │  POST /api/rfc/:rfc      — Single RFC lookup                 │ │
│  │                                                              │ │
│  │  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────┐  │ │
│  │  │ RFC Parser & │  │  Orchestrator   │  │  Risk Scoring   │  │ │
│  │  │  Validator   │──│  & Agent Core   │──│  Engine         │  │ │
│  │  └─────────────┘  └────────┬────────┘  └─────────────────┘  │ │
│  │                            │                                 │ │
│  │         ┌──────────────────┼──────────────┐                  │ │
│  │         ▼                  ▼              ▼                  │ │
│  │  ┌────────────┐   ┌────────────┐   ┌──────────┐             │ │
│  │  │69-B Screener│  │Art.69      │   │Cert      │             │ │
│  │  │(SAT + API) │   │Screener    │   │Checker   │             │ │
│  │  └─────┬──────┘   └─────┬──────┘   └────┬─────┘             │ │
│  │        │                │               │                    │ │
│  │        ▼                ▼               ▼                    │ │
│  │  ┌──────────────────────────────────────────────────────┐    │ │
│  │  │        Report Generator & Alert Dispatcher           │    │ │
│  │  └──────────────────────────────────────────────────────┘    │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──────────────┐  ┌─────────────────────────────────────────┐   │
│  │  PostgreSQL   │  │  Persistent Volume: /data               │   │
│  │  (or SQLite)  │  │  SAT datasets, reports, audit logs      │   │
│  └──────────────┘  └─────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
   ┌────────────────┐ ┌──────────┐ ┌──────────────┐
   │  SAT Open Data │ │  DOF.gob │ │ Reachcore /  │
   │  datos.gob.mx  │ │  .mx     │ │ 3rd-party API│
   └────────────────┘ └──────────┘ └──────────────┘
```

---

## 7. Technical Architecture

### 7.1 Technology Stack

#### Backend (Docker → Cloud)

| Layer | Technology | Rationale |
|---|---|---|
| **Language** | Python 3.11+ | Rich ecosystem for data processing, web scraping, and AI/ML |
| **API Framework** | FastAPI + Uvicorn | Async-native REST API with auto-generated OpenAPI docs; production-grade ASGI server |
| **Agent Framework** | LangChain / LangGraph or CrewAI | Structured agent orchestration with tool-use patterns |
| **LLM Backend** | Anthropic Claude (via API) | DOF text parsing, entity extraction, natural language report generation |
| **File Processing** | `pandas` + `openpyxl` | CSV/XLSX ingestion and manipulation |
| **Web Scraping** | `Playwright` (async) | SAT certificate portal (JSF + CAPTCHA handling) |
| **CAPTCHA Solving** | `2Captcha` / `Anti-Captcha` API | SAT portal requires CAPTCHA for certificate queries |
| **HTTP Client** | `httpx` (async) | REST API calls to SAT open data and third-party services |
| **Database** | PostgreSQL (via `asyncpg` + `SQLAlchemy`) | Audit trail, entity cache, screening history, scan jobs |
| **Task Queue** | `asyncio` background tasks (MVP) → `Celery` + Redis (scale) | Async scan processing; long-running jobs don't block API |
| **File Storage** | Local volume (MVP) → S3-compatible (production) | Uploaded files and generated reports |
| **Report Generation** | `openpyxl` (XLSX) + `WeasyPrint` or `reportlab` (PDF) | Structured compliance reports |
| **Notifications** | SMTP (email) + webhook (Slack/Teams) | Alert delivery |
| **Containerization** | Docker → Docker Hub | `previadocker/previa-api:latest` pushed to public/private registry |
| **Cloud Compute** | Northflank / RunPod / AWS Lambda | Pull image from Docker Hub, run as persistent service or serverless |

#### Frontend (Vercel)

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js 14+ (App Router) | React-based, SSR/SSG capable, API routes for BFF pattern |
| **Language** | TypeScript | Type safety across the frontend codebase |
| **Styling** | Tailwind CSS + shadcn/ui | Rapid, professional UI with accessible component library |
| **Typography** | JetBrains Mono | Single font family for all UI (see §3.7) |
| **State Management** | TanStack Query (React Query) | Server-state sync, polling for scan progress, caching |
| **File Upload** | `react-dropzone` | Drag-and-drop CSV/XLSX upload |
| **Charts / Viz** | Recharts or Tremor | Risk dashboards, portfolio-level visualizations |
| **Auth** | NextAuth.js | Demo account + future OAuth/SSO integration |
| **Deployment** | Vercel | Zero-config Next.js deployment, edge functions, preview deploys |
| **Environment** | Vercel env vars | `NEXT_PUBLIC_API_URL` points to backend cloud URL |

### 7.2 Repository Structure (Monorepo)

```
previa-app/
├── backend/                          # Python API — Docker container
│   ├── app/
│   │   ├── main.py                   # FastAPI entry point
│   │   ├── config/
│   │   │   ├── settings.py           # Env config, API keys, thresholds
│   │   │   └── risk_rules.py         # Risk scoring rules
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── scan.py           # POST /scan, GET /scan/:id
│   │   │   │   ├── rfc.py            # POST /rfc/:rfc (single lookup)
│   │   │   │   ├── reports.py        # GET /scan/:id/report
│   │   │   │   └── health.py         # GET /health
│   │   │   ├── middleware/
│   │   │   │   ├── auth.py           # API key / JWT auth middleware
│   │   │   │   └── cors.py           # CORS config for Vercel origin
│   │   │   └── schemas/
│   │   │       ├── scan.py           # Pydantic request/response models
│   │   │       └── rfc.py            # RFC lookup models
│   │   ├── agent/
│   │   │   ├── orchestrator.py       # Main agent orchestration logic
│   │   │   ├── tools/
│   │   │   │   ├── rfc_validator.py  # RFC format validation
│   │   │   │   ├── sat_69b_tool.py   # Article 69-B list screening
│   │   │   │   ├── sat_69_tool.py    # Article 69 non-compliance screening
│   │   │   │   ├── dof_parser_tool.py# DOF publication parser
│   │   │   │   ├── cert_checker.py   # SAT certificate portal automation
│   │   │   │   └── third_party_api.py# Reachcore / FacturoPorti wrappers
│   │   │   └── prompts/
│   │   │       ├── system_prompt.py  # Previa App personality and instructions
│   │   │       └── analysis_prompt.py# DOF text analysis templates
│   │   ├── data/
│   │   │   ├── ingest/
│   │   │   │   └── file_parser.py    # CSV/XLSX ingestion
│   │   │   ├── sources/
│   │   │   │   ├── sat_open_data.py  # SAT data downloader/updater
│   │   │   │   └── dof_scraper.py    # DOF publication scraper
│   │   │   └── db/
│   │   │       ├── models.py         # SQLAlchemy ORM models
│   │   │       ├── session.py        # DB session factory
│   │   │       └── migrations/       # Alembic migrations
│   │   ├── scoring/
│   │   │   └── risk_engine.py        # Aggregated risk scoring
│   │   └── reporting/
│   │       ├── excel_report.py       # XLSX report generator
│   │       ├── pdf_report.py         # PDF report generator
│   │       └── alert_dispatcher.py   # Email/webhook alerts
│   ├── tests/
│   │   ├── test_rfc_validator.py
│   │   ├── test_69b_screening.py
│   │   ├── test_risk_engine.py
│   │   ├── test_api_scan.py
│   │   └── fixtures/
│   │       ├── sample_input.csv
│   │       └── mock_69b_response.json
│   ├── Dockerfile                    # Multi-stage build for production
│   ├── docker-compose.yml            # Local dev: API + PostgreSQL + Redis
│   ├── requirements.txt
│   ├── alembic.ini
│   └── .env.example
│
├── frontend/                         # Next.js app — Vercel deployment
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx            # Root layout + Navbar (4 sections)
│   │   │   ├── page.tsx              # Landing / login page
│   │   │   ├── dataset/              # 1. New Dataset / RFC search & upload
│   │   │   │   └── page.tsx          # Single RFC search, bulk CSV/XLSX upload
│   │   │   ├── tablero/              # 2. Tablero — watchlists, flags, groups, tags
│   │   │   │   ├── page.tsx          # All watchlists + indicators (69, 69 Bis, 69-B, 49 Bis, CSD)
│   │   │   │   └── [watchlistId]/
│   │   │   │       └── page.tsx      # Single watchlist detail / export
│   │   │   ├── chat/                 # 3. Chat — consultation, files, links, URLs
│   │   │   │   └── page.tsx          # Tax/legal Q&A; file/link upload; consulting hours
│   │   │   └── api/
│   │   │       └── auth/
│   │   │           └── [...nextauth]/
│   │   │               └── route.ts  # NextAuth API route
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui components
│   │   │   ├── navbar.tsx             # Navbar: Dataset | Tablero | Chat | Alerts | User
│   │   │   ├── file-upload.tsx       # Drag-and-drop CSV/XLSX upload
│   │   │   ├── risk-badge.tsx        # Color-coded risk level badge
│   │   │   ├── watchlist-table.tsx   # Tablero: RFCs, flags, tags, groups
│   │   │   ├── chat-panel.tsx        # Chat UI + file/link attach
│   │   │   └── alert-banner.tsx      # Critical alert banners
│   │   ├── lib/
│   │   │   ├── api-client.ts         # Typed HTTP client for backend API
│   │   │   └── auth.ts               # NextAuth config (demo + OAuth)
│   │   └── types/
│   │       └── index.ts              # Shared TypeScript interfaces
│   ├── public/
│   │   └── previa-logo.svg
│   ├── next.config.js
│   ├── tailwind.config.ts            # theme.extend.colors.previa (see §3.7)
│   ├── src/app/globals.css           # CSS vars for previa palette (optional)
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example                  # NEXT_PUBLIC_API_URL, NEXTAUTH_SECRET
│
├── .github/
│   └── workflows/
│       ├── backend-ci.yml            # Build, test, push Docker image
│       └── frontend-ci.yml           # Lint, test, trigger Vercel deploy
├── .gitignore
├── docker-compose.yml                # Root: full stack local dev
└── README.md
```

### 7.3 Deployment Topology

```
┌──────────────────────────────────────────────────────────────────┐
│                        DEVELOPER MACHINE                         │
│                                                                  │
│  git push ──► GitHub repo (previa-app)                           │
│               │                                                  │
│               ├── GitHub Actions: backend-ci.yml                 │
│               │   ├── Run pytest                                 │
│               │   ├── docker build                               │
│               │   └── docker push previadocker/previa-api:latest │
│               │                        │                         │
│               │                        ▼                         │
│               │              ┌──────────────────┐                │
│               │              │   Docker Hub      │                │
│               │              │   (Image Registry)│                │
│               │              └────────┬─────────┘                │
│               │                       │ pull                     │
│               │                       ▼                          │
│               │         ┌─────────────────────────┐              │
│               │         │ Northflank / RunPod /    │              │
│               │         │ AWS Lambda               │              │
│               │         │ previa-api container     │              │
│               │         │ https://api.previa.app   │              │
│               │         └─────────────────────────┘              │
│               │                                                  │
│               └── Vercel (auto-deploy on push)                   │
│                   ├── Next.js frontend build                     │
│                   └── https://previa.vercel.app                  │
│                       (NEXT_PUBLIC_API_URL=https://api.previa.app)│
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. Data Model

### 8.1 Input Schema

```
Entity {
    rfc: string              // Required — 12 or 13 characters
    razon_social: string     // Required — Legal name
    tipo_persona: enum       // Optional — "fisica" | "moral"
    relacion: enum           // Optional — "cliente" | "proveedor" | "socio" | "otro"
    id_interno: string       // Optional — User's internal reference ID
}
```

### 8.2 Screening Result Schema

```
ScreeningResult {
    entity: Entity
    timestamp: datetime
    overall_risk: enum           // CRITICAL | HIGH | MEDIUM | LOW | CLEAR
    
    art_69b: {
        found: boolean
        status: enum             // presunto | desvirtuado | definitivo | sentencia_favorable | not_found
        oficio_number: string
        publication_date: date
        authority: string
        motivo: string           // e.g., "Ausencia de Activos, Ausencia de Personal"
        dof_url: string
        last_checked: datetime
    }
    
    art_69: {
        found: boolean
        categories: [{
            type: enum           // credito_firme | no_localizado | credito_cancelado | sentencia_condenatoria
            details: string
            publication_date: date
        }]
        last_checked: datetime
    }
    
    certificates: {
        checked: boolean
        efirma: {
            exists: boolean
            status: enum         // active | expired | revoked | not_found
            serial_number: string
            valid_from: date
            valid_to: date
        }
        csd: {
            exists: boolean
            status: enum         // active | expired | revoked | not_found
            serial_number: string
            valid_from: date
            valid_to: date
        }
        last_checked: datetime
    }
    
    audit_log: [{
        source: string
        query: string
        response_summary: string
        timestamp: datetime
        success: boolean
    }]
}
```

### 8.3 Risk Scoring Matrix

| Finding | Risk Score | Risk Level |
|---|---|---|
| Art. 69-B — Definitivo | 100 | CRITICAL |
| Art. 69 — Sentencia Condenatoria | 95 | CRITICAL |
| Art. 69-B — Presunto | 80 | HIGH |
| Art. 69 — No Localizado | 70 | HIGH |
| CSD Revoked | 65 | HIGH |
| Art. 69 — Crédito Firme | 60 | MEDIUM |
| CSD Expired (>90 days) | 50 | MEDIUM |
| Art. 69 — Crédito Cancelado | 40 | MEDIUM |
| CSD Expired (<90 days) | 30 | LOW |
| Art. 69-B — Desvirtuado | 10 | LOW |
| Art. 69-B — Sentencia Favorable | 5 | LOW |
| No findings | 0 | CLEAR |

> **Aggregation rule:** For entities with multiple findings, the overall risk level is determined by the **highest individual score**. The report surfaces all findings regardless of the overall level.

---

## 9. Agent Workflow & Pipeline

### 9.1 Primary Screening Flow

```
START
  │
  ▼
[1] FILE INGESTION
  │  Parse CSV/XLSX → Extract RFC + razón social
  │  Validate RFC format (12/13 chars, check digit)
  │  Deduplicate entries
  │  Log: N valid entities, M invalid/skipped
  │
  ▼
[2] LOCAL CACHE CHECK
  │  Query local DB for recent screening results (<24h)
  │  Serve cached results for unchanged entities
  │  Queue entities needing fresh screening
  │
  ▼
[3] PARALLEL SCREENING (for each entity)
  │
  ├──▶ [3a] ART. 69-B SCREENING
  │     │  Check local indexed 69-B dataset (SAT open data)
  │     │  If not found locally → query third-party API (Reachcore)
  │     │  Classify: presunto / desvirtuado / definitivo / favorable / not_found
  │     │  Extract: oficio, authority, motivo, dates
  │     ▼
  │
  ├──▶ [3b] ART. 69 SCREENING
  │     │  Query datos.gob.mx dataset (local indexed copy)
  │     │  Check: crédito firme, no localizado, cancelado, sentencia
  │     ▼
  │
  └──▶ [3c] CERTIFICATE CHECK (if enabled)
        │  Automate SAT portal query via headless browser
        │  Solve CAPTCHA → Submit RFC → Parse results
        │  Extract: certificate existence, status, dates
        ▼
  
[4] RISK SCORING
  │  Aggregate all findings per entity
  │  Apply risk scoring matrix
  │  Classify overall risk level
  │
  ▼
[5] REPORT GENERATION
  │  Generate XLSX with summary + detail sheets
  │  Generate PDF executive summary (optional)
  │  Generate JSON for programmatic consumption (optional)
  │
  ▼
[6] ALERT DISPATCH
  │  For CRITICAL/HIGH: Send immediate notification (email/webhook)
  │  Include: entity name, RFC, finding summary, recommended action
  │
  ▼
[7] AUDIT LOGGING
  │  Persist all results, queries, and timestamps to database
  │  Generate audit trail exportable for SAT review
  │
  ▼
END → Report delivered to user
```

### 9.2 DOF Monitoring Flow (Background — Post-MVP)

This flow automates the **file search on dof.gob.mx**: search the DOF portal, discover relevant notas (e.g. Art. 69-B oficios), fetch each note by `codigo`, and parse to extract RFC lists. See [Section 6.1.1](#611-dof-search-automation) for the exact URLs and note format (e.g. `nota_detalle_popup.php?codigo=5629553`).

```
CRON (configurable schedule)
  │
  ▼
[1] Search https://dof.gob.mx/ (by date range and/or keyword: "69-B", "artículo 69-B", "presunción")
[2] Discover list of matching notas → extract codigo for each (e.g. 5629553, 5776008)
[3] For each codigo: fetch note page (nota_detalle_popup.php?codigo=XXXXX or nota_detalle.php?codigo=XXXXX&fecha=...)
[4] Parse note HTML: oficio number, authority, publication date, and embedded RFC/razón social table (LLM-assisted if needed)
[5] Extract new RFC entries and merge into local 69-B index
[6] Cross-reference against saved entity portfolio → if matches found, trigger immediate alert
```

---

## 10. Alert & Notification System

### 10.1 Alert Tiers

| Tier | Trigger | Channel | Timing |
|---|---|---|---|
| **CRITICAL** | Art. 69-B Definitivo or Sentencia Condenatoria detected | Email + Webhook + In-app banner | Immediate |
| **HIGH** | Art. 69-B Presunto, No Localizado, or CSD Revoked | Email + In-app | Within 1 hour |
| **MEDIUM** | Crédito Firme, CSD Expired, Crédito Cancelado | In-app + Daily digest email | Next digest cycle |
| **LOW** | Desvirtuado, Sentencia Favorable, minor certificate issues | In-app only | Next report generation |

### 10.2 Alert Content Template

```
═══════════════════════════════════════════════
  ⚠ Previa App — ALERTA FISCAL [CRITICAL]
═══════════════════════════════════════════════

Entidad:      COMERCIALIZADORA ALCAER, S.A. DE C.V.
RFC:          CAL080328S18
Relación:     Proveedor
ID Interno:   PROV-2847

Hallazgo:     Artículo 69-B — DEFINITIVO
Motivo:       Ausencia de Activos, Ausencia de Personal,
              Falta de Infraestructura, Sin Capacidad Material
Oficio:       500-39-00-02-02-2021-5221
Publicación:  DOF 15/07/2021
Fuente:       https://dof.gob.mx/nota_detalle.php?codigo=5629553

Acción Recomendada:
  Tiene 30 días naturales a partir de la publicación para
  demostrar la materialidad de las operaciones o autocorregir
  su situación fiscal conforme al Art. 69-B del CFF.

Fecha de detección: 2026-02-16 14:32:07 CST
═══════════════════════════════════════════════
```

---

## 11. Security & Compliance Considerations

### 11.1 Data Protection

| Concern | Mitigation |
|---|---|
| RFC and entity data are sensitive fiscal information | Encrypt at rest (AES-256) and in transit (TLS 1.3) |
| API keys for third-party services | Store in environment variables or secrets manager (AWS Secrets Manager, HashiCorp Vault) — never in code |
| Audit logs must be immutable | Write-once log storage; append-only database tables with integrity checksums |
| User authentication | OAuth 2.0 / SAML SSO for multi-user deployments (post-MVP: basic auth for single-user MVP) |

### 11.2 Demo & Test Credentials

The application ships with a pre-configured demo account for local testing and stakeholder demonstrations. These credentials are **non-privileged** and intended exclusively for sandbox/demo environments.

| Field | Value |
|---|---|
| **Email** | `user@example.com` |
| **Password** | `1234` |
| **Role** | `analyst` (read + scan permissions, no admin access) |
| **Environment** | Demo / Local only |

> **IMPORTANT — Production Deployments:**  
> - The demo account must be **disabled or removed** before any production deployment.  
> - In production, enforce strong password policies (min. 12 characters, complexity requirements).  
> - The demo credentials exist only to facilitate onboarding, QA testing, and stakeholder demos.  
> - The Streamlit dashboard and CLI both accept `--demo` flag to auto-login with the test account.

**Usage in demo mode:**

```bash
# CLI — run scan with demo account (skips login prompt)
python main.py scan --input demo_input.csv --output results/report.xlsx --demo

# Streamlit — launches with demo account pre-authenticated
streamlit run app.py -- --demo
```

**Streamlit login screen (Phase 2+):**

When the web dashboard is running without `--demo`, users see a login form. Enter the demo credentials above to access the dashboard during testing.

### 11.3 Legal Considerations

| Item | Note |
|---|---|
| SAT data is public by law | Articles 69 and 69-B data is published in the DOF and SAT portal for public interest — lawful to consult |
| CAPTCHA on SAT certificate portal | Automated CAPTCHA solving may violate SAT's ToS — evaluate risk; consider offering manual CAPTCHA flow as fallback |
| Data retention | Retain screening results per Mexican fiscal record-keeping requirements (5 years minimum per Art. 30 CFF) |
| Third-party API data processing | Ensure DPA (Data Processing Agreement) with any third-party API provider handling RFC data |

### 11.4 Rate Limiting & Ethical Scraping

- Implement respectful rate limiting on all government portal queries (max 1 request/second to SAT portals)
- Cache aggressively to minimize redundant queries
- Include proper User-Agent headers identifying the tool
- Implement exponential backoff on failures

---

## 12. MVP Scope & Phasing

### Phase 1 — MVP: Backend API + Docker (Weeks 1–4)

| Deliverable | Description |
|---|---|
| **FastAPI backend** | REST API with `/scan`, `/rfc/:rfc`, `/health` endpoints |
| CSV/XLSX file ingestion | Parse, validate, and normalize RFC input files via file upload endpoint |
| Art. 69-B screening | Download and index SAT's 69-B open data; match against input RFCs |
| Art. 69 screening | Index datos.gob.mx non-compliance data; match against input RFCs |
| Risk scoring engine | Apply scoring matrix and classify entities |
| XLSX report generation | Server-side report generation, downloadable via API |
| PostgreSQL audit trail | Persistent logging of all queries and results |
| **Dockerized** | Multi-stage `Dockerfile`, `docker-compose.yml` for local dev (API + Postgres) |
| **Docker Hub push** | CI pipeline builds and pushes `previadocker/previa-api:latest` |

### Phase 2 — Frontend + Cloud Deploy (Weeks 5–8)

| Deliverable | Description |
|---|---|
| **Next.js frontend** | File upload, scan progress, results table, report download — deployed on **Vercel** |
| **Cloud backend deployment** | Backend container pulled from Docker Hub and running on **Northflank / RunPod / Lambda** |
| Demo auth flow | Login page with demo account (`user@example.com` / `1234`) via NextAuth.js |
| SAT certificate portal automation | Playwright-based certificate status checks with CAPTCHA handling (runs server-side in container) |
| Email alert notifications | SMTP-based alerts for CRITICAL/HIGH findings |
| Third-party API integration | Reachcore API for real-time 69-B validation as supplementary source |
| PDF report generation | Executive summary PDF for management distribution |

### Phase 3 — Intelligent Agent (Weeks 9–12)

| Deliverable | Description |
|---|---|
| LLM-powered DOF parser | Automated parsing of new DOF publications for 69-B listings using Claude |
| Scheduled re-screening | Cron/scheduled job in cloud compute for periodic portfolio re-validation |
| Natural language chat | Chat interface in frontend: "Which of my vendors are flagged?" |
| Status change detection | Detect when an entity's 69-B status transitions; push alert to frontend + email |
| Webhook integrations | Slack, Teams, custom webhook support |
| SSE / WebSocket progress | Replace polling with real-time scan progress streaming |

### Phase 4 — Enterprise (Weeks 13+)

| Deliverable | Description |
|---|---|
| Multi-tenant architecture | Isolated environments per accounting firm/team with org-level billing |
| CFDI XML validation | Direct CFDI file ingestion and emitter RFC screening |
| Public API layer | Documented REST API with API keys for integration with ERP systems (CONTPAQi, SAP, etc.) |
| Role-based access control | Admin, analyst, auditor roles with granular permissions via NextAuth + backend RBAC |
| Custom domains | `app.previa.mx` frontend, `api.previa.mx` backend |

---

## 13. Success Metrics

### MVP KPIs

| Metric | Target | Measurement |
|---|---|---|
| **Screening accuracy** | >99% match rate against SAT's official 69-B list | Compare agent results vs manual verification on sample of 100 RFCs |
| **Processing speed** | <5 min for 500 RFCs (local screening, no certificate checks) | End-to-end timing from file upload to report delivery |
| **False negative rate** | 0% for CRITICAL findings (69-B Definitivo) | Must never miss a definitivo listing |
| **False positive rate** | <2% | Flagged entities not actually listed in official sources |
| **Audit trail completeness** | 100% of queries logged | Every RFC checked must have a corresponding audit record |
| **User time savings** | >80% reduction vs manual process | Comparative time study: manual vs Previa App |

### Business Metrics (Post-MVP)

| Metric | Target |
|---|---|
| Fiscal exposure prevented | $ value of avoided penalties from early detection |
| Client retention | Improved compliance service as value-add for accounting firms |
| Alert response time | <4 hours from detection to fiscal team action on CRITICAL alerts |

---

## 14. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SAT changes website structure / portal URLs | Medium | High | Implement resilient scraping with fallback selectors; monitor for changes; version-pin parsers |
| CAPTCHA solving becomes unreliable or blocked | Medium | Medium | Offer manual CAPTCHA fallback; evaluate premium CAPTCHA services; consider removing cert check from MVP |
| SAT open data format changes | Low | Medium | Schema validation on ingest; alert on parsing failures; manual fallback |
| Third-party API (Reachcore) unavailable | Low | Low | Primary screening uses local data; third-party is supplementary only |
| Rate limiting / IP blocking by SAT portals | Medium | High | Implement aggressive caching, respectful rate limiting, rotate user agents; consider dedicated IP |
| Regulatory changes to Art. 69-B process | Low | Medium | Agent rules are configurable; LLM layer can adapt to new DOF publication formats |
| Data freshness — local index becomes stale | Medium | High | Automated daily sync of SAT open data; timestamp all results; warn user when data is >7 days old |

---

## 15. Demo Setup & Running Guide

This section covers three ways to run Previa App — from local development through production cloud deployment.

### 15.1 Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| Docker Desktop | 24+ | Container runtime for backend |
| Node.js | 18+ | Frontend development (Next.js) |
| Git | Any | Version control |
| Python | 3.11+ | Backend development (only needed if developing outside Docker) |
| Vercel CLI (optional) | Latest | `npm i -g vercel` — for frontend deployment |

**Accounts needed:**

| Service | Required? | Purpose | Where to Sign Up |
|---|---|---|---|
| **Docker Hub** | Yes | Push/pull backend container image | [hub.docker.com](https://hub.docker.com/) |
| **Vercel** | Yes | Frontend deployment (free tier works) | [vercel.com](https://vercel.com/) |
| **Cloud Compute** | Yes (for cloud demo) | Run backend container — pick one: | See options below |
| Northflank | Option A | Managed container hosting with free tier | [northflank.com](https://northflank.com/) |
| RunPod | Option B | GPU/CPU cloud with Docker support | [runpod.io](https://runpod.io/) |
| AWS (Lambda/ECS) | Option C | Serverless or container service | [aws.amazon.com](https://aws.amazon.com/) |
| **Anthropic** | Yes | Claude API for agent reasoning | [console.anthropic.com](https://console.anthropic.com/) |
| **Reachcore** | Optional | Real-time 69-B API enrichment | [go.reachcore.com](https://go.reachcore.com/) |

### 15.2 Demo Test Account

A pre-configured test account is seeded into the database on first startup:

| | |
|---|---|
| **Email** | `user@example.com` |
| **Password** | `1234` |
| **Role** | `analyst` (scan + view reports) |

See [Section 11.2](#112-demo--test-credentials) for production security notes.

### 15.3 Option A — Local Development (Docker Compose)

The fastest way to get the full stack running on your machine.

```bash
# 1. Clone the repository
git clone https://github.com/your-org/previa-app.git
cd previa-app

# 2. Configure backend environment
cp backend/.env.example backend/.env
# Edit backend/.env — add your ANTHROPIC_API_KEY (required)

# 3. Configure frontend environment
cp frontend/.env.example frontend/.env
# Set NEXT_PUBLIC_API_URL=http://localhost:8000

# 4. Start the full stack (API + PostgreSQL + Frontend)
docker compose up --build

# This starts:
#   - PostgreSQL         → localhost:5432
#   - Backend API        → http://localhost:8000
#   - Frontend (Next.js) → http://localhost:3000
#
# Open http://localhost:3000 in your browser
# Login with: user@example.com / 1234
```

**What `docker-compose.yml` runs:**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: previa
      POSTGRES_USER: previa
      POSTGRES_PASSWORD: previa_local
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  api:
    build: ./backend
    env_file: ./backend/.env
    environment:
      DATABASE_URL: postgresql+asyncpg://previa:previa_local@db:5432/previa
    ports: ["8000:8000"]
    depends_on: [db]
    volumes: [./backend/data:/app/data]

  frontend:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: http://api:8000
    ports: ["3000:3000"]
    depends_on: [api]

volumes:
  pgdata:
```

### 15.4 Option B — Cloud Deployment (Production / Demo)

This is the target architecture: Docker image on cloud compute (RunPod, temporarily) + Vercel frontend. The frontend calls the backend via an environment variable.

#### Recommended deployment flow

1. **Push to GitHub** — Ensure the repo is on GitHub (source of truth). The build-and-deploy script can do this, or you push manually.
2. **Build and push backend image** — Run `./scripts/build-and-deploy.sh "your commit message"` so the backend image is on Docker Hub and `runpod-env.txt` is generated.
3. **Deploy backend on RunPod** — Create a RunPod pod using the image from Docker Hub and paste env vars from `runpod-env.txt`. Note the **RunPod public URL** (e.g. `https://xxxxx-8000.proxy.runpod.net`).
4. **Create Vercel project** — In Vercel, create a new project and **import the same GitHub repo**. Configure the project to use the `frontend/` root (or repo root if the app is at root). Set the **environment variable** so the frontend calls the RunPod backend:
   - **`NEXT_PUBLIC_API_URL`** = your RunPod backend URL (e.g. `https://xxxxx-8000.proxy.runpod.net`).
5. Deploy on Vercel; the frontend will call the backend on RunPod via that env variable.

No backend URL is hardcoded: the Vercel project calls the backend **only** via `NEXT_PUBLIC_API_URL`. When you later move the backend to Lambda, change that env var in Vercel to the new API URL.

#### Automated Build-and-Deploy Script (GitHub → Docker Hub → RunPod)

A single shell script automates: (1) push to GitHub, (2) build local Docker image, (3) push image to Docker Hub, (4) generate a RunPod environment file for copy-paste into the RunPod dashboard. *Temporary setup for RunPod; migration to AWS Lambda is planned later.*

**Location:** `scripts/build-and-deploy.sh`

**Prerequisites:**

- Docker installed and running.
- Logged in to Docker Hub: `docker login`.
- Git remote `origin` (or set `GIT_REMOTE`) and branch `main` (or set `GIT_BRANCH`).
- Backend env vars in `backend/.env` (used for RunPod env output); see [RunPod environment variables](#runpod-environment-variables) below.

**Required environment variables** (set in repo root or `backend/.env` before running the script):

| Variable | Description | Example |
|---|---|---|
| `DOCKER_HUB_USERNAME` | Docker Hub username | `previadocker` |
| `DOCKER_HUB_REPO` | Docker Hub repository name (optional) | `previa-api` (default) |
| `GIT_REMOTE` | Git remote name (optional) | `origin` (default) |
| `GIT_BRANCH` | Branch to push (optional) | `main` (default) |

**Usage:**

```bash
# From repo root
chmod +x scripts/build-and-deploy.sh

# Full pipeline: git push → docker build → docker push → generate runpod-env.txt
./scripts/build-and-deploy.sh "feat: add DOF search automation"

# Skip GitHub (only build and push Docker, then generate RunPod env)
./scripts/build-and-deploy.sh --skip-git

# Only generate RunPod env file (no git, no Docker)
./scripts/build-and-deploy.sh --env-only
```

**What the script does:**

1. **Push to GitHub** — `git add -A`, `git commit -m "<message>"`, `git push <remote> <branch>`. Skipped if no commit message or `--skip-git`.
2. **Build local Docker** — `docker build -t <DOCKER_HUB_USERNAME>/<DOCKER_HUB_REPO>:latest -f backend/Dockerfile backend/`.
3. **Push to Docker Hub** — `docker push <DOCKER_HUB_USERNAME>/<DOCKER_HUB_REPO>:latest`. Requires `docker login` beforehand.
4. **RunPod env file** — Writes `runpod-env.txt` in the repo root with key=value pairs sourced from `backend/.env` (or defaults). Use this file to copy variables into RunPod → Pod → Edit → Environment Variables.

**Output:** After a successful run, use the image `DOCKER_HUB_USERNAME/DOCKER_HUB_REPO:latest` in RunPod and paste the contents of `runpod-env.txt` into the RunPod environment configuration. The file `runpod-env.txt` is gitignored (may contain secrets).

#### RunPod Environment Variables

Use these when creating or editing a RunPod pod (temporarily; Lambda deployment will follow later). The script `scripts/build-and-deploy.sh` generates `runpod-env.txt` from your `backend/.env`; you can also set them manually in the RunPod dashboard.

| Variable | Required | Description | Example |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key | `sk-ant-api03-...` |
| `ANTHROPIC_MODEL` | Yes | Model identifier | `claude-sonnet-4-20250514` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql+asyncpg://user:pass@host:5432/previa` |
| `CORS_ALLOWED_ORIGINS` | Yes | Allowed frontend origins (comma-separated) | `https://previa.vercel.app,http://localhost:3000` |
| `DEMO_USER_EMAIL` | Yes (demo) | Demo login email | `user@example.com` |
| `DEMO_USER_PASSWORD` | Yes (demo) | Demo login password | `1234` |
| `DEMO_USER_ROLE` | No | Demo user role | `analyst` |
| `LOG_LEVEL` | No | Logging level | `INFO` |
| `REACHCORE_API_KEY` | No | 69-B API (optional) | — |
| `CAPTCHA_API_KEY` | No | CAPTCHA service (optional) | — |
| `ALERT_THRESHOLD_CRITICAL` | No | Score threshold for critical alerts | `80` |
| `ALERT_THRESHOLD_HIGH` | No | Score threshold for high alerts | `60` |
| `SAT_RATE_LIMIT_SECONDS` | No | Delay between SAT requests | `1.5` |

**RunPod deploy steps (temporary):**

1. Run `./scripts/build-and-deploy.sh "your commit message"` (or `--skip-git` / `--env-only` as needed).
2. Open [RunPod](https://runpod.io/) → Deploy → CPU Pod (or GPU if required).
3. **Container Image:** `DOCKER_HUB_USERNAME/previa-api:latest` (e.g. `previadocker/previa-api:latest`).
4. **Port:** `8000` (HTTP).
5. **Environment Variables:** Add each line from `runpod-env.txt` in RunPod’s env UI. Ensure **`CORS_ALLOWED_ORIGINS`** includes your Vercel URL (e.g. `https://your-project.vercel.app`) so the backend accepts requests from the frontend.
6. Deploy and note the pod’s **public URL** (e.g. `https://xxxxx-8000.proxy.runpod.net`).
7. In your **Vercel project** → Settings → Environment Variables, set **`NEXT_PUBLIC_API_URL`** to this RunPod URL. The frontend will then call the backend on RunPod via this variable.

*Later: migrate the same image to AWS Lambda and update only `NEXT_PUBLIC_API_URL` in Vercel to the new API URL.*

#### Step 1 (manual): Push Backend Image to Docker Hub

If you prefer not to use the script:

```bash
# Build the production image
cd backend
docker build -t previadocker/previa-api:latest .

# Login to Docker Hub
docker login

# Push to registry
docker push previadocker/previa-api:latest
```

> **CI Automation:** The GitHub Actions workflow `backend-ci.yml` can also build and push on every push to `main`.

#### Step 2: Deploy Backend on Cloud Compute

##### Northflank (Recommended for MVP)

```
1. Create a Northflank account → New Project → New Service
2. Source: "External image" → previadocker/previa-api:latest
3. Resources: 1 vCPU, 1GB RAM (sufficient for MVP)
4. Environment variables:
   - ANTHROPIC_API_KEY=sk-ant-api03-...
   - ANTHROPIC_MODEL=claude-sonnet-4-20250514
   - DATABASE_URL=postgresql+asyncpg://... (Northflank managed DB or external)
   - DEMO_USER_EMAIL=user@example.com
   - DEMO_USER_PASSWORD=1234
   - LOG_LEVEL=INFO
5. Port: 8000
6. Health check: GET /api/health
7. Deploy → note the assigned URL (e.g., https://previa-api--myproject.northflank.app)
```

##### RunPod

```
1. Create a RunPod account → New Pod → CPU Pod
2. Docker image: previadocker/previa-api:latest
3. Expose port 8000 via HTTP
4. Set environment variables (same as above)
5. Deploy → note the proxy URL
```

##### AWS Lambda (via container image)

```bash
# Push to ECR instead of Docker Hub
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI
docker tag previadocker/previa-api:latest $ECR_URI/previa-api:latest
docker push $ECR_URI/previa-api:latest

# Create Lambda function from container image
# Configure API Gateway for HTTP access
# Set environment variables in Lambda configuration
```

#### Step 3: Create Vercel project and point it at the RunPod backend

Create a Vercel project from your **GitHub repo** so every push can auto-deploy the frontend. The frontend calls the backend **only via an environment variable** — set it to your RunPod URL (or later to Lambda).

**Option A — Vercel Dashboard (recommended)**

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**.
2. **Import** your GitHub repository (the same repo you pushed in step 1).
3. **Root Directory:** set to `frontend` if the Next.js app lives in `frontend/`; otherwise leave as repo root.
4. **Environment Variables** — add at least:
   - **`NEXT_PUBLIC_API_URL`** = your RunPod backend URL (e.g. `https://xxxxx-8000.proxy.runpod.net`). This is how the frontend calls the backend.
   - **`NEXTAUTH_SECRET`** = a random string (e.g. `openssl rand -hex 32`).
   - **`NEXTAUTH_URL`** = your Vercel app URL (e.g. `https://previa.vercel.app` or the URL Vercel assigns).
5. Deploy. Vercel will build and deploy the frontend; it will use `NEXT_PUBLIC_API_URL` for all API requests to the RunPod backend.

**Option B — Vercel CLI**

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local:
#   NEXT_PUBLIC_API_URL=https://xxxxx-8000.proxy.runpod.net   <-- your RunPod backend URL
#   NEXTAUTH_SECRET=generate-a-random-secret-here
#   NEXTAUTH_URL=https://your-app.vercel.app
vercel deploy --prod
```

**Summary:** Push to GitHub → deploy backend on RunPod → create Vercel project from GitHub and set `NEXT_PUBLIC_API_URL` to the RunPod URL. The frontend then calls the backend via that env variable; when you move to Lambda, update only `NEXT_PUBLIC_API_URL` in Vercel.

#### Step 4: Verify End-to-End

```
1. Open https://previa.vercel.app (or your Vercel URL)
2. Login with: user@example.com / 1234
3. Upload the sample demo_input.csv
4. Watch the scan progress in real time
5. View results table with risk levels
6. Download the XLSX report
```

### 15.5 Backend Environment Variables

```bash
# ============================================================
# Previa App Backend — Environment Configuration
# ============================================================

# --- LLM Provider (Required) --------------------------------
ANTHROPIC_API_KEY=sk-ant-api03-REPLACE_WITH_YOUR_KEY
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# --- Database (Required) ------------------------------------
# Local Docker Compose uses: postgresql+asyncpg://previa:previa_local@db:5432/previa
# Cloud: use your managed PostgreSQL connection string
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/previa

# --- Demo Account -------------------------------------------
DEMO_USER_EMAIL=user@example.com
DEMO_USER_PASSWORD=1234
DEMO_USER_ROLE=analyst

# --- CORS (Required for Vercel frontend) --------------------
# Comma-separated allowed origins
CORS_ALLOWED_ORIGINS=https://previa.vercel.app,http://localhost:3000

# --- Third-Party Data APIs (Optional) -----------------------
REACHCORE_API_KEY=

# --- CAPTCHA Service (Optional) -----------------------------
CAPTCHA_API_KEY=

# --- Email Notifications (Optional) -------------------------
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
ALERT_EMAIL_TO=fiscal-team@yourcompany.com

# --- Application Settings -----------------------------------
ALERT_THRESHOLD_CRITICAL=80
ALERT_THRESHOLD_HIGH=60
DATA_STALENESS_WARNING_DAYS=7
SAT_RATE_LIMIT_SECONDS=1.5
LOG_LEVEL=INFO
```

### 15.6 Frontend Environment Variables

```bash
# ============================================================
# Previa App Frontend — Environment Configuration (.env.local)
# ============================================================

# Backend API URL — must match your cloud deployment
# Local dev:  http://localhost:8000
# Production: https://previa-api--myproject.northflank.app
NEXT_PUBLIC_API_URL=http://localhost:8000

# NextAuth.js configuration
NEXTAUTH_SECRET=replace-with-random-32-char-string
NEXTAUTH_URL=http://localhost:3000
```

### 15.7 Preparing Sample Input Data

Upload via the frontend dashboard or use `curl` against the API directly.

**Minimum required columns:**

| Column | Required | Description | Example |
|---|---|---|---|
| `rfc` | Yes | RFC identifier (12 or 13 characters) | `CAL080328S18` |
| `razon_social` | Yes | Legal name of the entity | `COMERCIALIZADORA ALCAER, S.A. DE C.V.` |

**Optional columns:**

| Column | Description | Example |
|---|---|---|
| `tipo_persona` | `fisica` or `moral` | `moral` |
| `relacion` | `cliente`, `proveedor`, `socio`, `otro` | `proveedor` |
| `id_interno` | Your internal reference code | `PROV-2847` |

**Sample `demo_input.csv`:**

```csv
rfc,razon_social,relacion,id_interno
CAL080328S18,"COMERCIALIZADORA ALCAER, S.A. DE C.V.",proveedor,PROV-2847
ACA0604119X3,"AGROEXPORT DE CAMPECHE, S.P.R. DE R.L.",proveedor,PROV-1102
GFS1109204G1,"GOING FORWARD SOLUTIONS CONSULTORES, S. DE R.L. DE C.V.",proveedor,PROV-3301
BAD180409H32,"BLACKPOINT ADVISORS, S.A. DE C.V.",cliente,CLI-0455
XAXX010101000,"PUBLICO EN GENERAL",cliente,CLI-0001
ABC123456XY9,"EMPRESA FICTICIA DE PRUEBA, S.A. DE C.V.",proveedor,PROV-9999
```

**Direct API usage (curl):**

```bash
# Start a scan via API
curl -X POST https://your-api-url/api/scan \
  -H "Authorization: Bearer <token>" \
  -F "file=@demo_input.csv"

# Response: { "scan_id": "abc123", "status": "processing", "total_entities": 6 }

# Poll for progress
curl https://your-api-url/api/scan/abc123

# Download report when complete
curl -o report.xlsx https://your-api-url/api/scan/abc123/report
```

### 15.8 Understanding the Output

#### XLSX Report Structure

| Sheet | Content |
|---|---|
| **Resumen Ejecutivo** | Portfolio risk summary: totals by risk level, screening timestamp, data freshness |
| **Alertas Críticas** | CRITICAL and HIGH findings with recommended actions |
| **Detalle por Entidad** | One row per entity: Art. 69-B status, Art. 69 findings, certificate status, risk score |
| **Art. 69-B Detalle** | Matched 69-B entries: oficio, authority, motivo, dates, DOF links |
| **Certificados** | Certificate status per entity (if enabled): serial numbers, validity, status |
| **Bitácora de Auditoría** | Full audit log for regulatory defensibility |

#### Risk Level Color Coding

| Color | Risk Level | Meaning |
|---|---|---|
| Red | CRITICAL | Immediate action — 69-B Definitivo or criminal sentence |
| Orange | HIGH | Urgent review — 69-B Presunto, not-located, CSD revoked |
| Yellow | MEDIUM | Monitor — firm debts, expired certificates |
| Light Green | LOW | Informational — cleared or favorable |
| Green | CLEAR | No findings across all sources |

### 15.9 SAT Data Sync

The backend container syncs SAT datasets on startup and can be triggered via API:

```bash
# Trigger data sync via API
curl -X POST https://your-api-url/api/sync-data \
  -H "Authorization: Bearer <token>"

# Check data freshness
curl https://your-api-url/api/sync-data/status
```

**Datasets maintained:**

| Dataset | Source | Container Path |
|---|---|---|
| Art. 69-B — Full list | SAT Datos Abiertos | `/app/data/sat/lista_69b.csv` |
| Art. 69 — Incumplidos | datos.gob.mx | `/app/data/sat/art69_incumplidos.csv` |
| Art. 69 — No Localizados | datos.gob.mx | `/app/data/sat/art69_no_localizados.csv` |
| Art. 69 — Sentencias | datos.gob.mx | `/app/data/sat/art69_sentencias.csv` |

> **Production recommendation:** Mount a persistent volume at `/app/data` so cached SAT datasets survive container restarts. On Northflank, use a Persistent Volume; on RunPod, use network storage.

### 15.10 Verification Checklist

```bash
# --- Backend Health ---
curl https://your-api-url/api/health
# Expected: { "status": "ok", "version": "1.0.0", "data_freshness": "2026-02-16" }

# --- Frontend Load ---
# Open https://previa.vercel.app — should show login page

# --- Auth Flow ---
# Login with user@example.com / 1234 — should reach dashboard

# --- End-to-End Scan ---
# Upload demo_input.csv → scan starts → progress bar → results table → download report

# --- API Direct Test ---
curl -X POST https://your-api-url/api/rfc/CAL080328S18
# Expected: { "rfc": "CAL080328S18", "risk_level": "CRITICAL", "art_69b": { "status": "definitivo", ... } }
```

### 15.11 Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| Frontend can't reach API | CORS misconfigured or wrong API URL | Check `CORS_ALLOWED_ORIGINS` in backend and `NEXT_PUBLIC_API_URL` in frontend |
| `ANTHROPIC_API_KEY not set` | Env var missing in cloud config | Add it in Northflank/RunPod environment settings |
| Docker image won't start | Port conflict or missing env vars | Check logs: `docker logs <container>` or cloud provider logs |
| `502 Bad Gateway` on API | Container crashed or not ready yet | Check health endpoint; ensure `DATABASE_URL` is correct |
| Login fails with demo account | Demo seed didn't run | Check backend startup logs for "Demo user created" message |
| Scan stuck at "processing" | Background task failed | Check API logs; likely missing API key or data not synced |
| Stale screening results | SAT data cache outdated | Trigger sync via `POST /api/sync-data` |
| Vercel deploy fails | Wrong root directory | Set Root Directory to `frontend/` in Vercel project settings |

---

## 16. Appendix — Glossary & References

### Glossary

| Term | Definition |
|---|---|
| **RFC** | Registro Federal de Contribuyentes — Mexican taxpayer identification number |
| **CFF** | Código Fiscal de la Federación — Mexico's Federal Fiscal Code |
| **DOF** | Diario Oficial de la Federación — Mexico's official gazette for legal publications |
| **SAT** | Servicio de Administración Tributaria — Mexico's tax administration service |
| **CFDI** | Comprobante Fiscal Digital por Internet — Digital tax invoice |
| **EFOS** | Empresas que Facturan Operaciones Simuladas — Companies invoicing simulated operations |
| **EDOS** | Empresas que Deducen Operaciones Simuladas — Companies deducting simulated operations |
| **CSD** | Certificado de Sello Digital — Digital seal certificate for signing CFDIs |
| **e.firma (FIEL)** | Firma Electrónica Avanzada — Advanced electronic signature |
| **Persona Física** | Individual taxpayer (RFC: 13 characters) |
| **Persona Moral** | Legal entity / corporation (RFC: 12 characters) |

### Official References

1. **DOF — Portal (search entry point):**  
   https://dof.gob.mx/

2. **DOF — Example result of the file search we automate (single note by codigo):**  
   https://www.dof.gob.mx/nota_detalle_popup.php?codigo=5629553  
   *(Oficio 500-05-2021-15394 — Art. 69-B presumption list; contains RFC table and metadata.)*

3. **Art. 69-B CFF — Latest 2025 listing (alternate URL pattern with fecha):**  
   https://dof.gob.mx/nota_detalle.php?codigo=5776008&fecha=12/12/2025

4. **SAT — Consulta Relación de Contribuyentes Art. 69-B:**  
   https://wwwmat.sat.gob.mx/consultas/76674/consulta-la-relacion-de-contribuyentes-con-operaciones-presuntamente-inexistentes

5. **SAT — Datos Abiertos:**  
   http://omawww.sat.gob.mx/cifras_sat/Paginas/DatosAbiertos/index.html

6. **datos.gob.mx — Contribuyentes Incumplidos:**  
   https://datos.gob.mx/dataset/contribuyentes_incumplidos

7. **SAT — Recuperación de Certificados:**  
   https://portalsat.plataforma.sat.gob.mx/RecuperacionDeCertificados/faces/consultaCertificados.xhtml

8. **Reachcore — API Lista 69-B:**  
   https://go.reachcore.com/docs/Articulos/APIListasNegras

---

> **Document Control:**  
> This document serves as the executive prompt and technical specification for Previa App MVP development. It should be reviewed and approved by the fiscal compliance team lead and engineering lead before development begins.  
>  
> **Next Steps:**  
> 1. Stakeholder review and sign-off on MVP scope (Phase 1)  
> 2. Set up development environment and repository  
> 3. Download and profile SAT open data sources for schema mapping  
> 4. Begin Sprint 1: File ingestion + RFC validation + 69-B local screening  
