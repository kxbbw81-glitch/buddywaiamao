CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "module" TEXT,
    "resource" TEXT,
    "resourceId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'UNREAD',
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "connectorType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "authMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "secretRef" TEXT,
    "configSummary" JSONB NOT NULL,
    "fallbackMode" TEXT NOT NULL DEFAULT 'MANUAL_ENTRY',
    "healthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "integrationConnectionId" TEXT,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalEventId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "receivedPayloadSummary" JSONB NOT NULL,
    "processingResult" JSONB,
    "idempotencyKey" TEXT,
    "duplicatePrevented" BOOLEAN NOT NULL DEFAULT false,
    "recordedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationConnection_code_key" ON "IntegrationConnection"("code");
CREATE UNIQUE INDEX "WebhookEvent_provider_idempotencyKey_key" ON "WebhookEvent"("provider", "idempotencyKey");
CREATE INDEX "Notification_recipientId_status_createdAt_idx" ON "Notification"("recipientId", "status", "createdAt");
CREATE INDEX "Notification_module_resource_resourceId_idx" ON "Notification"("module", "resource", "resourceId");
CREATE INDEX "Notification_createdById_createdAt_idx" ON "Notification"("createdById", "createdAt");
CREATE INDEX "IntegrationConnection_provider_connectorType_status_idx" ON "IntegrationConnection"("provider", "connectorType", "status");
CREATE INDEX "IntegrationConnection_healthStatus_updatedAt_idx" ON "IntegrationConnection"("healthStatus", "updatedAt");
CREATE INDEX "IntegrationConnection_createdById_createdAt_idx" ON "IntegrationConnection"("createdById", "createdAt");
CREATE INDEX "WebhookEvent_integrationConnectionId_receivedAt_idx" ON "WebhookEvent"("integrationConnectionId", "receivedAt");
CREATE INDEX "WebhookEvent_provider_eventType_status_receivedAt_idx" ON "WebhookEvent"("provider", "eventType", "status", "receivedAt");
CREATE INDEX "WebhookEvent_recordedById_receivedAt_idx" ON "WebhookEvent"("recordedById", "receivedAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
