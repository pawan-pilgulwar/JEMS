/**
 * Presentation seed: a realistic, fully connected JEMS dataset.
 *
 *   npm run seed-demo          (wipes the configured database, rebuilds indexes, seeds)
 *
 * Creates 3 institutions, 8 companies, 11 faculty and 28 students, then every
 * record that connects them: skills (verified ones derived from the roadmap
 * modules each student passed), goals, roadmap progress, AI roadmaps and
 * learning paths, resumes, skill tests, mock interviews, openings,
 * applications (with the resume sent), saved jobs, programs and enrolments,
 * collaborations and faculty interest, notifications and activity.
 *
 * Every account's password is Demo@123. A summary of all users is written to
 * demo-users.json in the project root.
 *
 * People are fictional. Companies and institutions are real Indian
 * organisations used as demo context; all their openings, programs and
 * contact details here are illustrative, and every email uses the
 * non-routable `.jems.demo` domain so nothing can reach a real inbox.
 */

import { execFileSync } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { roadmaps } from "../lib/roadmap/data.ts";

const require = createRequire(import.meta.url);
const { MongoClient, ObjectId } = require("mongodb");
const { ensureSrvDns } = require("../lib/db/dns-fallback.cjs");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "jems_production";
const PASSWORD = "Demo@123";
const RESET = process.argv.includes("--reset");

if (!URI) {
  console.error("✗ MONGODB_URI is not set (run through npm so .env is loaded).");
  process.exit(1);
}

// ── Helpers ─────────────────────────────────────────────────────

