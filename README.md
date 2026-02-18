# Previa App — Fiscal Compliance Screening Agent

**Version:** 1.0.0 (MVP)  
**Status:** Development

Previa App is an autonomous fiscal compliance screening agent designed for tax accounting teams operating in the Mexican regulatory environment. The agent ingests RFC (Registro Federal de Contribuyentes) identifiers and performs automated screening across official Mexican government data sources to detect regulatory flags, sanctions, and certificate irregularities.

## Architecture

- **Backend:** Python/FastAPI + SQLite (containerized with Docker)
- **Frontend:** Next.js 14 + Tailwind CSS (deployed on Vercel)
- **Communication:** REST API over HTTPS

## Quick Start (Local Development)

### Prerequisites

- Docker Desktop (for backend)
- Node.js 18+ (for frontend)
- Anthropic API key

### 1. Clone Repository

```bash
git clone https://github.com/your-org/previa-app.git
cd previa-app
```

### 2. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 3. Configure Frontend

```bash
cd ../frontend
cp .env.example .env.local
# NEXT_PUBLIC_API_URL is already set to http://localhost:8000
```

### 4. Start Full Stack

```bash
# From repo root
docker compose up --build
```

This starts:
- **Backend API:** http://localhost:8000
- **Frontend:** http://localhost:3000

### 5. Access Application

1. Open http://localhost:3000
2. Login with demo credentials:
   - Email: `user@product.test`
   - Password: `1234`
3. Upload the sample CSV file: `backend/tests/fixtures/demo_input.csv`
4. Watch the scan progress in Tablero

## Project Structure

```
previa-app/
├── backend/                    # Python FastAPI backend
│   ├── app/
│   │   ├── main.py            # FastAPI entry point
│   │   ├── config/            # Settings & risk rules
│   │   ├── api/               # API routes
│   │   ├── data/              # Database & file parsing
│   │   └── agent/             # Screening tools & orchestrator
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                   # Next.js frontend
│   ├── src/
│   │   ├── app/               # Pages (login, dataset, tablero, chat)
│   │   ├── components/        # React components
│   │   ├── lib/               # API client
│   │   └── types/             # TypeScript types
│   ├── package.json
│   └── .env.example
│
├── docker-compose.yml          # Full stack orchestration
├── scripts/
│   └── build-and-deploy.sh    # Docker Hub deployment script
└── README.md
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check & data freshness |
| `/api/scan` | POST | Upload file & create scan |
| `/api/scan/:id` | GET | Get scan status & progress |
| `/api/scan/:id/report` | GET | Download XLSX report (Phase 2) |
| `/api/rfc/:rfc` | POST | Single RFC lookup |

## Features

### MVP (Current)

- ✅ CSV/XLSX file upload
- ✅ RFC format validation
- ✅ **Comprehensive Article Screening:**
  - ✅ **Art. 69-B** — EFOS/EDOS (presunto, definitivo, desvirtuado, sentencia favorable)
  - ✅ **Art. 69** — Non-compliance (créditos firmes, no localizados, créditos cancelados, sentencias)
  - ✅ **Art. 69 BIS** — Additional compliance requirements
  - ✅ **Art. 49 BIS** — DOF publication violations
- ✅ Risk scoring engine with multi-article aggregation
- ✅ Background scan processing
- ✅ Real-time progress tracking
- ✅ Comprehensive audit logging (4 sources per RFC)
- ✅ Demo authentication

### Phase 2 (Planned)

- ⏳ XLSX report generation
- ⏳ Real SAT dataset downloader/indexer
- ⏳ Art. 69 screening
- ⏳ Certificate status checking
- ⏳ Email alerts
- ⏳ DOF publication parser

### Phase 3 (Planned)

- ⏳ Natural language chat interface
- ⏳ Scheduled re-screening
- ⏳ Status change detection
- ⏳ Webhook integrations

## Development

### Backend Only

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend Only

```bash
cd frontend
npm install
npm run dev
```

### Run Tests

```bash
cd backend
pytest -v
```

## Deployment

### Backend (Docker Hub → RunPod/Northflank)

```bash
# Set Docker Hub username
export DOCKER_HUB_USERNAME=your-username

# Build, push, and generate RunPod env file
./scripts/build-and-deploy.sh "Initial deployment"

# Deploy on RunPod using the generated runpod-env.txt
```

### Frontend (Vercel)

1. Import GitHub repository in Vercel
2. Set root directory to `frontend`
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL`: Your RunPod backend URL
4. Deploy

## Demo Credentials

**Email:** user@product.test  
**Password:** 1234

> ⚠️ **IMPORTANT:** Disable demo account before production deployment.

## Sample Data

Use `backend/tests/fixtures/demo_input.csv` for testing. Contains 6 RFCs:
- **CAL080328S18** — Art. 69-B Definitivo (CRITICAL risk)
- **ACA0604119X3** — Art. 69-B Presunto (HIGH risk)
- **GFS1109204G1** — Art. 69 No Localizado (HIGH risk)
- **BAD180409H32** — Art. 69 Crédito Firme (HIGH risk)
- **XAXX010101000** — Público en General (CLEAR)
- **ABC123456XY9** — Clean RFC (CLEAR)

## License

Proprietary — All rights reserved.

## Support

For questions or issues, contact the development team.
