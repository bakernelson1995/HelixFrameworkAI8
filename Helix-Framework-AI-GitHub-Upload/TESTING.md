# Test Script for Helix Framework AI

## Start the App

```bash
cd Science-Department-OS
node backend/server.mjs
```

Then visit:

```text
http://localhost:5000
```

## Health Check

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{
  "status": "Backend is running",
  "timestamp": "2026-05-20T14:00:00.000Z",
  "environment": "development",
  "aiEnabled": false
}
```

## Framework Department/Course Upload

Create a test file:

```bash
echo "Biology lab: students estimate, choose metric units, collect data, identify variables, graph trends, and write a CER conclusion." > test-syllabus.txt
```

Upload it:

```bash
curl -X POST \
  -F "scope=course" \
  -F "course=Biology" \
  -F "gradeBand=freshman" \
  -F "files=@test-syllabus.txt" \
  http://localhost:5000/api/department-brain/upload
```

Expected shape:

```json
{
  "success": true,
  "insights": [
    {
      "name": "test-syllabus.txt",
      "type": "Course artifact",
      "source": "Science Department OS Framework Manual",
      "analysisMode": "Local rubric",
      "overallScore": 48,
      "rating": "Emerging",
      "domainScores": [
        {
          "domain": "Measurement",
          "score": 60
        }
      ],
      "nextSteps": ["Add or revise one task..."]
    }
  ],
  "aggregate": {
    "score": 48,
    "rating": "Emerging"
  },
  "filesProcessed": 1
}
```

## Consultant Endpoint

```bash
curl -X POST http://localhost:5000/api/consultant/analyze \
  -H "Content-Type: application/json" \
  -d "{\"departmentReflection\":\"Our department feels isolated and students struggle with graph interpretation.\",\"departmentScore\":{\"vocabulary\":2,\"alignment\":2,\"assessments\":3,\"act\":1}}"
```

Expected shape:

```json
{
  "success": true,
  "recommendations": [
    {
      "title": "Shared Science Vocabulary",
      "recommendations": ["Create a short cross-course vocabulary set..."]
    }
  ]
}
```

## Assignment/Project Aligner

Create a test assignment:

```bash
echo "Chemistry project: students convert units with dimensional analysis, calculate density, organize a data table, graph obtained data in Google Sheets, summarize variable relationships, analyze claims, and write conclusions using evidence." > ecosystem-lab.txt
```

Upload it:

```bash
curl -X POST \
  -F "scope=assignment" \
  -F "course=Chemistry" \
  -F "gradeBand=sophomore" \
  -F "files=@ecosystem-lab.txt" \
  http://localhost:5000/api/assignment-aligner/analyze
```

Expected shape:

```json
{
  "success": true,
  "analyses": [
    {
      "name": "ecosystem-lab.txt",
      "score": 50,
      "rating": "Emerging",
      "strengths": ["Measurement: Correct units signaled by unit, units."],
      "improvements": ["Add or revise one task so students demonstrate Lab procedure."],
      "frameworkAnalysis": {
        "overallScore": 50,
        "domainScores": []
      }
    }
  ],
  "filesProcessed": 1
}
```

## PLC Insights

```bash
curl -X POST http://localhost:5000/api/plc/insights \
  -H "Content-Type: application/json" \
  -d "{\"course\":\"Biology\",\"grade\":\"9th\",\"domain\":\"Data Analysis\",\"skill\":\"Variable Identification\"}"
```

Expected shape:

```json
{
  "success": true,
  "course": "Biology",
  "grade": "9th",
  "domain": "Data Analysis",
  "skill": "Variable Identification",
  "result": "68% proficient",
  "action": "Use targeted small-group practice..."
}
```
