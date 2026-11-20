# JEMS - Job and Employment Management System

JEMS is an AI-powered career-readiness and placement platform that connects
students, companies, institutions, and faculty in one workspace. It combines
a Next.js web application with AI career analysis and isolated coding
assessments.

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/UI-React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=0A3A50)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![FastAPI](https://img.shields.io/badge/AI%20Service-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Services-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

## Key Features

- **Student career profiles:** Resume management, skills, projects,
  experience, career goals, and portfolio information.
- **Job discovery and applications:** Search opportunities, save jobs,
  apply, and track application status.
- **AI career guidance:** Coding-profile analysis, learning-roadmap
  recommendations, mock interviews, and candidate-match insights.
- **AI assessments:** Generate assessments and evaluate submissions with
  automated test execution.
- **Company dashboard:** Publish jobs and learning programs, manage
  applicants, and review candidate matches.
- **Institution and faculty workflows:** Support placement activity,
  student cohorts, collaboration, and progress review.
- **Secure authentication:** Password-based login, role-aware signup,
  email OTP verification, password reset, and GitHub OAuth.
- **Deployment-ready architecture:** MongoDB, Redis, SMTP, Docker Compose,
  Judge0, and a self-hosted or OpenAI-compatible LLM service.

## System Architecture

JEMS uses a Next.js application for user-facing workflows and APIs, with a
separate FastAPI service for model-backed AI tasks and code assessment.

| Component | Technology | Responsibility |
|---|---|---|
| Web Application | Next.js 16, React 19, TypeScript | Dashboards, authentication, job workflows, profiles, and AI result interfaces |
| Application Database | MongoDB | Users, profiles, jobs, applications, assessments, learning, and progress |
| Rate Limiting | Redis | Per-IP limits for sensitive authentication and API workflows |
| AI and Assessment API | FastAPI, Uvicorn | Career agents, assessments, learning content, and background task processing |
| LLM Service | vLLM or OpenAI-compatible API | Generates model-backed analysis and recommendations |
| Code Execution | Judge0 | Runs submitted code in isolated execution environments |
| Infrastructure | Docker Compose | Runs MongoDB, Redis, PostgreSQL, Judge0, vLLM, and the analyzer |

```text
Browser
   |
   v
Next.js Web Application
   |------------- MongoDB
   |------------- Redis
   |
   v
FastAPI Analyzer API
   |------------- vLLM / OpenAI-compatible LLM
   |------------- Judge0
                    |
                    v
                  PostgreSQL / Redis
```

## Repository Structure

```text
.
├── Agent/
│   ├── analyzer/           FastAPI AI agents and assessment API
│   ├── judge0/             Judge0 language configuration
│   ├── docker-compose.yml  Local infrastructure stack
│   ├── API_GUIDE.md        Analyzer endpoints and examples
│   └── postman/            Postman collection and environment
├── JEMS-Application/
│   ├── app/                Next.js pages and API routes
│   ├── components/         Shared and role-specific UI
│   ├── lib/                Auth, database, AI, and utility code
│   ├── scripts/            Database setup and demo seeding
│   └── docs/               Setup and technical documentation
└── README.md
```

## Technology Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Authentication:** NextAuth, scrypt password hashing, SMTP email, GitHub OAuth
- **Database:** MongoDB
- **Caching and rate limiting:** Redis
- **AI service:** FastAPI, Uvicorn, vLLM or OpenAI-compatible models
- **Code execution:** Judge0
- **Infrastructure:** Docker and Docker Compose

## Getting Started

### Prerequisites

- Git
- Node.js 20.9 or later
- npm
- MongoDB, local or hosted
- Docker Desktop for the optional AI and coding-assessment stack

### 1. Clone the repository

```powershell
git clone https://github.com/pawan-pilgulwar/JEMS.git
cd JEMS
```

### 2. Configure the web application

```powershell
cd .\JEMS-Application
Copy-Item .env.example .env.local
```

Set at least these values in `JEMS-Application/.env.local`:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB` | MongoDB database name |
| `AUTH_SECRET` | Private NextAuth secret |
| `AUTH_URL` | Local app URL, normally `http://localhost:3000` |
| `REDIS_URL` | Redis URL; optional for local in-memory rate limiting |
| `AGENT_BASE_URL` | Analyzer URL, normally `http://localhost:8080` |

Generate a secure authentication secret:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

SMTP variables are required for verification and password-reset email.
Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`,
and `SMTP_FROM` when email delivery is needed.

### 3. Install and run

```powershell
npm install
npm run setup-db
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build the production application |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run setup-db` | Create MongoDB collections and indexes |
| `npm run test-db` | Verify the MongoDB connection |
| `npm run seed-demo` | Create demo users and presentation data |

The database setup script is safe to rerun. Demo seeding modifies the configured
MongoDB database and should only be used in local development.

### 4. Run the optional AI and coding-assessment stack

Start Docker Desktop, then run this from the repository root:

```powershell
cd .\Agent
docker compose up -d --build
```

The analyzer API will be available at
[http://localhost:8080](http://localhost:8080), with interactive API
documentation at [http://localhost:8080/docs](http://localhost:8080/docs).
Judge0 will be available at [http://localhost:2358](http://localhost:2358).

Before starting the stack, review the environment settings in
[`Agent/docker-compose.yml`](Agent/docker-compose.yml). For a GPU-backed local
LLM, Docker Desktop must have NVIDIA GPU support enabled in WSL2. After the
stack is running, set `AGENT_BASE_URL=http://localhost:8080` in
`JEMS-Application/.env.local` and restart the web server.

> Replace the example database and Redis passwords before exposing the Agent
> stack beyond a trusted local environment. Keep development ports bound to
> localhost.

## Demo Accounts

The demo seed creates role-based accounts for local presentation:

| Role | Email | Default Password |
|---|---|---|
| Student | `demo@jems.dev` | `Demo@1234` |
| Company | `company@jems.dev` | `Demo@1234` |
| Institution | `institution@jems.dev` | `Demo@1234` |
| Faculty | `faculty@jems.dev` | `Demo@1234` |

Use demo accounts only in local development.

## Documentation

- [Application setup](JEMS-Application/docs/SETUP.md)
- [Architecture](JEMS-Application/docs/ARCHITECTURE.md)
- [Web API reference](JEMS-Application/docs/API.md)
- [Authentication and signup](JEMS-Application/docs/AUTH.md)
- [Database collections](JEMS-Application/docs/DATABASE.md)
- [AI Agent integration](JEMS-Application/docs/AI_AGENT.md)
- [AI Agent API guide](Agent/API_GUIDE.md)

## Security Notes

- API request bodies are size-limited and primitive fields are validated.
- Password credentials are hashed before storage.
- OTP codes are stored as HMAC-SHA256 digests, not plaintext.
- Sensitive authentication routes use IP-based rate limiting.
- Keep all secrets in local environment files and never commit `.env` files.
- Database setup, demo seeding, and code execution should be kept isolated
  from production or shared data.

## Contributing

Contributions, feature suggestions, bug reports, and documentation improvements
are welcome. Create a feature branch, make focused changes, and verify the
Next.js build and lint checks before submitting a pull request.

## License

License information is not currently included in this repository.
