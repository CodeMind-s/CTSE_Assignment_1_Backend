# GitHub Secrets Required

## Backend Repo Secrets
| Secret Name           | Description                                      |
|-----------------------|--------------------------------------------------|
| AZURE_CREDENTIALS     | JSON from: az ad sp create-for-rbac --json-auth  |
| ACR_USERNAME          | From: az acr credential show --name ctseassignment1 |
| ACR_PASSWORD          | From: az acr credential show --name ctseassignment1 |
| SONAR_TOKEN           | SonarCloud project token                         |
| MONGO_URI             | MongoDB Atlas connection string                  |
| JWT_SECRET            | JWT signing secret                               |
| REFRESH_SECRET        | Refresh token signing secret                     |
| INTERNAL_SERVICE_KEY  | Internal gRPC authentication key                 |
| POSTGRES_PASSWORD     | PostgreSQL password (default: postgres)          |
| SMTP_HOST             | SMTP server hostname                             |
| SMTP_USER             | SMTP email address                               |
| SMTP_PASS             | SMTP app password (Gmail app password)           |
| ALLOWED_ORIGINS       | Comma-separated CORS origins for api-gateway     |

## Frontend Repo Secrets
| Secret Name           | Description                                      |
|-----------------------|--------------------------------------------------|
| AZURE_CREDENTIALS     | Same JSON as backend                             |
| ACR_USERNAME          | Same as backend                                  |
| ACR_PASSWORD          | Same as backend                                  |
| API_GATEWAY_URL       | e.g. https://api-gateway.xyz.eastus.azurecontainerapps.io |

## How to get API_GATEWAY_URL after first backend deploy:
```bash
az containerapp show \
  --name api-gateway \
  --resource-group CTSE_gr \
  --query properties.configuration.ingress.fqdn -o tsv
```
Then set: `API_GATEWAY_URL = https://{the returned FQDN}`
