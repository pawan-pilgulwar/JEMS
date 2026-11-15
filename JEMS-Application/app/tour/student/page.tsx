import StudentDashboard from "@/components/dashboard/student/StudentDashboard";
import { StudentProvider } from "@/components/dashboard/student/StudentContext";
import StudentShell from "@/components/dashboard/student/StudentShell";
import { TOUR_STUDENT, TOUR_STUDENT_AI, TOUR_STUDENT_DASHBOARD } from "@/lib/tour/fixtures";

/** Student tour: the dashboard with a sample student. */
export default function StudentTourPage() {
  return (
    <StudentProvider value={TOUR_STUDENT}>
      <StudentShell name={TOUR_STUDENT.name} email={TOUR_STUDENT.email} image={null}>
        <StudentDashboard data={TOUR_STUDENT_DASHBOARD} ai={TOUR_STUDENT_AI} />
      </StudentShell>
    </StudentProvider>
  );
}
