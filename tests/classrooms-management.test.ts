import { afterAll, describe, expect, it } from "vitest";
import {
  deleteOrArchiveClassroom,
  regenerateClassroomJoinCode,
  unarchiveClassroom,
  updateClassroom,
} from "../src/lib/classroom/classroom-service.ts";
import {
  joinClassroom,
  listStudentClassrooms,
  listTeacherClassrooms,
} from "../src/lib/accounts/account-service.ts";
import { db, makeStudent, makeTeacher, verifiedOutcomesOfFirstUnit, inDays, ensureCurriculum } from "./helpers.ts";
import { createAssignment } from "../src/lib/assignments/assignment-service.ts";

afterAll(() => db.$disconnect());

describe("classroom management & archiving", () => {
  it("teacher can edit their own classroom details", async () => {
    const { teacher, rooms } = await makeTeacher([{ name: "7/A", grade: 7 }]);
    const classroom = rooms[0];

    const updated = await updateClassroom(teacher.id, classroom.id, {
      name: "7/A Yıldızlar",
      description: "2026 Bahar Dönemi",
    }, db);

    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.name).toBe("7/A Yıldızlar");
      expect(updated.data.description).toBe("2026 Bahar Dönemi");
      expect(updated.data.grade).toBe(7);
    }
  });

  it("prevents another teacher from editing the classroom", async () => {
    const { rooms } = await makeTeacher([{ name: "7/B", grade: 7 }]);
    const { teacher: otherTeacher } = await makeTeacher([]);

    const attempt = await updateClassroom(otherTeacher.id, rooms[0].id, {
      name: "İzinsiz Değişiklik",
    }, db);

    expect(attempt.ok).toBe(false);
    if (!attempt.ok) {
      expect(attempt.status).toBe(403);
    }
  });

  it("blocks grade change if the classroom already has assigned assignments", async () => {
    await ensureCurriculum();
    const { teacher, rooms } = await makeTeacher([{ name: "6/A", grade: 6 }]);
    const classroom = rooms[0];

    // Create an assignment in grade 6
    const { unitOrTheme, outcomes } = await verifiedOutcomesOfFirstUnit(6, "Fen Bilimleri");
    const asgn = await createAssignment(teacher.id, {
      classroomId: classroom.id,
      subject: "Fen Bilimleri",
      unitOrTheme,
      topic: "Hücre ve Bölünmeler",
      outcomeIds: [outcomes[0].id],
      minimumScore: 70,
      deadline: inDays(7),
    }, db);
    expect(asgn.ok).toBe(true);

    // Try to change classroom grade to 7
    const result = await updateClassroom(teacher.id, classroom.id, { grade: 7 }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("GRADE_CONFLICT");
    }
  });

  it("regenerates join code: generates a new unique code and keeps existing members enrolled", async () => {
    const { teacher, rooms } = await makeTeacher([{ name: "8/C", grade: 8 }]);
    const classroom = rooms[0];
    const oldCode = classroom.joinCode;

    const student = await makeStudent([classroom.id]);

    const regen = await regenerateClassroomJoinCode(teacher.id, classroom.id, db);
    expect(regen.ok).toBe(true);
    if (regen.ok) {
      expect(regen.data.joinCode).not.toBe(oldCode);
      expect(regen.data.joinCode.length).toBe(8);

      // Verify old code cannot be used to join anymore
      const student2 = await makeStudent([]);
      const badJoin = await joinClassroom(student2.id, { code: oldCode }, db);
      expect(badJoin.ok).toBe(false);

      // Verify new code can be used to join
      const goodJoin = await joinClassroom(student2.id, { code: regen.data.joinCode }, db);
      expect(goodJoin.ok).toBe(true);

      // Verify original student is still a member
      const memberCount = await db.classroomMember.count({ where: { classroomId: classroom.id } });
      expect(memberCount).toBe(2);
      expect(await db.classroomMember.findUnique({
        where: { classroomId_studentId: { classroomId: classroom.id, studentId: student.id } },
      })).not.toBeNull();
    }
  });

  it("hard-deletes a completely empty classroom (0 students, 0 assignments)", async () => {
    const { teacher, rooms } = await makeTeacher([{ name: "5/Bos", grade: 5 }]);
    const classroom = rooms[0];

    const del = await deleteOrArchiveClassroom(teacher.id, classroom.id, db);
    expect(del.ok).toBe(true);
    if (del.ok) {
      expect(del.action).toBe("DELETED");
    }

    const inDb = await db.classroom.findUnique({ where: { id: classroom.id } });
    expect(inDb).toBeNull();
  });

  it("soft-archives a classroom that has student data and preserves history", async () => {
    const { teacher, rooms } = await makeTeacher([{ name: "7/Dolu", grade: 7 }]);
    const classroom = rooms[0];
    const student = await makeStudent([classroom.id]);

    const result = await deleteOrArchiveClassroom(teacher.id, classroom.id, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.action).toBe("ARCHIVED");
    }

    // Classroom still exists in database with archivedAt timestamp
    const inDb = await db.classroom.findUnique({ where: { id: classroom.id } });
    expect(inDb).not.toBeNull();
    expect(inDb?.archivedAt).not.toBeNull();

    // Not in teacher's default active list
    const activeList = await listTeacherClassrooms(teacher.id, { onlyArchived: false }, db);
    expect(activeList.some((c) => c.id === classroom.id)).toBe(false);

    // Visible in teacher's archived list
    const archivedList = await listTeacherClassrooms(teacher.id, { onlyArchived: true }, db);
    expect(archivedList.some((c) => c.id === classroom.id)).toBe(true);

    // Hidden from student's active classrooms
    const studentList = await listStudentClassrooms(student.id, db);
    expect(studentList.some((c) => c.id === classroom.id)).toBe(false);

    // New student cannot join an archived classroom
    const newStudent = await makeStudent([]);
    const joinResult = await joinClassroom(newStudent.id, { code: classroom.joinCode }, db);
    expect(joinResult.ok).toBe(false);
    if (!joinResult.ok) {
      expect(joinResult.code).toBe("CLASSROOM_ARCHIVED");
    }

    // Can be unarchived / restored
    const restore = await unarchiveClassroom(teacher.id, classroom.id, db);
    expect(restore.ok).toBe(true);

    const restoredList = await listTeacherClassrooms(teacher.id, { onlyArchived: false }, db);
    expect(restoredList.some((c) => c.id === classroom.id)).toBe(true);
  });
});