const now = new Date();
const daysAgo = (n) => new Date(now.getTime() - n * 86_400_000);
const daysAhead = (n) => new Date(now.getTime() + n * 86_400_000);
const hash = (pw) => {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${scryptSync(pw, salt, 64).toString("hex")}`;
};
const PASSWORD_HASH = hash(PASSWORD); // one hash per run is fine: every demo account shares the password
const skillKey = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
const topicKey = (step, topic) => `${skillKey(step)}::${skillKey(topic)}`;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");

// Deterministic randomness so a re-seed produces the same story.
let seed = 20261113;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));

const modulesOf = (path) => roadmaps[path].phases.flatMap((p) => p.modules);
const avatar = (name) => `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=1e3a5f,ea580c,0f766e,7c3aed`;

// ── Reference data ──────────────────────────────────────────────

const INSTITUTIONS = [
  { key: "pes", name: "PES University", type: "University", location: "Bengaluru, Karnataka", established: "1972", accreditation: "NAAC A", website: "https://pes.edu", departments: ["Computer Science & Engineering", "Electronics & Communication", "Information Science", "Mechanical Engineering"], about: "A private university in Bengaluru known for engineering, with strong industry ties across the city's technology sector." },
  { key: "vit", name: "Vellore Institute of Technology", type: "Deemed University", location: "Vellore, Tamil Nadu", established: "1984", accreditation: "NAAC A++", website: "https://vit.ac.in", departments: ["Computer Science & Engineering", "Information Technology", "Electrical & Electronics", "Data Science"], about: "A deemed university with large engineering programmes and one of the busiest campus placement seasons in India." },
  { key: "coep", name: "COEP Technological University", type: "University", location: "Pune, Maharashtra", established: "1854", accreditation: "NAAC A+", website: "https://www.coep.org.in", departments: ["Computer Engineering", "Information Technology", "Electronics & Telecommunication", "Instrumentation"], about: "One of India's oldest engineering institutions, now a technological university with a strong research culture." },
];

const COMPANIES = [
  { key: "tcs", name: "Tata Consultancy Services", industry: "IT Services & Consulting", size: "1000+", founded: "1968", location: "Mumbai, Maharashtra", website: "https://www.tcs.com", hiringFor: ["Software Engineer Trainee", "Java Developer", "Cloud Engineer"], about: "Global IT services, consulting and business solutions company and one of India's largest recruiters of engineering graduates." },
  { key: "infosys", name: "Infosys", industry: "IT Services & Consulting", size: "1000+", founded: "1981", location: "Bengaluru, Karnataka", website: "https://www.infosys.com", hiringFor: ["Systems Engineer", "Data Engineer", "Full Stack Developer"], about: "Digital services and consulting company helping enterprises navigate their digital transformation." },
  { key: "wipro", name: "Wipro", industry: "IT Services & Consulting", size: "1000+", founded: "1945", location: "Bengaluru, Karnataka", website: "https://www.wipro.com", hiringFor: ["Project Engineer", "DevOps Engineer", "QA Engineer"], about: "Technology services and consulting company focused on cloud, AI and engineering services." },
  { key: "zoho", name: "Zoho", industry: "SaaS Products", size: "1000+", founded: "1996", location: "Chennai, Tamil Nadu", website: "https://www.zoho.com", hiringFor: ["Member Technical Staff", "Frontend Developer", "Mobile Developer"], about: "Maker of 55+ business applications used worldwide, built largely in India with a strong in-house engineering culture." },
  { key: "flipkart", name: "Flipkart", industry: "E-commerce", size: "1000+", founded: "2007", location: "Bengaluru, Karnataka", website: "https://www.flipkartcareers.com", hiringFor: ["Software Development Engineer", "Data Scientist", "UI Engineer"], about: "India's homegrown e-commerce marketplace, engineering for scale across supply chain, payments and commerce." },
  { key: "razorpay", name: "Razorpay", industry: "Fintech", size: "1000+", founded: "2014", location: "Bengaluru, Karnataka", website: "https://razorpay.com", hiringFor: ["Backend Engineer", "Frontend Engineer", "Security Engineer"], about: "Full-stack financial solutions company powering payments and banking for businesses across India." },
  { key: "freshworks", name: "Freshworks", industry: "SaaS Products", size: "1000+", founded: "2010", location: "Chennai, Tamil Nadu", website: "https://www.freshworks.com", hiringFor: ["Software Engineer", "QA Automation Engineer", "Product Designer"], about: "SaaS company building customer and employee experience software for businesses of all sizes." },
  { key: "swiggy", name: "Swiggy", industry: "Food & Quick Commerce", size: "1000+", founded: "2014", location: "Bengaluru, Karnataka", website: "https://careers.swiggy.com", hiringFor: ["SDE I", "Data Analyst", "Android Engineer"], about: "On-demand convenience platform for food delivery, groceries and quick commerce across Indian cities." },
];

// role, type, location, salary, experience, required, nice-to-have, description, daysAgo
const OPENINGS = {
  tcs: [
    ["Software Engineer Trainee", "Full-time", "Pune", "₹3.6–7 LPA", "Freshers", ["Java", "SQL", "Git", "Data Structures"], ["Spring Boot"], "Graduate entry role across enterprise delivery projects, with structured training before deployment.", 3],
    ["Java Backend Developer", "Full-time", "Chennai", "₹6–9 LPA", "0–2 years", ["Java", "Spring Boot", "SQL", "REST APIs"], ["Docker", "Microservices"], "Build and maintain Spring Boot services for banking and insurance clients.", 6],
    ["Cloud Engineer Intern", "Internship", "Remote", "₹25k/month", "Students", ["AWS", "Linux", "Docker"], ["Terraform"], "Six-month internship supporting cloud migrations, with a pre-placement offer for top performers.", 9],
  ],
  infosys: [
    ["Systems Engineer", "Full-time", "Mysuru", "₹3.6–6.5 LPA", "Freshers", ["Java", "SQL", "Git"], ["Python"], "Entry role with training at the Mysuru campus followed by project allocation.", 2],
    ["Data Engineer", "Full-time", "Bengaluru", "₹8–12 LPA", "1–3 years", ["SQL", "Python", "Pandas", "ETL"], ["Apache Spark", "Apache Airflow"], "Design batch pipelines and data models for analytics teams.", 5],
    ["Full Stack Developer", "Full-time", "Hyderabad", "₹7–11 LPA", "0–2 years", ["React", "Node.js", "JavaScript", "MongoDB"], ["TypeScript"], "Deliver features end to end on client web platforms.", 10],
  ],
  wipro: [
    ["Project Engineer", "Full-time", "Bengaluru", "₹3.5–6.5 LPA", "Freshers", ["Java", "SQL", "Linux"], ["Git"], "Graduate role across application development and support projects.", 4],
    ["DevOps Engineer", "Full-time", "Pune", "₹7–12 LPA", "1–3 years", ["Docker", "Kubernetes", "CI/CD", "Linux"], ["Terraform", "AWS"], "Own CI/CD pipelines and container platforms for enterprise clients.", 7],
    ["QA Automation Intern", "Internship", "Remote", "₹20k/month", "Students", ["Selenium", "JavaScript", "API Testing"], ["Playwright"], "Automate regression suites for web products.", 12],
  ],
  zoho: [
    ["Member Technical Staff", "Full-time", "Chennai", "₹6–10 LPA", "Freshers", ["JavaScript", "Data Structures", "SQL"], ["Java"], "Product engineering role building Zoho's suite of business apps.", 1],
    ["Frontend Developer", "Full-time", "Chennai", "₹7–12 LPA", "0–2 years", ["JavaScript", "HTML5", "CSS3", "React"], ["TypeScript", "Accessibility"], "Craft fast, accessible interfaces used by millions of businesses.", 8],
    ["Mobile Developer Intern", "Internship", "Chennai", "₹30k/month", "Students", ["React Native", "JavaScript", "REST APIs"], ["Kotlin"], "Build features for Zoho's mobile apps alongside product teams.", 11],
  ],
  flipkart: [
    ["Software Development Engineer I", "Full-time", "Bengaluru", "₹18–26 LPA", "0–2 years", ["Java", "Data Structures", "System Design", "SQL"], ["Microservices"], "Build high-scale services for commerce and supply chain.", 2],
    ["Data Scientist Intern", "Internship", "Bengaluru", "₹50k/month", "Students", ["Python", "Pandas", "Statistics", "Scikit-learn"], ["TensorFlow"], "Work on recommendation and forecasting models with the data science team.", 6],
    ["UI Engineer", "Full-time", "Bengaluru", "₹14–20 LPA", "1–3 years", ["React", "JavaScript", "CSS3", "TypeScript"], ["Next.js"], "Own customer-facing web experiences on Flipkart.com.", 13],
  ],
  razorpay: [
    ["Backend Engineer", "Full-time", "Bengaluru", "₹16–24 LPA", "1–3 years", ["Node.js", "Express.js", "PostgreSQL", "REST APIs"], ["Redis", "Docker"], "Build reliable payment APIs used by lakhs of businesses.", 3],
    ["Frontend Engineer Intern", "Internship", "Bengaluru", "₹40k/month", "Students", ["React", "JavaScript", "HTML5"], ["TypeScript"], "Ship dashboard features for merchants.", 5],
    ["Security Engineer", "Full-time", "Bengaluru", "₹15–22 LPA", "1–3 years", ["Web Security", "Linux", "Networking"], ["Penetration Testing", "OWASP"], "Find and fix vulnerabilities across payment infrastructure.", 15],
  ],
  freshworks: [
    ["Software Engineer", "Full-time", "Chennai", "₹10–16 LPA", "0–2 years", ["Java", "Spring Boot", "SQL", "REST APIs"], ["AWS"], "Build features for Freshdesk and Freshservice.", 4],
    ["QA Automation Engineer", "Full-time", "Chennai", "₹7–11 LPA", "0–2 years", ["Playwright", "API Testing", "JavaScript"], ["CI/CD"], "Build and maintain end-to-end test automation.", 9],
    ["Product Designer Intern", "Internship", "Remote", "₹35k/month", "Students", ["Figma", "Wireframing", "Prototyping"], ["User Research"], "Design flows for SaaS products with senior designers.", 14],
  ],
  swiggy: [
    ["SDE I — Backend", "Full-time", "Bengaluru", "₹17–25 LPA", "0–2 years", ["Java", "Microservices", "SQL", "System Design"], ["Kafka"], "Scale order and delivery systems for millions of daily orders.", 1],
    ["Data Analyst", "Full-time", "Bengaluru", "₹8–12 LPA", "0–2 years", ["SQL", "Python", "Statistics"], ["Tableau"], "Turn ops and growth data into decisions.", 6],
    ["Android Engineer Intern", "Internship", "Bengaluru", "₹45k/month", "Students", ["Kotlin", "Android", "REST APIs"], ["React Native"], "Build features for the Swiggy consumer app.", 10],
  ],
};

// title, type, skills, duration, mode, seats, startsInDays
const PROGRAMS = {
  tcs: [["TCS iON Career Edge: Java Foundations", "Certification", ["Java", "SQL", "Git"], "4 weeks", "Self-paced", 200, 6]],
  infosys: [["Infosys Springboard: Python for Data", "Certification", ["Python", "Pandas", "SQL"], "5 weeks", "Self-paced", 300, 4]],
  wipro: [["DevOps Bootcamp with Wipro", "Training", ["Docker", "Kubernetes", "CI/CD"], "6 weeks", "Online · live", 60, 12]],
  zoho: [["Zoho Schools Workshop: Building Web Apps", "Workshop", ["JavaScript", "HTML5", "CSS3"], "2 days", "On campus", 40, 18]],
  flipkart: [["Flipkart GRiD Mentorship Circle", "Mentorship", ["Data Structures", "System Design"], "8 weeks", "1:1 online", 20, 9]],
  razorpay: [["Payments Engineering Deep-dive", "Training", ["Node.js", "REST APIs", "Security"], "3 weeks", "Online · live", 50, 15]],
  freshworks: [["Test Automation with Playwright", "Workshop", ["Playwright", "API Testing", "JavaScript"], "1 day", "Online · live", 80, 7]],
  swiggy: [["Swiggy Android Bootcamp", "Training", ["Kotlin", "Android"], "4 weeks", "Hybrid", 30, 20]],
};

// title, type, domain, duration, location, seats, startsInDays, description
const COLLABS = {
  tcs: [["FDP: Cloud-Native Architecture for Educators", "FDP", ["Cloud Computing", "Microservices"], "5 days", "Pune / Hybrid", 30, 18, "Hands-on faculty development on containers, CI/CD and cloud design, with course material faculty can reuse."]],
  infosys: [["Joint Research: LLMs for Code Review", "Research", ["AI/ML", "Software Engineering"], "12 months", "Remote", 4, 30, "Co-authored research with a funded scholar stipend and access to anonymised code-review data."]],
  wipro: [["Faculty Industrial Immersion (Summer)", "Faculty Internship", ["DevOps", "Agile Delivery"], "4 weeks", "Bengaluru", 10, 45, "Faculty embed with a live delivery team to align teaching with current engineering practice."]],
  zoho: [["Guest Lecture: Building Products in India", "Guest Lecture", ["Product Engineering"], "2 hours", "On campus", 200, 8, "Zoho engineers on building global SaaS products from India."]],
  flipkart: [["Live Project: Search Relevance Lab", "Live Project", ["Data Science", "Information Retrieval"], "8 weeks", "Remote", 25, 20, "Faculty-mentored student teams improve ranking on an anonymised catalogue."]],
  razorpay: [["Curriculum Consultancy: Secure Payments", "Consultancy", ["Security", "Fintech"], "3 months", "Remote", 6, 25, "Faculty consult on an elective covering payment security; honorarium provided."]],
  freshworks: [["Industrial Training: Quality Engineering", "Industrial Training", ["QA", "Automation"], "2 weeks", "Chennai", 15, 40, "Training for faculty and final-year students on modern test automation."]],
  swiggy: [["Innovation Challenge: Hyperlocal Logistics", "Innovation Challenge", ["Data", "Optimisation"], "48 hours", "Hybrid", 300, 35, "Faculty-mentored teams build routing and demand-forecasting prototypes; winners get internship offers."]],
};

// name, institution key | null, department, designation, interests, experience
const FACULTY = [
  ["Dr. Kavita Raghunathan", "pes", "Computer Science & Engineering", "Professor & Head", ["Distributed Systems", "Cloud Computing"], "21"],
  ["Prof. Srinivas Murthy", "pes", "Information Science", "Associate Professor", ["Databases", "Data Engineering"], "14"],
  ["Dr. Nandini Hegde", "pes", "Computer Science & Engineering", "Assistant Professor", ["Machine Learning", "NLP"], "8"],
  ["Dr. Arvind Subramanian", "vit", "Computer Science & Engineering", "Professor", ["Software Engineering", "DevOps"], "19"],
  ["Prof. Lakshmi Narayanan", "vit", "Information Technology", "Associate Professor", ["Web Technologies", "Human-Computer Interaction"], "12"],
  ["Dr. Farhan Siddiqui", "vit", "Data Science", "Assistant Professor", ["Data Science", "Statistics"], "7"],
  ["Dr. Meenal Kulkarni", "coep", "Computer Engineering", "Professor", ["Cyber Security", "Networks"], "18"],
  ["Prof. Rohan Deshpande", "coep", "Information Technology", "Associate Professor", ["Mobile Computing", "IoT"], "11"],
  ["Dr. Snehal Joshi", "coep", "Computer Engineering", "Assistant Professor", ["Quality Engineering", "Testing"], "6"],
  ["Dr. Harish Venkatesan", null, "Computer Applications", "Visiting Faculty", ["Full Stack Development", "Cloud"], "15"],
  ["Prof. Ayesha Khan", null, "Data Analytics", "Industry Trainer", ["Data Analytics", "Python"], "9"],
];

// name, inst key | null, city, path, modules passed, readiness, github org, extra claimed skills, year, cgpa
const STUDENTS = [
  ["Aarav Sharma", "pes", "Bengaluru", "fullstack", 5, 74, "facebook", ["Docker", "Git"], "Final year", "8.6"],
  ["Diya Menon", "pes", "Bengaluru", "frontend", 6, 82, "vercel", ["Figma"], "Final year", "9.1"],
  ["Rohit Kulkarni", "pes", "Mysuru", "backend", 4, 66, "nodejs", ["Docker"], "Final year", "7.9"],
  ["Ananya Bhat", "pes", "Bengaluru", "data-engineer", 3, 61, "apache", ["Excel"], "Pre-final year", "8.3"],
  ["Karthik Gowda", "pes", "Bengaluru", "devops", 4, 69, "docker", ["Python"], "Final year", "7.6"],
  ["Sneha Rao", "pes", "Mangaluru", "ai-ml", 3, 58, "pytorch", ["SQL"], "Pre-final year", "8.8"],
  ["Nikhil Shetty", "pes", "Udupi", "qa", 4, 63, "microsoft", ["Postman"], "Final year", "7.4"],
  ["Pooja Nayak", "pes", "Bengaluru", "fullstack", 2, 44, "expressjs", ["Bootstrap"], "Second year", "8.0"],
  ["Arjun Reddy", "vit", "Hyderabad", "backend", 6, 85, "spring-projects", ["Java", "Spring Boot", "SQL", "Data Structures"], "Final year", "9.0"],
  ["Ishita Agarwal", "vit", "Jaipur", "ai-ml", 5, 77, "tensorflow", ["SQL"], "Final year", "9.3"],
  ["Rahul Iyer", "vit", "Chennai", "frontend", 4, 64, "angular", ["Bootstrap"], "Pre-final year", "8.1"],
  ["Meghana Pillai", "vit", "Kochi", "mobile-dev", 4, 67, "flutter", ["Kotlin", "Android"], "Final year", "8.4"],
  ["Siddharth Jain", "vit", "Indore", "cloud-architect", 3, 62, "hashicorp", ["Linux"], "Final year", "7.8"],
  ["Tanvi Chopra", "vit", "Delhi", "ui-ux", 4, 70, "tailwindlabs", ["HTML5", "CSS3"], "Final year", "8.7"],
  ["Mohammed Faizan", "vit", "Vellore", "data-engineer", 5, 72, "elastic", ["Statistics"], "Final year", "8.2"],
  ["Lavanya Krishnan", "vit", "Coimbatore", "fullstack", 3, 55, "mongodb", ["Java"], "Pre-final year", "8.5"],
  ["Omkar Patil", "coep", "Pune", "cybersecurity", 4, 68, "golang", ["Python"], "Final year", "8.0"],
  ["Shruti Deshmukh", "coep", "Pune", "data-engineer", 4, 66, "pallets", ["Statistics"], "Final year", "8.9"],
  ["Aditya Joshi", "coep", "Nashik", "backend", 5, 76, "redis", ["Java", "Data Structures"], "Final year", "8.3"],
  ["Gauri Pawar", "coep", "Pune", "qa", 3, 57, "grafana", ["SQL"], "Pre-final year", "7.7"],
  ["Yash Bhosale", "coep", "Kolhapur", "devops", 5, 73, "kubernetes", ["Python"], "Final year", "7.9"],
  ["Rutuja Gaikwad", "coep", "Pune", "frontend", 3, 52, "vuejs", ["Figma"], "Second year", "8.6"],
  ["Pranav Mishra", null, "Lucknow", "fullstack", 4, 65, "prisma", ["Python"], "Graduate", "7.5"],
  ["Riya Banerjee", null, "Kolkata", "ai-ml", 4, 71, "google", ["SQL", "Statistics"], "Graduate", "8.7"],
  ["Harsh Vardhan", null, "Patna", "backend", 3, 54, "rust-lang", ["Java"], "Graduate", "7.2"],
  ["Neha Kapoor", null, "Chandigarh", "ui-ux", 3, 59, "supabase", ["HTML5"], "Graduate", "8.0"],
  ["Vivek Nair", null, "Thiruvananthapuram", "mobile-dev", 2, 46, "nestjs", ["Java"], "Graduate", "7.1"],
  ["Sanya Malhotra", null, "Gurugram", "data-engineer", 2, 48, "django", ["Excel"], "Graduate", "7.8"],
];

const STATUS_FLOW = ["Applied", "In review", "Shortlisted", "Interview", "Offer", "Rejected"];

// ── Seed ────────────────────────────────────────────────────────

async function main() {
  await ensureSrvDns(URI);
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB_NAME);
  console.log(`✓ Connected · database "${DB_NAME}"`);

  if (RESET) {
    // Empty every collection (Atlas app users usually can't dropDatabase; this keeps indexes too).
    const existing = await db.listCollections({}, { nameOnly: true }).toArray();
    let removed = 0;
    for (const { name } of existing) {
      if (name.startsWith("system.")) continue;
      removed += (await db.collection(name).deleteMany({})).deletedCount;
    }
    console.log(`✓ Deleted ${removed} documents from ${existing.length} collections`);
    // Collections + indexes (unique keys) before any data goes in.
    execFileSync(process.execPath, [join(ROOT, "scripts", "setupDatabase.js")], { stdio: "inherit", env: process.env });
  } else if ((await db.collection("users").estimatedDocumentCount()) > 0) {
    console.error("✗ The database already has users. Run with --reset (npm run seed-demo) to wipe and reseed.");
    process.exit(1);
  }

  const summary = [];
  const userDoc = (name, email, role, createdDaysAgo) => ({
    name, email, role, authProvider: "credentials", passwordHash: PASSWORD_HASH,
    phone: null, image: null, emailVerified: daysAgo(createdDaysAgo), demo: true,
    createdAt: daysAgo(createdDaysAgo), updatedAt: now,
  });

  // ── Institutions ──
  const inst = {};
  for (const i of INSTITUTIONS) {
    const email = `placements@${i.key}.jems.demo`;
    const { insertedId } = await db.collection("users").insertOne(userDoc(i.name, email, "institution", 120));
    await db.collection("institutionProfiles").insertOne({
      userId: insertedId, institutionName: i.name, type: i.type, location: i.location, website: i.website,
      about: i.about, departments: i.departments, accreditation: i.accreditation, established: i.established,
      contactEmail: email, phone: "", createdAt: daysAgo(120), updatedAt: now,
    });
    inst[i.key] = { id: insertedId, name: i.name };
    summary.push({ role: "institution", name: i.name, email, location: i.location, type: i.type });
  }
  console.log(`✓ ${INSTITUTIONS.length} institutions`);

  // ── Companies, openings, programs, collaborations ──
  const company = {};
  const jobs = [];
  const programs = [];
  const collabs = [];
  for (const c of COMPANIES) {
    const email = `campus.hiring@${c.key}.jems.demo`;
    const { insertedId: companyId } = await db.collection("users").insertOne(userDoc(c.name, email, "company", 100));
    await db.collection("companyProfiles").insertOne({
      userId: companyId, companyName: c.name, industry: c.industry, size: c.size, founded: c.founded,
      website: c.website, location: c.location, about: c.about, linkedin: "", contactEmail: email,
      hiringFor: c.hiringFor, createdAt: daysAgo(100), updatedAt: now,
    });
    company[c.key] = { id: companyId, name: c.name };
    summary.push({ role: "company", name: c.name, email, industry: c.industry, location: c.location });

    for (const [role, type, location, salary, experience, requiredSkills, niceToHave, description, posted] of OPENINGS[c.key]) {
      const doc = {
        companyId, company: c.name, role, type, location, salary, experience, requiredSkills, niceToHave, description,
        remote: /remote/i.test(location), status: "open", postedAt: daysAgo(posted), createdAt: daysAgo(posted),
      };
      const { insertedId } = await db.collection("jobPostings").insertOne(doc);
      jobs.push({ ...doc, _id: insertedId, companyKey: c.key });
    }
    for (const [title, type, skills, duration, mode, seats, starts] of PROGRAMS[c.key]) {
      const doc = { companyId, company: c.name, title, type, skills, duration, mode, seats, startsAt: daysAhead(starts), status: "open", createdAt: daysAgo(20) };
      const { insertedId } = await db.collection("industryPrograms").insertOne(doc);
      programs.push({ ...doc, _id: insertedId });
    }
    for (const [title, type, domain, duration, location, seats, starts, description] of COLLABS[c.key]) {
      const doc = { companyId, company: c.name, title, type, domain, duration, location, seats, description, startsAt: daysAhead(starts), status: "open", createdAt: daysAgo(25) };
      const { insertedId } = await db.collection("collaborations").insertOne(doc);
      collabs.push({ ...doc, _id: insertedId });
    }
  }
  console.log(`✓ ${COMPANIES.length} companies · ${jobs.length} openings · ${programs.length} programs · ${collabs.length} collaborations`);

  // ── Faculty + collaboration interest ──
  const notifications = [];
  let facultyCount = 0;
  for (const [name, instKey, department, designation, interests, experienceYears] of FACULTY) {
    const first = name.replace(/^(Dr\.|Prof\.)\s+/, "");
    const email = `${slug(first)}@${instKey ?? "faculty"}.jems.demo`;
    const { insertedId: fid } = await db.collection("users").insertOne(userDoc(name, email, "faculty", 90));
    const i = instKey ? inst[instKey] : null;
    await db.collection("facultyProfiles").insertOne({
      userId: fid, ...(i ? { institution: i.name, institutionId: i.id } : { institution: "" }),
      department, designation, interests, experienceYears, qualifications: designation.includes("Professor") ? "Ph.D., M.Tech" : "M.Tech",
      bio: `${designation} in ${department} with ${experienceYears} years of teaching and industry engagement in ${interests.join(" and ")}.`,
      linkedin: "", scholar: "", phone: "", createdAt: daysAgo(90), updatedAt: now,
    });
    summary.push({ role: "faculty", name, email, institution: i?.name ?? null, department, designation });
    facultyCount++;

    // Each faculty member is interested in 1–3 collaborations that fit their interests (falling back to any).
    const fits = collabs.filter((c) => c.domain.some((d) => interests.some((x) => d.toLowerCase().includes(x.split(" ")[0].toLowerCase()) || x.toLowerCase().includes(d.split(" ")[0].toLowerCase()))));
    const chosen = [...new Set([...fits, pick(collabs)])].slice(0, between(1, 3));
    for (const c of chosen) {
      const status = pick(["Interested", "Interested", "Accepted", "Declined", "Accepted"]);
      const at = daysAgo(between(2, 15));
      await db.collection("collaborationInterests").insertOne({ userId: fid, collaborationId: c._id, status, createdAt: at, ...(status !== "Interested" ? { updatedAt: daysAgo(1) } : {}) });
      notifications.push({ userId: c.companyId, kind: "application", title: `New interest in ${c.title}`, body: `${name}, ${designation}${i ? ` (${i.name})` : ""} expressed interest in your ${c.type}.`, link: `/company/programs?tab=collaborations&item=${c._id}`, read: status !== "Interested", createdAt: at });
      if (status !== "Interested") {
        notifications.push({ userId: fid, kind: "info", title: `${c.title}: ${status}`, body: `${c.company} marked your interest as "${status}".`, link: "/faculty/collaborations", read: false, createdAt: daysAgo(1) });
      }
    }
  }
  console.log(`✓ ${facultyCount} faculty with collaboration interest`);

  // ── Students and everything about them ──
  let applications = 0, enrollments = 0;
  for (const [idx, [name, instKey, city, path, passedCount, readiness, githubOrg, extraSkills, year, cgpa]] of STUDENTS.entries()) {
    const [firstName, ...rest] = name.split(" ");
    const lastName = rest.join(" ");
    const email = `${slug(name)}@student.jems.demo`;
    const created = between(35, 80);
    const { insertedId: sid } = await db.collection("users").insertOne(userDoc(name, email, "student", created));
    const i = instKey ? inst[instKey] : null;
    const roadmap = roadmaps[path];
    const mods = modulesOf(path);
    const passed = mods.slice(0, Math.min(passedCount, mods.length - 1));
    const passedIds = passed.map((m) => m.id);
    const careerTitle = roadmap.targetRole;

    // Verified = skills of passed roadmap modules (+ a skill test); claimed = the next module's skills + extras.
    const verifiedNames = [...new Set(passed.flatMap((m) => m.skills))];
    const next = mods[passed.length];
    const claimedNames = [...new Set([...next.skills.slice(0, 2), ...extraSkills])].filter((s) => !verifiedNames.some((v) => skillKey(v) === skillKey(s)));
    const testedSkill = verifiedNames[verifiedNames.length - 1];
    const skills = [
      ...verifiedNames.map((n) => ({ name: n, level: between(70, 92), verified: true, source: n === testedSkill ? "skill-test" : "roadmap", ...(n === testedSkill ? { score: between(72, 95), verifiedAt: daysAgo(between(2, 12)) } : { verifiedAt: daysAgo(between(10, 40)) }) })),
      ...claimedNames.map((n) => ({ name: n, level: between(45, 68), verified: false, source: "claimed" })),
    ];

    await db.collection("studentProfiles").insertOne({
      userId: sid, username: slug(name), firstName, lastName, nickname: firstName, displayName: name, displayRole: "Student",
      bio: `${year} student${i ? ` at ${i.name}` : ""} (CGPA ${cgpa}) working towards a ${careerTitle} role. Comfortable with ${verifiedNames.slice(0, 3).join(", ")}; currently learning ${next.title.toLowerCase()}.`,
      location: `${city}, India`, website: "", linkedin: "", github: `https://github.com/${githubOrg}`, phone: "",
      avatar: avatar(name), experienceLevel: year === "Graduate" ? "Entry level" : "Student", targetRole: careerTitle,
      learningStyle: pick(["Hands-on projects", "Video lessons", "Reading & docs"]), yearsOfExperience: year === "Graduate" ? "0–1" : "0",
      ...(i ? { institution: i.name, institutionId: i.id } : { institution: "" }),
      skills,
      goals: { careerPath: path, careerTitle, targetPackage: String(between(6, 18)), targetCompany: pick(COMPANIES).name, setAt: daysAgo(created - 3) },
      softSkills: { communication: between(55, 90), teamwork: between(60, 92), problemSolving: between(55, 90), adaptability: between(55, 88), leadership: between(40, 85) },
      assessment: { questionnaireAt: daysAgo(created - 4) },
      createdAt: daysAgo(created), updatedAt: daysAgo(between(0, 3)),
    });
    summary.push({ role: "student", name, email, institution: i?.name ?? null, city, targetRole: careerTitle, year });

    await db.collection("roadmapProgress").insertOne({ studentId: sid, careerPath: path, passedModules: passedIds, lessonsWatched: {}, createdAt: daysAgo(created - 3), updatedAt: daysAgo(between(0, 4)) });
    await db.collection("skillAssessments").insertOne({ studentId: sid, skill: testedSkill, score: skills.find((s) => s.name === testedSkill).score, passed: true, takenAt: daysAgo(between(2, 12)) });

    // AI roadmap for the next module's main skill, mirrored as a learning path.
    const upcoming = mods.slice(passed.length, passed.length + 3);
    const steps = upcoming.map((m, n) => ({
      skill: m.skills[0], role: n === upcoming.length - 1 ? "target" : "prerequisite", weeks: parseInt(m.duration, 10) || 2,
      summary: `${m.title}: ${m.topics.slice(0, 2).join(" and ").toLowerCase()} and more.`,
      why_learn: `Needed for ${careerTitle} roles.`, topics: m.topics.map((t) => ({ name: t, subtopics: [] })),
      resources: m.resources.map((r) => r.title), project: m.resources.find((r) => r.type === "project")?.title ?? "",
    }));
    const target = upcoming[upcoming.length - 1].skills[0];
    const topicsDone = steps[0] ? steps[0].topics.slice(0, between(1, steps[0].topics.length)).map((t) => topicKey(steps[0].skill, t.name)) : [];
    const totalTopics = steps.reduce((n, s) => n + s.topics.length, 0);
    const { insertedId: roadmapId } = await db.collection("aiRoadmaps").insertOne({
      studentId: sid, skillKey: skillKey(target), skill: target, missingSkills: steps.slice(0, -1).map((s) => s.skill), knownSkills: verifiedNames.slice(0, 4),
      roadmap: { target_skill: target, total_weeks: steps.reduce((n, s) => n + s.weeks, 0), steps }, topicsDone, createdAt: daysAgo(between(8, 20)), updatedAt: daysAgo(between(0, 5)),
    });
    await db.collection("learningPaths").insertMany([
      { studentId: sid, roadmapId, skillKey: skillKey(target), title: target, category: "AI Roadmap", level: steps.length >= 3 ? "Beginner" : "Intermediate", lessons: totalTopics, hours: steps.reduce((n, s) => n + s.weeks, 0) * 10, progress: Math.round((topicsDone.length / (totalTopics + steps.length)) * 100), createdAt: daysAgo(15), updatedAt: daysAgo(1) },
      { studentId: sid, title: roadmap.title ?? careerTitle, category: "Career Track", level: "Intermediate", lessons: mods.length * 4, hours: mods.length * 12, progress: Math.round((passed.length / mods.length) * 100), createdAt: daysAgo(created - 3) },
    ]);

    // Resume (built version) — also what gets sent with applications.
    const resumeData = {
      header: { fullName: name, title: careerTitle, email, phone: "", location: `${city}, India`, portfolio: `github.com/${githubOrg}`, linkedin: "" },
      summary: `${year} engineering student${i ? ` at ${i.name}` : ""} aiming for a ${careerTitle} role. Verified on JEMS in ${verifiedNames.slice(0, 4).join(", ")}, with hands-on projects built through the ${roadmap.title ?? careerTitle} roadmap.`,
      experience: readiness >= 65 ? [{ id: "exp-1", company: pick(["Campus Innovation Cell", "Open-source contributor", "College Tech Club", "Freelance"]), jobTitle: `${careerTitle} (project role)`, start: "2025-06", end: "", current: true, description: `• Built ${passed[passed.length - 1]?.resources.find((r) => r.type === "project")?.title ?? "a portfolio project"}\n• Applied ${verifiedNames.slice(0, 3).join(", ")} in production-like settings` }] : [],
      education: [{ id: "edu-1", school: i?.name ?? `${city} Institute of Engineering`, degree: "B.Tech", field: "Computer Science", gradDate: year === "Graduate" ? "2025-06" : year === "Final year" ? "2026-06" : "2027-06", description: `CGPA ${cgpa}` }],
      skills: [...verifiedNames.slice(0, 8).map((n, k) => ({ id: `s${k}`, name: n, level: "Advanced", verified: true })), ...claimedNames.slice(0, 3).map((n, k) => ({ id: `c${k}`, name: n, level: "Intermediate", verified: false }))],
      certifications: [{ id: "cert-1", name: `${passed[0]?.title ?? careerTitle} — JEMS verified module`, org: "JEMS", issueDate: "2025-11", expDate: "" }],
      projects: passed.flatMap((m) => m.resources.filter((r) => r.type === "project")).slice(0, 2).map((r, k) => ({ id: `p${k}`, name: r.title, description: `Built while completing the ${careerTitle} roadmap.`, tech: verifiedNames.slice(k * 2, k * 2 + 3).join(", "), link: `github.com/${githubOrg}` })),
    };
    const atsScore = between(68, 92);
    await db.collection("resumes").insertOne({ studentId: sid, versions: [{ id: "v1", name: `${careerTitle} resume`, data: resumeData }], atsScore, createdAt: daysAgo(created - 5), updatedAt: daysAgo(between(1, 6)) });

    // Applications: openings whose required skills overlap the student's skills.
    const owned = new Set(skills.map((s) => skillKey(s.name)));
    const ranked = jobs
      .map((j) => ({ j, hits: j.requiredSkills.filter((s) => owned.has(skillKey(s))).length / j.requiredSkills.length }))
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.hits - a.hits);
    const applyCount = readiness >= 60 ? between(2, 4) : between(0, 2);
    const applied = ranked.slice(0, applyCount);
    for (const [k, { j, hits }] of applied.entries()) {
      const statusPool = hits >= 0.75 && readiness >= 70 ? ["Shortlisted", "Interview", "Offer", "In review"] : hits >= 0.5 ? ["Applied", "In review", "Shortlisted", "Interview", "Rejected"] : ["Applied", "Rejected", "In review"];
      const status = pick(statusPool);
      const at = daysAgo(between(1, 18));
      const { insertedId: appId } = await db.collection("jobApplications").insertOne({
        studentId: sid, jobId: j._id, role: j.role, company: j.company, status,
        resume: { type: "built", name: `${careerTitle} resume`, resumeId: "v1", snapshot: resumeData },
        createdAt: at, updatedAt: status === "Applied" ? at : daysAgo(between(0, 3)),
      });
      applications++;
      notifications.push({ userId: j.companyId, kind: "application", title: `New applicant for ${j.role}`, body: `${name} applied with ${careerTitle} resume.`, link: `/company/candidates?job=${j._id}`, read: k > 0, createdAt: at });
      if (status !== "Applied") {
        notifications.push({ userId: sid, kind: "application", title: `${j.role} at ${j.company}: ${status}`, body: `Your application status was updated to "${status}".`, link: "/student/applications", read: false, createdAt: daysAgo(between(0, 3)) });
      }
      if (status === "Interview") {
        await db.collection("activityLogs").insertOne({ userId: sid, text: `Interview scheduled with ${j.company} for ${j.role}`, createdAt: daysAgo(1) });
      }
      void appId;
    }
    // Saved jobs: the next best matches they haven't applied to.
    const saved = ranked.slice(applyCount, applyCount + between(1, 3));
    if (saved.length) await db.collection("savedJobs").insertMany(saved.map(({ j }) => ({ studentId: sid, jobId: j._id, createdAt: daysAgo(between(1, 10)) })));

    // Program applications where the program teaches a skill they lack.
    const gapPrograms = programs.filter((p) => p.skills.some((s) => !owned.has(skillKey(s))) && p.skills.some((s) => owned.has(skillKey(s)) || claimedNames.includes(s)));
    for (const p of gapPrograms.slice(0, idx % 3 === 0 ? 2 : idx % 3 === 1 ? 1 : 0)) {
      const status = pick(["Applied", "Accepted", "Accepted", "Waitlisted", "Completed"]);
      const at = daysAgo(between(2, 14));
      await db.collection("programEnrollments").insertOne({ programId: p._id, studentId: sid, companyId: p.companyId, status, motivation: `I want to strengthen ${p.skills.filter((s) => !owned.has(skillKey(s))).join(", ")} for ${careerTitle} roles.`, createdAt: at, updatedAt: daysAgo(1) });
      enrollments++;
      notifications.push({ userId: p.companyId, kind: "application", title: `New applicant for ${p.title}`, body: `${name} applied to your program.`, link: `/company/programs?program=${p._id}`, read: true, createdAt: at });
      if (status !== "Applied") notifications.push({ userId: sid, kind: "info", title: `${p.title}: ${status}`, body: `${p.company} updated your program application to "${status}".`, link: "/student/programs", read: false, createdAt: daysAgo(1) });
    }

    // Mock interviews, analytics and activity.
    const interviews = between(1, 5);
    await db.collection("mockInterviews").insertMany(Array.from({ length: interviews }, (_, k) => ({ studentId: sid, type: pick(["Technical Coding", "Behavioral", "Role-specific", "System Design"]), score: between(55, 92), createdAt: daysAgo(2 + k * between(3, 6)) })));
    await db.collection("studentAnalytics").insertOne({
      studentId: sid, readiness, lessonsCompleted: passed.length * 4 + topicsDone.length, mockInterviews: interviews, streak: between(0, 9),
      achievements: [...(passed.length >= 3 ? ["Skill Master"] : []), ...(applied.length ? ["First Application"] : []), ...(interviews >= 5 ? ["5 Interviews"] : []), "First Resume"],
      week: ["M", "T", "W", "T", "F", "S", "S"].map((day) => ({ day, v: between(10, 95) })),
      upcoming: [{ title: `Mock interview: ${careerTitle}`, when: pick(["Tomorrow · 5:00 PM", "Fri · 11:00 AM", "Sat · 4:00 PM"]), tag: "Interview" }, { title: `${next.title} — module test`, when: "This week", tag: "Learning" }],
      updatedAt: daysAgo(between(0, 2)),
    });
    await db.collection("activityLogs").insertMany([
      { userId: sid, text: `Verified ${testedSkill} with a skill test`, createdAt: daysAgo(between(2, 12)) },
      { userId: sid, text: `Passed roadmap module: ${passed[passed.length - 1]?.title ?? next.title}`, createdAt: daysAgo(between(3, 20)) },
      ...(applied[0] ? [{ userId: sid, text: `Applied to ${applied[0].j.role} at ${applied[0].j.company}`, createdAt: daysAgo(between(1, 18)) }] : []),
    ]);
  }
  console.log(`✓ ${STUDENTS.length} students · ${applications} applications · ${enrollments} program applications`);

  if (notifications.length) await db.collection("notifications").insertMany(notifications.map((n) => ({ taskId: null, ...n })));
  console.log(`✓ ${notifications.length} notifications`);

  // ── Who's who, for the presenter ──
  const out = {
    generatedAt: now.toISOString(),
    database: DB_NAME,
    password: PASSWORD,
    note: "Demo data. People are fictional; organisations are real but every opening, program and contact here is illustrative. Emails use the non-routable .jems.demo domain.",
    counts: { institutions: INSTITUTIONS.length, companies: COMPANIES.length, faculty: FACULTY.length, students: STUDENTS.length },
    users: summary,
  };
  writeFileSync(join(ROOT, "demo-users.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`✓ Wrote demo-users.json (${summary.length} users) · password for all: ${PASSWORD}`);
  await client.close();
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exit(1);
});
