/**
 * Static sample data for the guided tours (/tour/*). Tours render the real
 * portal screens from these fixtures so nothing is read from or written to
 * the database while someone is taking a tour. Type-only imports keep this
 * module free of any DB code.
 */

import type { DashboardAiData } from "@/components/dashboard/student/StudentDashboard";
import type { CollaborationView } from "@/lib/db/collaborations";
import type { CompanyDashboard } from "@/lib/db/company";
import type { FacultyDashboardData } from "@/lib/db/faculty";
import type { InstitutionDashboard } from "@/lib/db/institution";
import type { DashboardData } from "@/lib/db/student-data";
import type { StudentView } from "@/lib/student";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

// ── Student ─────────────────────────────────────────────────────

export const TOUR_STUDENT: StudentView = {
  id: "tour-student",
  name: "Aarav Sharma",
  firstName: "Aarav",
  email: "aarav.sharma@example.com",
  image: null,
  title: "Aspiring Full Stack Developer",
  location: "Pune, India",
  readiness: 68,
  experienceLevel: "Entry level",
  targetRole: "Full Stack Developer",
  learningStyle: "Hands-on projects",
  yearsOfExperience: "0–1",
};

export const TOUR_STUDENT_DASHBOARD: DashboardData = {
  readiness: 68,
  atsScore: 82,
  interviewsCompleted: 4,
  interviewsAverage: 74,
  newMatches: 3,
  jobs: [
    { id: "j1", role: "Frontend Developer Intern", company: "Infosys", companyId: "", match: 86, location: "Bengaluru", type: "Internship", salary: "₹30k/month", posted: "2 days ago", remote: false, matched: ["React", "JavaScript", "HTML5", "CSS3"], missing: ["TypeScript"] },
    { id: "j2", role: "Full Stack Developer", company: "Zoho", companyId: "", match: 74, location: "Chennai", type: "Full-time", salary: "₹7–10 LPA", posted: "4 days ago", remote: false, matched: ["Node.js", "React", "SQL"], missing: ["Docker", "Java"] },
    { id: "j3", role: "Software Engineer Trainee", company: "TCS", companyId: "", match: 69, location: "Remote", type: "Full-time", salary: "₹4–6 LPA", posted: "1 week ago", remote: true, matched: ["Java", "SQL", "Git"], missing: ["Spring Boot"] },
  ],
  upcoming: [
    { title: "Mock interview: Frontend round", when: "Tomorrow, 5:00 PM", tag: "Interview" },
    { title: "Infosys Frontend Intern — shortlisting closes", when: "Fri, 11:59 PM", tag: "Deadline" },
  ],
  activity: [
    { text: "Verified React with an AI test (84%)", time: "2 hours ago" },
    { text: "Applied to Frontend Developer Intern at Infosys", time: "Yesterday" },
    { text: "Passed roadmap module 3 · Async JavaScript", time: "3 days ago" },
  ],
  skills: [
    { name: "JavaScript", level: 82, verified: true },
    { name: "React", level: 78, verified: true },
    { name: "HTML5", level: 88, verified: true },
    { name: "Node.js", level: 64, verified: false },
    { name: "SQL", level: 60, verified: false },
  ],
  resumeProgress: 90,
  hasResume: true,
  assessmentDone: true,
  verifiedSkills: 3,
  latestAdvisorReport: null,
};

export const TOUR_STUDENT_AI: DashboardAiData = {
  roadmaps: [
    { id: "r1", skill: "TypeScript", totalWeeks: 4, steps: 6, missingSkills: ["Generics", "Type narrowing"], updatedAt: daysAgo(2) },
    { id: "r2", skill: "Docker", totalWeeks: 3, steps: 5, missingSkills: ["Images", "Compose"], updatedAt: daysAgo(6) },
  ],
  roadmapCount: 2,
  openPapers: [
    { id: "p1", purpose: "skill", subject: "Node.js", interviewType: null, roadmapId: null, status: "ready", totalMarks: 40, questionCount: 10, minutes: 25, percent: null, passed: null, pendingReview: false, createdAt: daysAgo(1), gradedAt: null },
  ],
  lastGraded: { id: "p2", purpose: "skill", subject: "React", interviewType: null, roadmapId: null, status: "graded", totalMarks: 40, questionCount: 10, minutes: 25, percent: 84, passed: true, pendingReview: false, createdAt: daysAgo(3), gradedAt: daysAgo(3) },
  codingSkills: 9,
  codingAnalyzedAt: "10 Nov",
  applications: 4,
  saved: 6,
};

