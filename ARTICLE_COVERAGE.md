# PREV.IA — Article Coverage Documentation

## Overview

PREV.IA screens RFCs against **four critical Mexican tax compliance articles**:

1. **Article 69-B** — EFOS/EDOS (Empresas que Facturan Operaciones Simuladas)
2. **Article 69** — Non-compliance lists (4 categories)
3. **Article 69 BIS** — Additional compliance requirements
4. **Article 49 BIS** — DOF publication violations

---

## Article 69-B — EFOS/EDOS

**Legal Reference:** Código Fiscal de la Federación, Article 69-B

### What It Covers

Companies that issue invoices for simulated operations (shell companies). The SAT publishes lists of taxpayers in the following statuses:

- **Presunto** — Presumed EFOS/EDOS (under investigation)
- **Definitivo** — Definitive EFOS/EDOS (confirmed)
- **Desvirtuado** — Status cleared (taxpayer proved legitimacy)
- **Sentencia Favorable** — Favorable court ruling

### Risk Scoring

| Status | Risk Score | Risk Level |
|--------|-----------|------------|
| Definitivo | 100 | CRITICAL |
| Presunto | 80 | CRITICAL |
| Desvirtuado | 10 | LOW |
| Sentencia Favorable | 5 | LOW |

### Implementation

**Tool:** `backend/app/agent/tools/sat_69b_tool.py`

**Mock Data RFCs:**
- `CAL080328S18` — Definitivo
- `ACA0604119X3` — Presunto

---

## Article 69 — Non-Compliance Lists

**Legal Reference:** Código Fiscal de la Federación, Article 69

### What It Covers

Four categories of non-compliant taxpayers:

1. **Créditos Fiscales Firmes** — Firm, enforceable tax debts
2. **No Localizados** — Taxpayers whose fiscal domicile cannot be verified
3. **Créditos Cancelados** — Cancelled tax credits
4. **Sentencia Condenatoria por Delito Fiscal** — Criminal convictions for fiscal crimes

### Risk Scoring

| Category | Risk Score | Risk Level |
|----------|-----------|------------|
| Sentencia Condenatoria | 95 | CRITICAL |
| No Localizado | 70 | HIGH |
| Crédito Firme | 60 | HIGH |
| Crédito Cancelado | 40 | MEDIUM |

### Implementation

**Tool:** `backend/app/agent/tools/sat_69_tool.py`

**Mock Data RFCs:**
- `GFS1109204G1` — No Localizado
- `BAD180409H32` — Crédito Firme

---

## Article 69 BIS — Additional Compliance

**Legal Reference:** Código Fiscal de la Federación, Article 69 BIS

### What It Covers

Additional compliance requirements and sanctions related to fiscal obligations and transparency requirements.

### Implementation

**Tool:** `backend/app/agent/tools/sat_69_bis_tool.py`

**Status:** Placeholder implementation (no mock data yet)

**Future Scope:**
- Integration with SAT datasets when available
- Specific violation type classification
- Publication date tracking

---

## Article 49 BIS — DOF Publications

**Legal Reference:** Código Fiscal de la Federación, Article 49 BIS

### What It Covers

Provisions whose breach leads to publication of taxpayer lists in the Diario Oficial de la Federación (DOF). PREV.IA monitors and alerts on lists derived from Articles 69, 69 BIS, 69-B, and 49 BIS.

### Implementation

**Tool:** `backend/app/agent/tools/sat_49_bis_tool.py`

**Status:** Placeholder implementation (no mock data yet)

**Future Scope:**
- DOF publication scraping and parsing
- Violation type classification
- Historical publication tracking

---

## Screening Workflow

For each RFC, PREV.IA performs the following checks:

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

### Audit Logging

Each screening generates **4 audit log entries** per RFC:
- `sat_69b` — Art. 69-B screening result
- `sat_69` — Art. 69 screening result
- `sat_69_bis` — Art. 69 BIS screening result
- `sat_49_bis` — Art. 49 BIS screening result

---

## Risk Aggregation

PREV.IA uses **maximum score aggregation**:

```python
# Example: RFC with multiple findings
findings = {
    "art_69b_status": "presunto",      # Score: 80
    "art_69_categories": ["no_localizado"],  # Score: 70
}

# Overall risk = max(80, 70) = 80 → CRITICAL
```

This ensures that the **highest risk finding** determines the overall risk level.

---

## Data Sources (Production)

When integrated with real SAT data, PREV.IA will query:

### Article 69-B
- **Source:** SAT Lista de Contribuyentes Art. 69-B
- **URL:** https://www.sat.gob.mx/consulta/operaciones/28821/consulta-las-listas-de-contribuyentes-publicadas-en-el-dof
- **Format:** CSV/Excel downloads
- **Update Frequency:** Monthly (or as published in DOF)

### Article 69
- **Source:** SAT Contribuyentes Incumplidos
- **URL:** https://datos.gob.mx/dataset/contribuyentes_incumplidos
- **Format:** Open data portal (JSON/CSV)
- **Update Frequency:** Quarterly

### Article 69 BIS & 49 BIS
- **Source:** DOF Publications
- **URL:** https://www.dof.gob.mx/
- **Format:** PDF/HTML scraping + LLM parsing
- **Update Frequency:** Daily monitoring

---

## API Response Structure

### Single RFC Lookup

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

---

## Testing

### Test Single RFC

```bash
# Art. 69-B Definitivo (CRITICAL)
curl -X POST http://localhost:8000/api/rfc/CAL080328S18

# Art. 69 No Localizado (HIGH)
curl -X POST http://localhost:8000/api/rfc/GFS1109204G1

# Clean RFC (CLEAR)
curl -X POST http://localhost:8000/api/rfc/ABC123456XY9
```

### Test Batch Scan

Upload `backend/tests/fixtures/demo_input.csv` via the frontend to test all articles simultaneously.

---

## Future Enhancements

### Phase 2
- Real SAT dataset integration
- Certificate status checking (CSD validation)
- XLSX report with article breakdown

### Phase 3
- Scheduled re-screening (detect status changes)
- Email alerts on new findings
- DOF publication monitoring with LLM parsing
- Historical trend analysis

---

## References

- [SAT Art. 69-B Lists](https://www.sat.gob.mx/consulta/operaciones/28821/consulta-las-listas-de-contribuyentes-publicadas-en-el-dof)
- [Contribuyentes Incumplidos (Art. 69)](https://datos.gob.mx/dataset/contribuyentes_incumplidos)
- [Diario Oficial de la Federación](https://www.dof.gob.mx/)
- [Código Fiscal de la Federación](http://www.diputados.gob.mx/LeyesBiblio/pdf/CFF.pdf)
