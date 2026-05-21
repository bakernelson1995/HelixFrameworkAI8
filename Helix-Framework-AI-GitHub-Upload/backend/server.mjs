import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractTextFromUpload } from './documentText.mjs';
import { analyzeFrameworkUpload, buildAggregateAnalysis } from './frameworkAnalysis.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
loadEnvFile(path.join(rootDir, '.env'));

const frontendDir = path.join(rootDir, 'frontend');
const port = Number(process.env.PORT || 5000);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

if (process.argv.includes('--check')) {
  await assertProjectShape();
  console.log('Project check passed.');
  process.exit(0);
}

const server = http.createServer(async (req, res) => {
  try {
    await routeRequest(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, {
      success: false,
      error: 'Something went wrong while handling the request.'
    });
  }
});

server.listen(port, () => {
  console.log(`Helix Framework AI running at http://localhost:${port}`);
});

async function assertProjectShape() {
  const requiredFiles = [
    'frontend/index.html',
    'frontend/styles.css',
    'frontend/app.js',
    'backend/server.mjs',
    'backend/framework.mjs',
    'backend/frameworkAnalysis.mjs',
    'backend/documentText.mjs'
  ];

  for (const file of requiredFiles) {
    const fullPath = path.join(rootDir, file);
    await fsp.access(fullPath, fs.constants.R_OK);
  }
}

