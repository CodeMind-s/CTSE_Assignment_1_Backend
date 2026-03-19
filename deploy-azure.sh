#!/bin/bash
# =============================================================================
# deploy-azure.sh — Full Azure deployment for StayEasy (backend + frontend)
#
# Usage:
#   bash deploy-azure.sh              # uses timestamp as image tag
#   bash deploy-azure.sh v1.0.0       # uses custom tag
#   bash deploy-azure.sh --skip-build # skip Docker build/push (redeploy only)
#
# Prerequisites:
#   - Azure CLI installed  (az --version)
#   - Docker installed and running
#   - .env file in this directory with all required secrets
#   - azure-setup.sh already run once (infrastructure exists)
# =============================================================================
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
success() { echo -e "${GREEN}✅ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $*${NC}"; }
error()   { echo -e "${RED}❌ $*${NC}"; exit 1; }
header()  { echo -e "\n${BOLD}${BLUE}══════════════════════════════════════════${NC}"; \
            echo -e "${BOLD}${BLUE}  $*${NC}"; \
            echo -e "${BOLD}${BLUE}══════════════════════════════════════════${NC}"; }

# ── Argument parsing ──────────────────────────────────────────────────────────
SKIP_BUILD=false
TAG=""
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    *)            TAG="$arg" ;;
  esac
done
[ -z "$TAG" ] && TAG="deploy-$(date +%Y%m%d-%H%M%S)"

# ── Paths ─────────────────────────────────────────────────────────────────────
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${BACKEND_DIR}/../CTSE_Assignment_1_Frontend"

# ── Azure config ──────────────────────────────────────────────────────────────
RESOURCE_GROUP="CTSE_gr"
ACR_NAME="ctseassignment1"
ACR="ctseassignment1.azurecr.io"
ENV_NAME="stayeasy-env"

BACKEND_SERVICES=(
  api-gateway
  auth-service
  user-service
  rooms-service
  booking-service
  review-service
  notification-service
)

