/*
  Warnings:

  - Added the required column `joinCode` to the `Classroom` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Classroom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "joinCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Classroom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Existing classrooms get a random 8-character join code.
INSERT INTO "new_Classroom" ("createdAt", "grade", "id", "joinCode", "name", "teacherId") SELECT "createdAt", "grade", "id", upper(hex(randomblob(4))), "name", "teacherId" FROM "Classroom";
DROP TABLE "Classroom";
ALTER TABLE "new_Classroom" RENAME TO "Classroom";
CREATE UNIQUE INDEX "Classroom_joinCode_key" ON "Classroom"("joinCode");
CREATE INDEX "Classroom_teacherId_idx" ON "Classroom"("teacherId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