async function routeRequest(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, {
      status: 'Backend is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      aiEnabled: Boolean(process.env.OPENAI_API_KEY),
      analysisEngine: process.env.OPENAI_API_KEY ? 'OpenAI' : 'Local rubric'
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/department-brain/upload') {
    const { files, fields } = await readUploadRequest(req);
    const context = buildUploadContext(fields, 'department');
    const insights = await analyzeUploadedFiles(files, context);
    return sendJson(res, 200, {
      success: true,
      insights,
      aggregate: buildAggregateAnalysis(insights, context),
      filesProcessed: insights.length
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/framework/analyze') {
    const { files, fields } = await readUploadRequest(req);
    const context = buildUploadContext(fields, fields.scope || 'department');
    const insights = await analyzeUploadedFiles(files, context);
    return sendJson(res, 200, {
      success: true,
      insights,
      aggregate: buildAggregateAnalysis(insights, context),
      filesProcessed: insights.length
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/assignment-aligner/analyze') {
    const { files, fields } = await readUploadRequest(req);
    const context = buildUploadContext(fields, 'assignment');
    const analyses = await analyzeUploadedFiles(files, context);
    return sendJson(res, 200, {
      success: true,
      analyses: analyses.map(toAssignmentAnalysis),
      aggregate: buildAggregateAnalysis(analyses, context),
      filesProcessed: analyses.length
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/consultant/analyze') {
    const body = await readJson(req);
    return sendJson(res, 200, buildConsultantResponse(body));
  }

  if (req.method === 'POST' && url.pathname === '/api/plc/insights') {
    const body = await readJson(req);
    return sendJson(res, 200, buildPlcResponse(body));
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  if (req.method === 'GET') {
    return serveStatic(url.pathname, res);
  }

  sendJson(res, 405, {
    success: false,
    error: 'Method not allowed'
  });
}

async function analyzeUploadedFiles(files, context) {
  const enrichedFiles = files.map(file => ({
    ...file,
    text: extractTextFromUpload(file)
  }));

  return Promise.all(enrichedFiles.map(file => analyzeFrameworkUpload(file, context)));
}

function toAssignmentAnalysis(analysis) {
  return {
    ...analysis,
    score: analysis.overallScore,
    strengths: analysis.evidence.length ? analysis.evidence.slice(0, 3) : [`${analysis.rating} framework alignment.`],
    improvements: analysis.nextSteps.slice(0, 3),
    frameworkAnalysis: analysis
  };
}

function buildUploadContext(fields, defaultScope) {
  return {
    scope: normalizeScope(fields.scope || defaultScope),
    course: fields.course || '',
    gradeBand: fields.gradeBand || 'auto'
  };
}

function normalizeScope(value) {
  const scope = String(value || '').toLowerCase();
  if (scope.includes('assignment') || scope.includes('project')) return 'assignment';
  if (scope.includes('course')) return 'course';
  return 'department';
}

async function serveStatic(requestPath, res) {
  const safePath = decodeURIComponent(requestPath.split('?')[0]);
  const normalizedPath = path.normalize(safePath).replace(/^(\.\.[/\\])+/, '');
  const relativePath = normalizedPath === '/' ? 'index.html' : normalizedPath.replace(/^[/\\]/, '');
  const filePath = path.resolve(frontendDir, relativePath);

  if (!filePath.startsWith(frontendDir)) {
    return sendJson(res, 403, { success: false, error: 'Forbidden' });
  }

  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) {
      throw new Error('Not a file');
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    const fallback = path.join(frontendDir, 'index.html');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(fallback).pipe(res);
  }
}

async function readJson(req) {
  const body = await readRequestBody(req);
  if (!body.length) {
    return {};
  }

  try {
    return JSON.parse(body.toString('utf-8'));
  } catch {
    return {};
  }
}

async function readUploadRequest(req) {
  const contentType = req.headers['content-type'] || '';
  const body = await readRequestBody(req, 80 * 1024 * 1024);

  if (contentType.includes('multipart/form-data')) {
    const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1]
      || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
    return parseMultipart(body, boundary);
  }

  if (contentType.includes('application/json')) {
    const parsed = JSON.parse(body.toString('utf-8') || '{}');
    const files = Array.isArray(parsed.files)
      ? parsed.files.map(file => ({
        name: file.name || 'artifact.txt',
        mimeType: file.mimeType || 'text/plain',
        data: Buffer.from(file.text || '', 'utf-8')
      }))
      : [];
    return { files, fields: parsed };
  }

  return { files: [], fields: {} };
}

function readRequestBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', chunk => {
      total += chunk.length;
      if (total > limit) {
        reject(new Error('Request body is too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseMultipart(buffer, boundary) {
  if (!boundary) {
    return { files: [], fields: {} };
  }

  const raw = buffer.toString('latin1');
  const parts = raw.split(`--${boundary}`).slice(1, -1);
  const files = [];
  const fields = {};

  parts.forEach(part => {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      return;
    }

    const headerText = part.slice(0, headerEnd);
    let content = part.slice(headerEnd + 4);
    if (content.endsWith('\r\n')) {
      content = content.slice(0, -2);
    }

    const disposition = headerText.match(/content-disposition:\s*([^\r\n]+)/i)?.[1] || '';
    const name = disposition.match(/name="([^"]+)"/)?.[1] || '';
    const filename = disposition.match(/filename="([^"]*)"/)?.[1] || '';
    const mimeType = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || 'text/plain';
    const data = Buffer.from(content, 'latin1');

    if (filename && data.length) {
      files.push({
        fieldName: name || 'files',
        name: filename,
        mimeType,
        size: data.length,
        data
      });
      return;
    }

    if (name) {
      fields[name] = data.toString('utf-8').trim();
    }
  });

  return { files, fields };
}

function buildConsultantResponse(body) {
  const reflection = String(body.departmentReflection || '').trim();
  const score = body.departmentScore || {};
  const recommendations = [];
  const text = normalize(reflection);

  if (Number(score.vocabulary || 0) <= 3 || containsAny(text, ['vocabulary', 'language', 'terms'])) {
    recommendations.push({
      title: 'Shared Science Vocabulary',
      recommendations: [
        'Create common student-facing language for measurement, data analysis, and science communication.',
        'Use the same framework terms in labs, course documents, and PLC scoring.',
        'Audit one teacher upload per course for consistent domain language.'
      ]
    });
  }

  if (Number(score.alignment || 0) <= 3 || containsAny(text, ['isolated', 'alignment', 'silo'])) {
    recommendations.push({
      title: 'Framework Alignment Cycle',
      recommendations: [
        'Upload one department, course, and assignment artifact each PLC cycle and compare scores.',
        'Map each course artifact to the correct grade-band expectations from the framework.',
        'Use the lowest domain score to choose the next shared instructional move.'
      ]
    });
  }

  if (Number(score.assessments || 0) <= 3 || containsAny(text, ['assessment', 'rubric', 'grading'])) {
    recommendations.push({
      title: 'Common Evidence Rubric',
      recommendations: [
        'Attach a compact Measurement, Data Analysis, and Communication rubric to major assignments.',
        'Score student work by framework domain before comparing total grades.',
        'Collect examples of strong, developing, and emerging evidence for calibration.'
      ]
    });
  }

  if (Number(score.act || 0) <= 3 || containsAny(text, ['act', 'graph', 'passage'])) {
    recommendations.push({
      title: 'ACT Science Transfer',
      recommendations: [
        'Add graph/table interpretation and evidence reasoning to each uploaded assignment.',
        'Use short ACT-style passages as transfer checks without dropping science content.',
        'Track whether uploaded artifacts ask students to reason from unfamiliar data.'
      ]
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      title: 'Maintain Momentum',
      recommendations: [
        'Keep a shared upload routine so strong practices stay visible.',
        'Rotate the domain focus monthly to avoid over-indexing on one skill.',
        'Use student work samples to calibrate what framework proficiency looks like.'
      ]
    });
  }

  return {
    success: true,
    recommendations,
    analysisText: reflection || 'No reflection provided.'
  };
}

function buildPlcResponse(body) {
  const course = String(body.course || 'Science');
  const grade = String(body.grade || 'Department');
  const domain = String(body.domain || 'Data Analysis');
  const skill = String(body.skill || 'Variable Identification');
  const seed = `${course}-${grade}-${domain}-${skill}`;
  const proficiency = 58 + (hash(seed) % 27);

  return {
    success: true,
    course,
    grade,
    domain,
    skill,
    result: `${proficiency}% proficient`,
    action: buildPlcAction(domain, skill, proficiency),
    nextSteps: [
      `Bring two ${course} student work samples to the next PLC.`,
      `Tag errors by ${domain} sub-skill before planning reteach.`,
      'Create one common formative check for the next two-week cycle.',
      'Revisit the same skill after reteach and compare proficiency.'
    ]
  };
}

function buildPlcAction(domain, skill, proficiency) {
  if (proficiency < 68) {
    return `Run a short reteach cycle for ${skill}, then reassess with a common ${domain} prompt.`;
  }

  if (proficiency < 78) {
    return `Use targeted small-group practice for ${skill} while extending proficient students with transfer questions.`;
  }

  return `Capture the strategy behind this ${skill} result and share it as a department routine.`;
}

function loadEnvFile(envPath) {
  try {
    const contents = fs.readFileSync(envPath, 'utf-8');
    contents.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const separator = trimmed.indexOf('=');
      if (separator === -1) return;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  } catch {
    // .env is optional for local preview.
  }
}

function containsAny(text, terms) {
  return terms.some(term => text.includes(term));
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

function hash(value) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders()
  });
  res.end(JSON.stringify(payload, null, 2));
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
