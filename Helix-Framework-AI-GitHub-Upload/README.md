# Helix Framework AI

Helix Framework AI is a local frontend/backend app for helping a science department compare teacher-uploaded documents to the Science Department OS Framework, rate departments/courses/assignments, generate department recommendations, and prepare PLC action briefs.

This first working version is dependency-free so it can run anywhere Node 18+ is available. The backend serves the frontend and exposes the API endpoints described below.

## Quick Start

```bash
cd Science-Department-OS
npm run dev
```

If npm is not available, run the backend directly:

```bash
node backend/server.mjs
```

Then open:

```text
http://localhost:5000
```

## Project Structure

```text
Science-Department-OS/
|-- frontend/
|   |-- index.html
|   |-- styles.css
|   |-- app.js
|   `-- src/services/api.ts
|-- backend/
|   |-- server.mjs
|   |-- framework.mjs
|   |-- frameworkAnalysis.mjs
|   |-- documentText.mjs
|   `-- src/
|       |-- services/assignmentScorer.ts
|       `-- utils/fileExtractor.ts
|-- package.json
|-- .env.example
|-- README.md
`-- TESTING.md
```

## Features

- Department Brain: upload department, course, assignment, project, rubric, syllabus, or PLC artifacts and rate them against the framework.
- Framework ratings: overall score, rating label, domain scores, evidence, gaps, and next steps for Measurement, Data Analysis, and Communication in Science.
- AI support: uses OpenAI when `OPENAI_API_KEY` is configured; otherwise it uses the local framework rubric.
- AI Consultant: submit department reflection scores and receive targeted action recommendations.
- Assignment Aligner: upload assignments/projects and receive framework alignment scores with strengths and improvements.
- PLC Insights: generate a focused PLC action brief for a course, grade, domain, and skill.
- Health endpoint: verify that the backend is running.

## API Endpoints

```text
GET /health
POST /api/department-brain/upload
POST /api/framework/analyze
POST /api/consultant/analyze
POST /api/assignment-aligner/analyze
POST /api/plc/insights
```

The upload endpoints accept `multipart/form-data` with one or more `files` fields plus optional `scope`, `course`, and `gradeBand` fields. Supported upload text extraction includes TXT/CSV, best-effort PDF, and common Office XML files such as DOCX, PPTX, and XLSX.

## Notes

The app runs without an API key using local rubric scoring. To enable AI review, create `.env` from `.env.example` and set:

```text
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4o-mini
```
