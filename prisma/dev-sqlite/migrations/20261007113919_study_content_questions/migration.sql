-- CreateTable
CREATE TABLE "ClassroomMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classroomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassroomMember_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClassroomMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "introduction" TEXT NOT NULL DEFAULT '',
    "keyConcepts" JSONB NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "simpleExample" TEXT NOT NULL DEFAULT '',
    "mustKnow" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "aiModel" TEXT,
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "teacherEditedAt" DATETIME,
    "teacherApprovedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudyContent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "explanation" TEXT,
    "points" INTEGER NOT NULL DEFAULT 10,
    "orderNum" INTEGER NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    CONSTRAINT "QuestionOutcome_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionOutcome_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "CurriculumOutcome" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentGenerationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "generatedAt" DATETIME,
    "errorMessage" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    CONSTRAINT "ContentGenerationLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "unitOrTheme" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "minimumScore" INTEGER NOT NULL DEFAULT 70,
    "questionCount" INTEGER NOT NULL DEFAULT 7,
    "deadline" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Assignment" ("classroomId", "createdAt", "deadline", "grade", "id", "minimumScore", "publishedAt", "status", "subject", "teacherId", "topic", "unitOrTheme", "updatedAt") SELECT "classroomId", "createdAt", "deadline", "grade", "id", "minimumScore", "publishedAt", "status", "subject", "teacherId", "topic", "unitOrTheme", "updatedAt" FROM "Assignment";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE INDEX "Assignment_teacherId_idx" ON "Assignment"("teacherId");
CREATE INDEX "Assignment_classroomId_idx" ON "Assignment"("classroomId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ClassroomMember_studentId_idx" ON "ClassroomMember"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassroomMember_classroomId_studentId_key" ON "ClassroomMember"("classroomId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyContent_assignmentId_key" ON "StudyContent"("assignmentId");

-- CreateIndex
CREATE INDEX "Question_assignmentId_orderNum_idx" ON "Question"("assignmentId", "orderNum");

-- CreateIndex
CREATE INDEX "QuestionOutcome_outcomeId_idx" ON "QuestionOutcome"("outcomeId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOutcome_questionId_outcomeId_key" ON "QuestionOutcome"("questionId", "outcomeId");

-- CreateIndex
CREATE INDEX "ContentGenerationLog_assignmentId_status_idx" ON "ContentGenerationLog"("assignmentId", "status");