// ── Industry ────────────────────────────────────────────────────

const OPENINGS: CompanyDashboard["openings"] = [
  { id: "o1", role: "Java Backend Developer", type: "Full-time", location: "Pune", salary: "₹8–12 LPA", experience: "0–2 years", requiredSkills: ["Java", "Spring Boot", "SQL", "REST APIs"], niceToHave: ["Docker"], description: "", status: "open", postedAt: daysAgo(3), applicants: 14 },
  { id: "o2", role: "Frontend Developer Intern", type: "Internship", location: "Remote", salary: "₹30k/month", experience: "Students", requiredSkills: ["React", "JavaScript", "CSS3"], niceToHave: ["TypeScript"], description: "", status: "open", postedAt: daysAgo(6), applicants: 22 },
  { id: "o3", role: "Data Engineer", type: "Full-time", location: "Hyderabad", salary: "₹10–14 LPA", experience: "1–3 years", requiredSkills: ["Python", "SQL", "Spark"], niceToHave: ["Airflow"], description: "", status: "open", postedAt: daysAgo(9), applicants: 9 },
];

export const TOUR_COMPANY_DASHBOARD: CompanyDashboard = {
  company: { userId: "tour-company", name: "Nimbus Technologies", industry: "Technology", location: "Pune, India" },
  kpis: { openings: 3, applicants: 45, shortlisted: 12, offers: 3, programs: 2, collaborations: 2, facultyInterest: 7 },
  pipeline: [
    { status: "Applied", count: 21 },
    { status: "In review", count: 9 },
    { status: "Shortlisted", count: 7 },
    { status: "Interview", count: 5 },
    { status: "Offer", count: 3 },
  ],
  openings: OPENINGS,
  recentApplicants: [
    { id: "a1", name: "Priya Iyer", role: "Frontend Developer Intern", status: "Shortlisted", appliedAt: daysAgo(1), score: 88 },
    { id: "a2", name: "Rohit Verma", role: "Java Backend Developer", status: "Interview", appliedAt: daysAgo(2), score: 81 },
    { id: "a3", name: "Sneha Kulkarni", role: "Data Engineer", status: "Applied", appliedAt: daysAgo(2), score: 72 },
    { id: "a4", name: "Karthik Reddy", role: "Java Backend Developer", status: "In review", appliedAt: daysAgo(4), score: 67 },
  ],
  topDemand: [
    { skill: "SQL", openings: 2 },
    { skill: "Java", openings: 1 },
    { skill: "React", openings: 1 },
    { skill: "Python", openings: 1 },
  ],
};

// ── Academia ────────────────────────────────────────────────────

export const TOUR_FACULTY_DASHBOARD: FacultyDashboardData = {
  faculty: { userId: "tour-faculty", name: "Dr. Meera Nair", department: "Computer Science", institution: "Sample Institute of Technology", designation: "Associate Professor" },
  kpis: { departmentStudents: 120, activeLearners: 86, avgReadiness: 61, verifiedSkills: 342, collaborationsCount: 6, myInterestsCount: 2 },
  departmentSkills: [
    { skill: "JavaScript", verifiedCount: 64, coverage: 53 },
    { skill: "Python", verifiedCount: 58, coverage: 48 },
    { skill: "SQL", verifiedCount: 51, coverage: 42 },
    { skill: "React", verifiedCount: 33, coverage: 28 },
  ],
  marketDemand: [
    { skill: "SQL", openings: 18 },
    { skill: "React", openings: 14 },
    { skill: "Java", openings: 12 },
    { skill: "Docker", openings: 9 },
  ],
  recentStudentActivity: [
    { studentId: "s1", name: "Ananya Rao", targetRole: "Data Analyst", readiness: 79, verifiedSkills: 6 },
    { studentId: "s2", name: "Vikram Singh", targetRole: "Backend Developer", readiness: 66, verifiedSkills: 4 },
    { studentId: "s3", name: "Ishita Gupta", targetRole: "Frontend Developer", readiness: 58, verifiedSkills: 3 },
  ],
  latestReview: null,
};

const collab = (id: string, title: string, type: string, company: string, domain: string[], days: number, location: string, seats: number, interested: number, description: string, mine = false): CollaborationView => ({
  id, title, type, company, companyId: "", domain, duration: type === "FDP" ? "5 days" : "4 weeks", startsAt: daysAhead(days), location, seats, description,
  status: "open", interested, accepted: Math.floor(interested / 3), mine, myStatus: mine ? "Interested" : null,
});

