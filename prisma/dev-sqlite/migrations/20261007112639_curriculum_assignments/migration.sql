-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Classroom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurriculumOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "unitOrTheme" TEXT,
    "unitOrThemeCode" TEXT,
    "outcomeCode" TEXT NOT NULL,
    "outcomeCodeAsPrinted" TEXT,
    "outcomeText" TEXT NOT NULL,
    "outcomeGroup" TEXT,
    "processComponents" JSONB,
    "learningArea" TEXT,
    "skills" JSONB,
    "conceptualSkills" JSONB,
    "values" JSONB,
    "literacySkills" JSONB,
    "sourceUrl" TEXT NOT NULL,
    "sourceTitle" TEXT,
    "sourceFetchedAt" DATETIME,
    "reviewStatus" TEXT NOT NULL,
    "reviewReasons" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CurriculumOutcomeUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outcomeId" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "unitOrTheme" TEXT NOT NULL,
    "unitOrThemeCode" TEXT,
    "unitOrder" INTEGER NOT NULL,
    "outcomeOrder" INTEGER NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    CONSTRAINT "CurriculumOutcomeUnit_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "CurriculumOutcome" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "unitOrTheme" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "minimumScore" INTEGER NOT NULL DEFAULT 70,
    "deadline" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssignmentOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    CONSTRAINT "AssignmentOutcome_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssignmentOutcome_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "CurriculumOutcome" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Classroom_teacherId_idx" ON "Classroom"("teacherId");

-- CreateIndex
CREATE INDEX "CurriculumOutcome_grade_subject_idx" ON "CurriculumOutcome"("grade", "subject");

-- CreateIndex
CREATE INDEX "CurriculumOutcome_grade_subject_unitOrTheme_idx" ON "CurriculumOutcome"("grade", "subject", "unitOrTheme");

-- CreateIndex
CREATE INDEX "CurriculumOutcome_reviewStatus_idx" ON "CurriculumOutcome"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumOutcome_subject_grade_outcomeCode_key" ON "CurriculumOutcome"("subject", "grade", "outcomeCode");

-- CreateIndex
CREATE INDEX "CurriculumOutcomeUnit_grade_subject_unitOrTheme_idx" ON "CurriculumOutcomeUnit"("grade", "subject", "unitOrTheme");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumOutcomeUnit_outcomeId_unitOrTheme_key" ON "CurriculumOutcomeUnit"("outcomeId", "unitOrTheme");

-- CreateIndex
CREATE INDEX "Assignment_teacherId_idx" ON "Assignment"("teacherId");

-- CreateIndex
CREATE INDEX "Assignment_classroomId_idx" ON "Assignment"("classroomId");

-- CreateIndex
CREATE INDEX "AssignmentOutcome_assignmentId_idx" ON "AssignmentOutcome"("assignmentId");

-- CreateIndex
CREATE INDEX "AssignmentOutcome_outcomeId_idx" ON "AssignmentOutcome"("outcomeId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentOutcome_assignmentId_outcomeId_key" ON "AssignmentOutcome"("assignmentId", "outcomeId");
