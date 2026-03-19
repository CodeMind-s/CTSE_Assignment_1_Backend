#!/bin/bash
set -e

echo "=== CTSE Assignment 1 — Azure Infrastructure Setup ==="
echo ""

# ─── CONFIGURATION ───────────────────────────────────────────────
RESOURCE_GROUP="CTSE_gr"
ACR_NAME="ctseassignment1"
ENVIRONMENT_NAME="stayeasy-env"
WORKSPACE_NAME="stayeasy-logs"
LOCATION="eastus"
SP_NAME="ctse-github-actions"
# ─────────────────────────────────────────────────────────────────

echo "1. Logging in to Azure..."
az login

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "   Using subscription: $SUBSCRIPTION_ID"
echo ""

echo "2. Creating Resource Group: $RESOURCE_GROUP..."
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION \
  --output table
echo ""

echo "3. Creating Container Registry: $ACR_NAME..."
echo "   NOTE: Azure ACR names must be lowercase alphanumeric."
echo "   Your requested name 'CTSE_Assingment_1' → using 'ctseassignment1'"
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true \
  --output table
echo ""

echo "4. Registering Azure providers..."
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait
echo "   Providers registered."
echo ""

echo "5. Creating Log Analytics Workspace..."
az monitor log-analytics workspace create \
  --resource-group $RESOURCE_GROUP \
  --workspace-name $WORKSPACE_NAME \
  --location $LOCATION \
  --output table

WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group $RESOURCE_GROUP \
  --workspace-name $WORKSPACE_NAME \
  --query customerId -o tsv)

WORKSPACE_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group $RESOURCE_GROUP \
  --workspace-name $WORKSPACE_NAME \
  --query primarySharedKey -o tsv)
echo ""

echo "6. Creating Container Apps Environment: $ENVIRONMENT_NAME..."
az containerapp env create \
  --name $ENVIRONMENT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --logs-workspace-id $WORKSPACE_ID \
  --logs-workspace-key $WORKSPACE_KEY \
  --output table
echo ""

echo "7. Creating Service Principal for GitHub Actions..."
SP_JSON=$(az ad sp create-for-rbac \
  --name $SP_NAME \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP \
  --json-auth)

echo ""
echo "======================================================="
echo "AZURE_CREDENTIALS secret (add to GitHub repo secrets):"
echo "======================================================="
echo "$SP_JSON"
echo "======================================================="
echo ""

echo "8. Getting ACR credentials..."
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

echo ""
echo "======================================================="
echo "GitHub Secrets to add to BOTH repos (backend + frontend):"
echo "======================================================="
echo "AZURE_CREDENTIALS   = (the JSON above)"
echo "ACR_USERNAME        = $ACR_USERNAME"
echo "ACR_PASSWORD        = $ACR_PASSWORD"
echo ""
echo "Backend repo only:"
echo "SONAR_TOKEN         = (your SonarCloud token)"
echo "MONGO_URI           = (your MongoDB Atlas connection string)"
echo "JWT_SECRET          = (your JWT secret)"
echo "REFRESH_SECRET      = (your refresh token secret)"
echo "INTERNAL_SERVICE_KEY= (your internal service key)"
echo "POSTGRES_PASSWORD   = postgres"
echo "SMTP_HOST           = smtp.gmail.com"
echo "SMTP_USER           = (your email)"
echo "SMTP_PASS           = (your app password)"
echo "ALLOWED_ORIGINS     = (comma-separated allowed CORS origins)"
echo ""
echo "Frontend repo only:"
echo "API_GATEWAY_URL     = (fill after first backend deploy, e.g. https://api-gateway.xyz.eastus.azurecontainerapps.io)"
echo "======================================================="
echo ""
echo "✅ Azure infrastructure setup complete!"
echo ""
echo "Next steps:"
echo "  1. Add all the GitHub Secrets listed above to each repo"
echo "  2. Push to main branch to trigger CI/CD"
echo "  3. After first backend deploy, get the API Gateway URL and add it"
echo "     as API_GATEWAY_URL secret in the FRONTEND repo, then re-run"
echo "     the frontend workflow."