export const TOUR_COLLABORATIONS: CollaborationView[] = [
  collab("c1", "FDP: Cloud-Native Architecture for Educators", "FDP", "Nimbus Technologies", ["Cloud", "Microservices"], 18, "Pune campus", 30, 9, "Hands-on faculty development on containers, CI/CD and cloud design, with reusable course material."),
  collab("c2", "Faculty Industrial Immersion", "Faculty Internship", "Orbit Analytics", ["Data Engineering"], 40, "Bengaluru", 8, 4, "Spend four weeks with a live data team to align your syllabus with practice.", true),
  collab("c3", "Guest Lecture: Shipping Software at Scale", "Guest Lecture", "Nimbus Technologies", ["Software Engineering"], 7, "Hybrid", 200, 15, "Senior engineers on code review, release management and observability."),
  collab("c4", "Joint Research: LLMs for Code Review", "Research", "Orbit Analytics", ["AI/ML"], 30, "Remote", 4, 3, "Co-authored research with a funded scholar stipend."),
];

// ── Institution ─────────────────────────────────────────────────

export const TOUR_INSTITUTION_DASHBOARD: InstitutionDashboard = {
  institution: "Sample Institute of Technology",
  kpis: { students: 240, withGoals: 198, avgReadiness: 63, modulesPassed: 712, verifiedSkills: 905, applications: 312, internshipApplications: 141, offers: 38, placementRate: 15, faculty: 22, facultyEngaged: 9, programApplications: 64 },
  readinessBuckets: [
    { label: "0–39%", count: 31 },
    { label: "40–59%", count: 74 },
    { label: "60–79%", count: 96 },
    { label: "80–100%", count: 39 },
  ],
  applicationsByStatus: [
    { status: "Applied", count: 142 },
    { status: "In review", count: 61 },
    { status: "Shortlisted", count: 39 },
    { status: "Interview", count: 32 },
    { status: "Offer", count: 38 },
  ],
  placementStages: [
    { stage: "Placed", count: 36 },
    { stage: "In process", count: 58 },
    { stage: "Applied", count: 79 },
    { stage: "Not applied", count: 67 },
  ],
  topRecruiters: [
    { company: "Nimbus Technologies", applications: 64, offers: 11 },
    { company: "Orbit Analytics", applications: 51, offers: 8 },
    { company: "Kestrel Systems", applications: 38, offers: 6 },
  ],
  targetRoles: [
    { role: "Full Stack Developer", count: 54 },
    { role: "Data Analyst", count: 41 },
    { role: "Backend Developer", count: 37 },
    { role: "Frontend Developer", count: 33 },
  ],
  skillGaps: [
    { skill: "Docker", demand: 9, coverage: 14, gap: 86 },
    { skill: "SQL", demand: 18, coverage: 39, gap: 61 },
    { skill: "React", demand: 14, coverage: 31, gap: 69 },
    { skill: "Java", demand: 12, coverage: 44, gap: 56 },
  ],
  demandTrends: [
    { skill: "SQL", openings: 18 },
    { skill: "React", openings: 14 },
    { skill: "Java", openings: 12 },
    { skill: "Docker", openings: 9 },
  ],
  collaborations: TOUR_COLLABORATIONS.slice(0, 3).map((c) => ({ title: c.title, company: c.company, type: c.type, startsAt: c.startsAt, interested: c.interested, ourFaculty: Math.min(3, c.interested) })),
  students: [
    { id: "s1", name: "Ananya Rao", targetRole: "Data Analyst", readiness: 79, verifiedSkills: 6, modulesPassed: 5, applications: 4, bestStatus: "Offer" },
    { id: "s2", name: "Vikram Singh", targetRole: "Backend Developer", readiness: 66, verifiedSkills: 4, modulesPassed: 3, applications: 3, bestStatus: "Interview" },
    { id: "s3", name: "Ishita Gupta", targetRole: "Frontend Developer", readiness: 58, verifiedSkills: 3, modulesPassed: 2, applications: 2, bestStatus: "Applied" },
    { id: "s4", name: "Rahul Mehta", targetRole: "Full Stack Developer", readiness: 41, verifiedSkills: 1, modulesPassed: 1, applications: 0, bestStatus: "—" },
  ],
  latestInsights: null,
};
