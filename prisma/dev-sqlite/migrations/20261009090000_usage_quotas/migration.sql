-- CreateTable
CREATE TABLE "UsageQuotaPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    "unlimited" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserQuotaOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    "unlimited" BOOLEAN NOT NULL DEFAULT false,
    "validUntil" DATETIME,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserQuotaOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageCounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UsageCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "counterId" TEXT,
    "remainingAfter" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageQuotaPolicy_role_feature_key" ON "UsageQuotaPolicy"("role", "feature");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuotaOverride_userId_feature_key" ON "UserQuotaOverride"("userId", "feature");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_userId_feature_periodType_periodStart_key" ON "UsageCounter"("userId", "feature", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "UsageEvent_userId_createdAt_idx" ON "UsageEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_userId_feature_correlationId_key" ON "UsageEvent"("userId", "feature", "correlationId");


-- Default role quotas (editable in the admin panel under "Kullanım Limitleri").
INSERT INTO "UsageQuotaPolicy" ("id", "role", "feature", "periodType", "limit", "unlimited", "isActive", "createdAt", "updatedAt") VALUES
  ('qp_teacher_content', 'TEACHER', 'AI_CONTENT_GENERATION', 'DAILY', 10, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('qp_teacher_assistant', 'TEACHER', 'AI_ASSISTANT_MESSAGE', 'DAILY', 30, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('qp_student_assistant', 'STUDENT', 'AI_ASSISTANT_MESSAGE', 'DAILY', 20, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('qp_admin_content', 'ADMIN', 'AI_CONTENT_GENERATION', 'DAILY', 0, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('qp_admin_assistant', 'ADMIN', 'AI_ASSISTANT_MESSAGE', 'DAILY', 0, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
