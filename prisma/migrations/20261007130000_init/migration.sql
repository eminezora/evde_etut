-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "joinCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomMember" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumOutcome" (
    "id" TEXT NOT NULL,
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
    "sourceFetchedAt" TIMESTAMP(3),
    "reviewStatus" TEXT NOT NULL,
    "reviewReasons" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumOutcomeUnit" (
    "id" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "unitOrTheme" TEXT NOT NULL,
    "unitOrThemeCode" TEXT,
    "unitOrder" INTEGER NOT NULL,
    "outcomeOrder" INTEGER NOT NULL,
    "sourceUrl" TEXT NOT NULL,

    CONSTRAINT "CurriculumOutcomeUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
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
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentOutcome" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,

    CONSTRAINT "AssignmentOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyContent" (
    "id" TEXT NOT NULL,
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
    "teacherEditedAt" TIMESTAMP(3),
    "teacherApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "explanation" TEXT,
    "points" INTEGER NOT NULL DEFAULT 10,
    "orderNum" INTEGER NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOutcome" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,

    CONSTRAINT "QuestionOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentGenerationLog" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,

    CONSTRAINT "ContentGenerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAssignment" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "summaryOpenedAt" TIMESTAMP(3),
    "summaryConfirmedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "latestScore" INTEGER,
    "bestScore" INTEGER,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "studentAssignmentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "autoScore" INTEGER,
    "manualScore" INTEGER,
    "finalScore" INTEGER,
    "earnedPoints" DOUBLE PRECISION,
    "totalPoints" INTEGER,
    "correctCount" INTEGER,
    "incorrectCount" INTEGER,
    "requiresTeacherReview" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" JSONB,
    "isCorrect" BOOLEAN,
    "awardedPoints" DOUBLE PRECISION,
    "reviewStatus" TEXT NOT NULL,
    "teacherFeedback" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_joinCode_key" ON "Classroom"("joinCode");

-- CreateIndex
CREATE INDEX "Classroom_teacherId_idx" ON "Classroom"("teacherId");

-- CreateIndex
CREATE INDEX "ClassroomMember_studentId_idx" ON "ClassroomMember"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassroomMember_classroomId_studentId_key" ON "ClassroomMember"("classroomId", "studentId");

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

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMember" ADD CONSTRAINT "ClassroomMember_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMember" ADD CONSTRAINT "ClassroomMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumOutcomeUnit" ADD CONSTRAINT "CurriculumOutcomeUnit_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "CurriculumOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentOutcome" ADD CONSTRAINT "AssignmentOutcome_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentOutcome" ADD CONSTRAINT "AssignmentOutcome_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "CurriculumOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyContent" ADD CONSTRAINT "StudyContent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOutcome" ADD CONSTRAINT "QuestionOutcome_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOutcome" ADD CONSTRAINT "QuestionOutcome_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "CurriculumOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentGenerationLog" ADD CONSTRAINT "ContentGenerationLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAssignment" ADD CONSTRAINT "StudentAssignment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAssignment" ADD CONSTRAINT "StudentAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_studentAssignmentId_fkey" FOREIGN KEY ("studentAssignmentId") REFERENCES "StudentAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