# ── Load .env ─────────────────────────────────────────────────────────────────
# Reads KEY=VALUE pairs, ignores comments and blank lines.
# Each line is exported as-is so values with spaces are handled correctly.
load_env() {
  local file="$1"
  [ -f "$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip blank lines and comments
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    # export "KEY=value" — bash treats everything after = as the value
    export "$line" 2>/dev/null || warn "Skipping malformed env line: $line"
  done < "$file"
}

log "Loading secrets from .env …"
load_env "${BACKEND_DIR}/.env"

# ── Validate required secrets ─────────────────────────────────────────────────
REQUIRED_VARS=(
  MONGO_URI
  JWT_SECRET
  REFRESH_SECRET
  INTERNAL_SERVICE_KEY
  POSTGRES_PASSWORD
  SMTP_HOST
  SMTP_USER
  SMTP_PASS
  ALLOWED_ORIGINS
)
MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  [ -z "${!var:-}" ] && MISSING+=("$var")
done
if [ ${#MISSING[@]} -gt 0 ]; then
  error "Missing required variables in .env: ${MISSING[*]}\nCheck .env.example for the full list."
fi

# ── Azure login ───────────────────────────────────────────────────────────────
header "Azure Login"
if ! az account show &>/dev/null; then
  log "Not logged in — running az login …"
  az login
else
  ACCOUNT=$(az account show --query "[name, user.name]" -o tsv | tr '\n' ' ')
  success "Already logged in: $ACCOUNT"
fi

# ── Build & push Docker images ────────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  header "Docker Login → ACR"
  log "Authenticating Docker with ${ACR} …"
  az acr login --name "$ACR_NAME"
  success "Docker authenticated"

  header "Build & Push — Backend Services (tag: ${TAG})"
  for SERVICE in "${BACKEND_SERVICES[@]}"; do
    log "Building ${SERVICE} …"
    docker build \
      -t "${ACR}/${SERVICE}:${TAG}" \
      -t "${ACR}/${SERVICE}:latest" \
      -f "${BACKEND_DIR}/${SERVICE}/Dockerfile" \
      "${BACKEND_DIR}"
    log "Pushing ${SERVICE} …"
    docker push "${ACR}/${SERVICE}:${TAG}"
    docker push "${ACR}/${SERVICE}:latest"
    success "${SERVICE} pushed"
  done

  header "Build & Push — Frontend (tag: ${TAG})"
  if [ ! -d "$FRONTEND_DIR" ]; then
    warn "Frontend directory not found at ${FRONTEND_DIR} — skipping frontend build"
    SKIP_FRONTEND_BUILD=true
  else
    SKIP_FRONTEND_BUILD=false
    # API_GATEWAY_URL is baked into the Next.js static build.
    # If not set, fall back to a placeholder; update after first backend deploy.
    BAKE_URL="${API_GATEWAY_URL:-http://localhost:3400}"
    log "Building frontend (API_BASE_URL=${BAKE_URL}) …"
    docker build \
      --build-arg API_BASE_URL="${BAKE_URL}" \
      -t "${ACR}/frontend:${TAG}" \
      -t "${ACR}/frontend:latest" \
      "${FRONTEND_DIR}"
    log "Pushing frontend …"
    docker push "${ACR}/frontend:${TAG}"
    docker push "${ACR}/frontend:latest"
    success "frontend pushed"
  fi
else
  warn "--skip-build passed — reusing existing :latest images in ACR"
  TAG="latest"
  SKIP_FRONTEND_BUILD=false
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

# deploy_app NAME CREATE_ARGS... — creates or updates a Container App.
# Expects the caller to set IMAGE and ENV_ARGS array before calling.
deploy_app() {
  local NAME="$1"; shift        # remaining args are create-only flags
  local IMAGE_REF="${ACR}/${NAME}:${TAG}"

  log "Deploying ${NAME} …"
  if az containerapp show \
      --name "$NAME" \
      --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    # App exists — update image and env vars
    az containerapp update \
      --name "$NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --image "$IMAGE_REF" \
      --set-env-vars "${ENV_ARGS[@]}"
  else
    # App does not exist — create it
    az containerapp create \
      --name "$NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --environment "$ENV_NAME" \
      --image "$IMAGE_REF" \
      --registry-server "$ACR" \
      --registry-username "$ACR_USERNAME" \
      --registry-password "$ACR_PASSWORD" \
      --env-vars "${ENV_ARGS[@]}" \
      "$@"
  fi
  success "${NAME} deployed"
}

# ── Cache ACR credentials (avoid repeated az acr credential show calls) ──────
log "Fetching ACR credentials …"
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query 'passwords[0].value' -o tsv)
success "ACR credentials loaded"

# ── Get environment domain (needed for all internal FQDNs) ───────────────────
header "Fetching Container Apps Environment Domain"
ENV_DOMAIN=$(az containerapp env show \
  --name "$ENV_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.defaultDomain -o tsv)
success "Environment domain: ${ENV_DOMAIN}"

KAFKA_FQDN="kafka-broker.internal.${ENV_DOMAIN}"
POSTGRES_FQDN="booking-db.internal.${ENV_DOMAIN}"

# ── 1. Kafka broker ───────────────────────────────────────────────────────────
header "Deploying Kafka Broker"
if az containerapp show \
    --name kafka-broker \
    --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  success "kafka-broker already exists — skipping (stateful, not recreated automatically)"
  warn "To update Kafka config, delete it manually first: az containerapp delete --name kafka-broker --resource-group ${RESOURCE_GROUP}"
else
  log "Creating kafka-broker …"
  az containerapp create \
    --name kafka-broker \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ENV_NAME" \
    --image docker.io/apache/kafka:latest \
    --min-replicas 1 \
    --max-replicas 1 \
    --ingress internal \
    --target-port 9092 \
    --transport tcp \
    --env-vars \
      KAFKA_NODE_ID=1 \
      KAFKA_PROCESS_ROLES=broker,controller \
      "KAFKA_LISTENERS=PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093" \
      "KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://${KAFKA_FQDN}:9092" \
      "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT" \
      "KAFKA_CONTROLLER_QUORUM_VOTERS=1@${KAFKA_FQDN}:9093" \
      KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER \
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
      KAFKA_AUTO_CREATE_TOPICS_ENABLE=true \
      KAFKA_NUM_PARTITIONS=1 \
      KAFKA_DEFAULT_REPLICATION_FACTOR=1 \
      CLUSTER_ID=MkU3OEVBNTcwNTJENDM2Qk
  success "kafka-broker created"
fi

# ── 2. PostgreSQL ─────────────────────────────────────────────────────────────
header "Deploying PostgreSQL"
if az containerapp show \
    --name booking-db \
    --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  success "booking-db already exists — skipping (stateful)"
else
  log "Creating booking-db …"
  az containerapp create \
    --name booking-db \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ENV_NAME" \
    --image docker.io/postgres:15-alpine \
    --min-replicas 1 \
    --max-replicas 1 \
    --ingress internal \
    --target-port 5432 \
    --transport tcp \
    --env-vars \
      POSTGRES_USER=postgres \
      "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" \
      POSTGRES_DB=stayeasy_booking
  success "booking-db created"
fi

log "Waiting 30s for infrastructure to be ready …"
sleep 30

# ── 3. auth-service ───────────────────────────────────────────────────────────
header "Deploying auth-service"
ENV_ARGS=(
  "MONGO_URI=${MONGO_URI}"
  "JWT_SECRET=${JWT_SECRET}"
  "REFRESH_SECRET=${REFRESH_SECRET}"
  "INTERNAL_SERVICE_KEY=${INTERNAL_SERVICE_KEY}"
  "JWT_EXPIRES_IN=15m"
  "REFRESH_EXPIRES_IN=7d"
  "NODE_ENV=production"
  "GRPC_PORT=50050"
  "USER_SERVICE_HOST=user-service.internal.${ENV_DOMAIN}"
  "USER_SERVICE_PORT=80"
)
deploy_app auth-service \
  --min-replicas 1 --max-replicas 3 \
  --ingress internal --target-port 50050 --transport http2 --allow-insecure

# ── 4. user-service ───────────────────────────────────────────────────────────
header "Deploying user-service"
ENV_ARGS=(
  "MONGO_URI=${MONGO_URI}"
  "JWT_SECRET=${JWT_SECRET}"
  "REFRESH_SECRET=${REFRESH_SECRET}"
  "INTERNAL_SERVICE_KEY=${INTERNAL_SERVICE_KEY}"
  "JWT_EXPIRES_IN=15m"
  "REFRESH_EXPIRES_IN=7d"
  "NODE_ENV=production"
  "GRPC_PORT=50051"
  "DB_NAME=user-db"
)
deploy_app user-service \
  --min-replicas 1 --max-replicas 3 \
  --ingress internal --target-port 50051 --transport http2 --allow-insecure

# ── 5. rooms-service ──────────────────────────────────────────────────────────
header "Deploying rooms-service"
ENV_ARGS=(
  "MONGO_URI=${MONGO_URI}"
  "JWT_SECRET=${JWT_SECRET}"
  "REFRESH_SECRET=${REFRESH_SECRET}"
  "INTERNAL_SERVICE_KEY=${INTERNAL_SERVICE_KEY}"
  "JWT_EXPIRES_IN=15m"
  "REFRESH_EXPIRES_IN=7d"
  "NODE_ENV=production"
  "GRPC_PORT=50052"
  "DB_NAME=rooms-db"
)
deploy_app rooms-service \
  --min-replicas 1 --max-replicas 3 \
  --ingress internal --target-port 50052 --transport http2 --allow-insecure

# ── 6. booking-service ────────────────────────────────────────────────────────
header "Deploying booking-service"
ENV_ARGS=(
  "MONGO_URI=${MONGO_URI}"
  "JWT_SECRET=${JWT_SECRET}"
  "INTERNAL_SERVICE_KEY=${INTERNAL_SERVICE_KEY}"
  "NODE_ENV=production"
  "GRPC_PORT=50053"
  "USER_SERVICE_HOST=user-service.internal.${ENV_DOMAIN}"
  "USER_SERVICE_PORT=80"
  "ROOMS_SERVICE_HOST=rooms-service.internal.${ENV_DOMAIN}"
  "ROOMS_SERVICE_PORT=80"
  "POSTGRES_HOST=${POSTGRES_FQDN}"
  "POSTGRES_PORT=5432"
  "POSTGRES_USER=postgres"
  "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
  "POSTGRES_DB=stayeasy_booking"
  "KAFKA_BROKERS=${KAFKA_FQDN}:9092"
)
deploy_app booking-service \
  --min-replicas 1 --max-replicas 3 \
  --ingress internal --target-port 50053 --transport http2 --allow-insecure

# ── 7. review-service ─────────────────────────────────────────────────────────
header "Deploying review-service"
ENV_ARGS=(
  "MONGO_URI=${MONGO_URI}"
  "JWT_SECRET=${JWT_SECRET}"
  "INTERNAL_SERVICE_KEY=${INTERNAL_SERVICE_KEY}"
  "NODE_ENV=production"
  "GRPC_PORT=50054"
  "DB_NAME=review-db"
  "BOOKING_SERVICE_HOST=booking-service.internal.${ENV_DOMAIN}"
  "BOOKING_SERVICE_PORT=80"
  "USER_SERVICE_HOST=user-service.internal.${ENV_DOMAIN}"
  "USER_SERVICE_PORT=80"
  "ROOMS_SERVICE_HOST=rooms-service.internal.${ENV_DOMAIN}"
  "ROOMS_SERVICE_PORT=80"
  "KAFKA_BROKERS=${KAFKA_FQDN}:9092"
  "KAFKAJS_NO_PARTITIONER_WARNING=1"
)
deploy_app review-service \
  --min-replicas 1 --max-replicas 3 \
  --ingress internal --target-port 50054 --transport http2 --allow-insecure

# ── 8. notification-service ───────────────────────────────────────────────────
header "Deploying notification-service"
# NOTE: SMTP_PASS may contain spaces (Gmail app passwords).
# Azure Container Apps CLI handles this correctly when passed as a
# single quoted array element.
ENV_ARGS=(
  "MONGO_URI=${MONGO_URI}"
  "JWT_SECRET=${JWT_SECRET}"
  "INTERNAL_SERVICE_KEY=${INTERNAL_SERVICE_KEY}"
  "NODE_ENV=production"
  "GRPC_PORT=50055"
  "DB_NAME=stayease_notification"
  "KAFKA_BROKERS=${KAFKA_FQDN}:9092"
  "KAFKAJS_NO_PARTITIONER_WARNING=1"
  "SMTP_HOST=${SMTP_HOST}"
  "SMTP_PORT=587"
  "SMTP_USER=${SMTP_USER}"
  "SMTP_PASS=${SMTP_PASS}"
)
deploy_app notification-service \
  --min-replicas 1 --max-replicas 3 \
  --ingress internal --target-port 50055 --transport http2 --allow-insecure

# ── 9. api-gateway ────────────────────────────────────────────────────────────
header "Deploying api-gateway (public)"
# NOTE: All gRPC upstream ports use 80 — Azure Container Apps http2+allow-insecure
# routes port 80 → container's gRPC port. NestJS uses insecure credentials by default.
ENV_ARGS=(
  "PORT=3400"
  "NODE_ENV=production"
  "JWT_SECRET=${JWT_SECRET}"
  "INTERNAL_SERVICE_KEY=${INTERNAL_SERVICE_KEY}"
  "ALLOWED_ORIGINS=${ALLOWED_ORIGINS}"
  "AUTH_SERVICE_HOST=auth-service.internal.${ENV_DOMAIN}"
  "AUTH_SERVICE_PORT=80"
  "USER_SERVICE_HOST=user-service.internal.${ENV_DOMAIN}"
  "USER_SERVICE_PORT=80"
  "ROOMS_SERVICE_HOST=rooms-service.internal.${ENV_DOMAIN}"
  "ROOMS_SERVICE_PORT=80"
  "BOOKING_SERVICE_HOST=booking-service.internal.${ENV_DOMAIN}"
  "BOOKING_SERVICE_PORT=80"
  "REVIEW_SERVICE_HOST=review-service.internal.${ENV_DOMAIN}"
  "REVIEW_SERVICE_PORT=80"
  "NOTIFICATION_SERVICE_HOST=notification-service.internal.${ENV_DOMAIN}"
  "NOTIFICATION_SERVICE_PORT=80"
)
deploy_app api-gateway \
  --min-replicas 1 --max-replicas 5 \
  --ingress external --target-port 3400 --transport http

GATEWAY_FQDN=$(az containerapp show \
  --name api-gateway \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.configuration.ingress.fqdn -o tsv)

# ── 10. frontend ──────────────────────────────────────────────────────────────
if [ "${SKIP_FRONTEND_BUILD:-false}" = false ]; then
  header "Deploying frontend (public)"

  GATEWAY_URL="https://${GATEWAY_FQDN}"
  ENV_ARGS=(
    "NODE_ENV=production"
    "NEXT_PUBLIC_API_BASE_URL=${GATEWAY_URL}/api/v1"
    "API_BASE_URL=${GATEWAY_URL}"
  )
  deploy_app frontend \
    --min-replicas 1 --max-replicas 3 \
    --ingress external --target-port 3000 --transport http

  FRONTEND_FQDN=$(az containerapp show \
    --name frontend \
    --resource-group "$RESOURCE_GROUP" \
    --query properties.configuration.ingress.fqdn -o tsv)
fi

# ── Summary ───────────────────────────────────────────────────────────────────
header "Deployment Complete"
success "Image tag used: ${TAG}"
echo ""
echo -e "${BOLD}Public endpoints:${NC}"
echo -e "  API Gateway : ${GREEN}https://${GATEWAY_FQDN}${NC}"
echo -e "  Swagger UI  : ${GREEN}https://${GATEWAY_FQDN}/api/docs${NC}"
if [ -n "${FRONTEND_FQDN:-}" ]; then
  echo -e "  Frontend    : ${GREEN}https://${FRONTEND_FQDN}${NC}"
fi
echo ""
echo -e "${BOLD}Internal FQDNs (for reference):${NC}"
for SVC in auth-service user-service rooms-service booking-service review-service notification-service kafka-broker booking-db; do
  echo "  ${SVC}.internal.${ENV_DOMAIN}"
done
echo ""
