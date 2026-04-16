# MaintainPro — AWS MVP Infrastructure Setup (eu-central-1)

Manual step-by-step guide. Terraform conversion is a post-MVP task (spec §13 sprint 8).

---

## Prerequisites

- AWS account with MFA enabled on the root user (never use root for day-to-day ops).
- IAM user `maintainpro-deploy` with `AdministratorAccess` (scope down after MVP).
- AWS CLI v2 configured: `aws configure --profile maintainpro`.
- Docker installed locally for building and pushing images.

---

## Step 1 — RDS PostgreSQL 16

1. Open **RDS → Create database** in `eu-central-1`.
2. Engine: **PostgreSQL 16**, template: **Free tier** (or Production for real pilots).
3. Instance: `db.t3.micro`, storage: **20 GB gp3**, enable storage autoscaling.
4. DB name: `maintainpro`, master user: `maintainpro`.
5. **Public access: OFF** — the database must be reachable only from within the VPC.
6. VPC: default (or a dedicated VPC if you create one later).
7. Security group: create `maintainpro-rds-sg`; inbound rule: **PostgreSQL (5432)** from the App Runner VPC connector security group (add after Step 6).
8. After creation, store the connection string in Secrets Manager (Step 4).

---

## Step 2 — S3 + CloudFront

1. **Create S3 bucket**: `maintainpro-uploads-prod` in `eu-central-1`.
   - Block all public access: **ON**.
   - Versioning: optional (recommended for audit trail on uploaded files).
2. **Create CloudFront distribution**:
   - Origin: the S3 bucket.
   - Origin access: **Origin access control (OAC)** — create a new OAC, copy the generated bucket policy into the S3 bucket policy.
   - Cache policy: `CachingOptimized` for static assets.
   - Note the CloudFront domain (`dxxxxxxxxxx.cloudfront.net`) — this is `S3_PUBLIC_URL`.
3. For presigned upload URLs the app talks to S3 directly; CloudFront is used only for reads.

---

## Step 3 — SES (Email)

1. **SES → Verified identities → Create identity**: choose **Domain**, enter your domain.
2. Add the CNAME/TXT records to Route 53 (or your DNS provider) to verify.
3. **Request production access** (SES starts in sandbox — sandbox limits sends to verified addresses only):
   - SES → Account dashboard → Request production access.
   - Fill the use-case form (transactional maintenance notifications, Turkish manufacturing).
4. Set `SES_FROM_EMAIL` to an address under the verified domain.

---

## Step 4 — AWS Secrets Manager

Store all runtime secrets so they are never in environment files or the Docker image.

```bash
# Database connection string
aws secretsmanager create-secret \
  --name maintainpro/prod/database-url \
  --secret-string "postgresql://maintainpro:<password>@<rds-endpoint>:5432/maintainpro?schema=public" \
  --region eu-central-1

# NextAuth secret (generate with: openssl rand -base64 32)
aws secretsmanager create-secret \
  --name maintainpro/prod/nextauth-secret \
  --secret-string "<generated-secret>" \
  --region eu-central-1

# FCM server key (from Firebase console → Project settings → Cloud Messaging)
aws secretsmanager create-secret \
  --name maintainpro/prod/fcm-server-key \
  --secret-string "<fcm-server-key>" \
  --region eu-central-1
```

Repeat for the remaining secrets listed in `apprunner.yaml` (s3-bucket, s3-public-url, ses-from-email, ses-reply-to, fcm-project-id, app-url, nextauth-url).

---

## Step 5 — ECR (Container Registry)

```bash
# Create the repository
aws ecr create-repository \
  --repository-name maintainpro \
  --region eu-central-1

# Authenticate Docker to ECR (replace ACCOUNT_ID)
aws ecr get-login-password --region eu-central-1 \
  | docker login --username AWS --password-stdin \
    ACCOUNT_ID.dkr.ecr.eu-central-1.amazonaws.com

# Build and push the first image
docker build -t maintainpro .
docker tag maintainpro:latest \
  ACCOUNT_ID.dkr.ecr.eu-central-1.amazonaws.com/maintainpro:latest
docker push \
  ACCOUNT_ID.dkr.ecr.eu-central-1.amazonaws.com/maintainpro:latest
```

---

## Step 6 — App Runner Service

1. **App Runner → Create service** in `eu-central-1`.
2. Source: **Container registry → Amazon ECR**.
   - Image URI: `ACCOUNT_ID.dkr.ecr.eu-central-1.amazonaws.com/maintainpro:latest`.
   - Deployment trigger: **Automatic** (re-deploys on every new image push) or Manual.
3. Service settings:
   - CPU: 1 vCPU, Memory: 2 GB (scale up if needed).
   - Port: **3000**.
4. **Environment variables**: reference each Secrets Manager ARN from `apprunner.yaml`.
   - In the console: add each variable, choose type **Secret**, paste the ARN.
5. **VPC connector**: create a connector in the same VPC/subnets as the RDS instance.
   - Attach the connector to the App Runner service.
   - Update `maintainpro-rds-sg` to allow inbound 5432 from the VPC connector's security group.
6. **IAM role for App Runner**: ensure the task role has:
   - `secretsmanager:GetSecretValue` on `arn:aws:secretsmanager:eu-central-1:ACCOUNT_ID:secret:maintainpro/*`
   - `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `arn:aws:s3:::maintainpro-uploads-prod/*`
   - `ses:SendEmail`, `ses:SendRawEmail`
7. After the service is healthy, run Prisma migrations:
   ```bash
   # From your local machine (with DATABASE_URL pointing to RDS via a bastion or temporary public access)
   npx prisma migrate deploy
   ```
   Or add `npx prisma migrate deploy && node server.js` as the App Runner start command during initial setup, then revert to `node server.js`.

---

## Step 7 — Custom Domain (Route 53)

1. In App Runner → your service → **Custom domains → Add domain**.
2. Enter `app.yourdomain.com` (or bare domain).
3. App Runner provides CNAME records — add them to Route 53 hosted zone.
4. TLS certificate is provisioned automatically by App Runner (ACM).
5. Update `NEXTAUTH_URL` and `APP_URL` secrets to the new domain once DNS propagates.

---

## Notes

- **Terraform** conversion is planned for post-MVP (spec §13 sprint 8). Do not start IaC work until the MVP is live and stable.
- **ERP integration** (Logo, SAP, Mikro) is Phase 2 — do not touch `infra/` for that scope.
- Rotate the `maintainpro-deploy` IAM credentials after the first successful deploy and switch to assume-role patterns.
