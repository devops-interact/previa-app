#!/usr/bin/env bash
# =============================================================================
# PREV.IA — Build and Deploy Automation
# =============================================================================
# 1. Push to GitHub
# 2. Build local Docker image (backend)
# 3. Push image to Docker Hub
# 4. Output RunPod environment variables for copy-paste into RunPod dashboard
#
# Usage:
#   ./scripts/build-and-deploy.sh [commit-message]
#   ./scripts/build-and-deploy.sh --skip-git [commit-message]   # skip GitHub push
#   ./scripts/build-and-deploy.sh --env-only                     # only print RunPod env
#
# Required (set in .env or export before running):
#   DOCKER_HUB_USERNAME   - Docker Hub username (e.g. previadocker)
#   DOCKER_HUB_REPO       - Docker Hub repo name (default: previa-api)
#   GIT_REMOTE            - Git remote name (default: origin)
#   GIT_BRANCH            - Branch to push (default: main)
#
# Optional for RunPod env output (loaded from backend/.env if present):
#   ANTHROPIC_API_KEY, DATABASE_URL, CORS_ALLOWED_ORIGINS, etc.
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
ENV_FILE="$BACKEND_DIR/.env"
IMAGE_NAME="${DOCKER_HUB_REPO:-previa-api}"
DOCKER_USER="${DOCKER_HUB_USERNAME:-}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"
SKIP_GIT=false
ENV_ONLY=false
COMMIT_MSG="${1:-}"

# Parse flags
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-git)
      SKIP_GIT=true
      shift
      ;;
    --env-only)
      ENV_ONLY=true
      shift
      ;;
    -*)
      shift
      ;;
    *)
      COMMIT_MSG="$1"
      shift
      ;;
  esac
done

# Load .env from backend if present (for RunPod env output)
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi

# -----------------------------------------------------------------------------
# Step 4 (optional): Generate RunPod environment variables
# -----------------------------------------------------------------------------
output_runpod_env() {
  local runpod_env_file="$REPO_ROOT/runpod-env.txt"
  cat > "$runpod_env_file" << 'RUNPOD_HEADER'
# =============================================================================
# PREV.IA — RunPod Environment Variables
# =============================================================================
# Copy these key=value pairs into RunPod → Your Pod → Edit → Environment Variables.
# Add each line as a separate variable (omit the export and quotes for RunPod UI).
# Do not commit this file if it contains real secrets.
# =============================================================================

RUNPOD_HEADER

  # Required
  echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-REPLACE_WITH_YOUR_KEY}" >> "$runpod_env_file"
  echo "ANTHROPIC_MODEL=${ANTHROPIC_MODEL:-claude-sonnet-4-20250514}" >> "$runpod_env_file"
  echo "DATABASE_URL=${DATABASE_URL:-postgresql+asyncpg://user:pass@host:5432/previa}" >> "$runpod_env_file"
  echo "CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS:-https://previa.vercel.app,http://localhost:3000}" >> "$runpod_env_file"
  echo "DEMO_USER_EMAIL=${DEMO_USER_EMAIL:-user@product.test}" >> "$runpod_env_file"
  echo "DEMO_USER_PASSWORD=${DEMO_USER_PASSWORD:-1234}" >> "$runpod_env_file"
  echo "DEMO_USER_ROLE=${DEMO_USER_ROLE:-analyst}" >> "$runpod_env_file"
  echo "LOG_LEVEL=${LOG_LEVEL:-INFO}" >> "$runpod_env_file"

  # Optional
  echo "REACHCORE_API_KEY=${REACHCORE_API_KEY:-}" >> "$runpod_env_file"
  echo "CAPTCHA_API_KEY=${CAPTCHA_API_KEY:-}" >> "$runpod_env_file"
  echo "ALERT_THRESHOLD_CRITICAL=${ALERT_THRESHOLD_CRITICAL:-80}" >> "$runpod_env_file"
  echo "ALERT_THRESHOLD_HIGH=${ALERT_THRESHOLD_HIGH:-60}" >> "$runpod_env_file"
  echo "SAT_RATE_LIMIT_SECONDS=${SAT_RATE_LIMIT_SECONDS:-1.5}" >> "$runpod_env_file"

  echo ""
  echo "--> RunPod env written to: $runpod_env_file"
  echo "    Add these in RunPod: Pod → Edit → Environment Variables (one key=value per line)."
}

if [[ "$ENV_ONLY" == true ]]; then
  output_runpod_env
  exit 0
fi

# -----------------------------------------------------------------------------
# Step 1: Push to GitHub
# -----------------------------------------------------------------------------
if [[ "$SKIP_GIT" != true ]]; then
  echo "==> Step 1: Push to GitHub ($GIT_REMOTE $GIT_BRANCH)"
  cd "$REPO_ROOT"
  if [[ -n "$COMMIT_MSG" ]]; then
    git add -A
    git status
    if git diff --staged --quiet 2>/dev/null; then
      echo "    No changes to commit."
    else
      git commit -m "$COMMIT_MSG"
      git push "$GIT_REMOTE" "$GIT_BRANCH"
    fi
  else
    echo "    No commit message provided; skipping git add/commit/push."
    echo "    Usage: $0 'Your commit message'"
    echo "    Or:   $0 --skip-git  to skip GitHub and only build/push Docker."
  fi
else
  echo "==> Step 1: Skip GitHub (--skip-git)"
fi

# -----------------------------------------------------------------------------
# Step 2: Build local Docker image
# -----------------------------------------------------------------------------
echo ""
echo "==> Step 2: Build local Docker image"
if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "    ERROR: backend/ not found at $BACKEND_DIR"
  exit 1
fi
if [[ ! -f "$BACKEND_DIR/Dockerfile" ]]; then
  echo "    ERROR: backend/Dockerfile not found"
  exit 1
fi

cd "$REPO_ROOT"
docker build -t "${DOCKER_USER:+$DOCKER_USER/}${IMAGE_NAME}:latest" -f backend/Dockerfile backend/
echo "    Image built: ${DOCKER_USER:+$DOCKER_USER/}${IMAGE_NAME}:latest"

# -----------------------------------------------------------------------------
# Step 3: Push image to Docker Hub
# -----------------------------------------------------------------------------
echo ""
echo "==> Step 3: Push image to Docker Hub"
if [[ -z "$DOCKER_USER" ]]; then
  echo "    WARNING: DOCKER_HUB_USERNAME not set. Set it in .env or:"
  echo "    export DOCKER_HUB_USERNAME=your-dockerhub-username"
  echo "    Skipping docker push."
else
  FULL_IMAGE="${DOCKER_USER}/${IMAGE_NAME}:latest"
  docker push "$FULL_IMAGE"
  echo "    Pushed: $FULL_IMAGE"
fi

# -----------------------------------------------------------------------------
# Step 4: RunPod env file
# -----------------------------------------------------------------------------
echo ""
echo "==> Step 4: RunPod environment variables"
output_runpod_env

FULL_IMAGE_DISPLAY="${DOCKER_USER:+$DOCKER_USER/}${IMAGE_NAME}:latest"
echo ""
echo "Done. Next:"
echo "  1. RunPod: Deploy Pod → image $FULL_IMAGE_DISPLAY, port 8000, env from runpod-env.txt (set CORS_ALLOWED_ORIGINS to your Vercel URL)."
echo "  2. Vercel: Create project from this GitHub repo → set NEXT_PUBLIC_API_URL to your RunPod backend URL so the frontend calls the backend."
