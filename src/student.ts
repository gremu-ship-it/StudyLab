import { useStore, store } from "./store";
import type { AcademicPeriod, Course, Institution, Programme, StudentProfile } from "./types";

export interface StudentContext {
  student: StudentProfile | undefined;
  institution: Institution | undefined;
  programme: Programme | undefined;
  period: AcademicPeriod | undefined;
  courses: Course[];
  courseIds: Set<string>;
}

/** All curriculum/progress data that should be scoped to the logged-in student's programme. */
export function useStudent(): StudentContext {
  return useStore((db) => {
    const student = db.student_profiles.find((s) => s.id === store.studentId);
    const programme = student ? db.programmes.find((p) => p.id === student.programme_id) : undefined;
    const institution = student ? db.institutions.find((i) => i.id === student.institution_id) : undefined;
    const period = student
      ? db.academic_periods.find((p) => p.id === db.enrolments.find((e) => e.student_id === student.id && e.status === "active")?.academic_period_id)
        ?? db.academic_periods.find((p) => p.programme_id === student.programme_id && p.status === "active")
      : undefined;
    const courses = db.courses.filter((c) => c.programme_id === student?.programme_id);
    return {
      student, institution, programme, period, courses,
      courseIds: new Set(courses.map((c) => c.id)),
    };
  });
}
