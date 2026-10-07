-- CreateTable
CREATE TABLE "StudentAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "summaryOpenedAt" DATETIME,
    "summaryConfirmedAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "latestScore" INTEGER,
    "bestScore" INTEGER,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentAssignment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentAssignmentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "finalizedAt" DATETIME,
    "autoScore" INTEGER,
    "manualScore" INTEGER,
    "finalScore" INTEGER,
    "earnedPoints" REAL,
    "totalPoints" INTEGER,
    "correctCount" INTEGER,
    "incorrectCount" INTEGER,
    "requiresTeacherReview" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Attempt_studentAssignmentId_fkey" FOREIGN KEY ("studentAssignmentId") REFERENCES "StudentAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" JSONB,
    "isCorrect" BOOLEAN,
    "awardedPoints" REAL,
    "reviewStatus" TEXT NOT NULL,
    "teacherFeedback" TEXT,
    "reviewedAt" DATETIME,
    "reviewedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "unlimitedAttempts" BOOLEAN NOT NULL DEFAULT false,
    "showExplanationsAfterSubmit" BOOLEAN NOT NULL DEFAULT false,
    "showAnswersAfterPass" BOOLEAN NOT NULL DEFAULT true,
    "deadline" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Assignment" ("classroomId", "createdAt", "deadline", "grade", "id", "minimumScore", "publishedAt", "questionCount", "status", "subject", "teacherId", "topic", "unitOrTheme", "updatedAt") SELECT "classroomId", "createdAt", "deadline", "grade", "id", "minimumScore", "publishedAt", "questionCount", "status", "subject", "teacherId", "topic", "unitOrTheme", "updatedAt" FROM "Assignment";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE INDEX "Assignment_teacherId_idx" ON "Assignment"("teacherId");
CREATE INDEX "Assignment_classroomId_idx" ON "Assignment"("classroomId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StudentAssignment_studentId_idx" ON "StudentAssignment"("studentId");

-- CreateIndex
CREATE INDEX "StudentAssignment_assignmentId_status_idx" ON "StudentAssignment"("assignmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAssignment_assignmentId_studentId_key" ON "StudentAssignment"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "Attempt_status_idx" ON "Attempt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_studentAssignmentId_attemptNumber_key" ON "Attempt"("studentAssignmentId", "attemptNumber");

-- CreateIndex
CREATE INDEX "Answer_reviewStatus_idx" ON "Answer"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_attemptId_questionId_key" ON "Answer"("attemptId", "questionId");
