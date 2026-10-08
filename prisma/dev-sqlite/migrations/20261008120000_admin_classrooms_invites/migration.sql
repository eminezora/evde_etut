-- AlterTable
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN "disabledAt" DATETIME;

-- AlterTable
ALTER TABLE "Classroom" ADD COLUMN "description" TEXT;
ALTER TABLE "Classroom" ADD COLUMN "archivedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Classroom_teacherId_archivedAt_idx" ON "Classroom"("teacherId", "archivedAt");

-- CreateTable
CREATE TABLE "TeacherInviteCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT 1,
    "expiresAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeacherInviteCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeacherInviteUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inviteCodeId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherInviteUsage_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "TeacherInviteCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeacherInviteUsage_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherInviteCode_code_key" ON "TeacherInviteCode"("code");
CREATE INDEX "TeacherInviteCode_code_isActive_idx" ON "TeacherInviteCode"("code", "isActive");
CREATE INDEX "TeacherInviteUsage_inviteCodeId_idx" ON "TeacherInviteUsage"("inviteCodeId");
CREATE INDEX "TeacherInviteUsage_teacherId_idx" ON "TeacherInviteUsage"("teacherId");
CREATE INDEX "AuditLog_adminId_idx" ON "AuditLog"("adminId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");
