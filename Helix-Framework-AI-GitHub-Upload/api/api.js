import fs from 'node:fs';
import path from 'node:path';
import { extractTextFromUpload } from '../backend/documentText.mjs';
import { analyzeFrameworkUpload, buildAggregateAnalysis } from '../backend/frameworkAnalysis.mjs';

loadEnvFile(path.join(process.cwd(), '.env'));

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  try {
    const route = normalizeRoute(req);
    const method = req.method || 'GET';

    if (method === 'OPTIONS') {
      return sendJson(res, 204, {});
    }

    if (method === 'GET' && route === '/health') {
      return sendJson(res, 200, {
        status: 'Backend is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        aiEnabled: Boolean(process.env.OPENAI_API_KEY),
        analysisEngine: process.env.OPENAI_API_KEY ? 'OpenAI' : 'Local rubric'
      });
    }

    if (method === 'POST' && route === '/api/department-brain/upload') {
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

    if (method === 'POST' && route === '/api/framework/analyze') {
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

    if (method === 'POST' && route === '/api/assignment-aligner/analyze') {
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

    if (method === 'POST' && route === '/api/consultant/analyze') {
      return sendJson(res, 200, buildConsultantResponse(await readJson(req)));
    }

    if (method === 'POST' && route === '/api/plc/insights') {
      return sendJson(res, 200, buildPlcResponse(await readJson(req)));
    }

    return sendJson(res, 404, {
      success: false,
      error: `No Vercel function route for ${method} ${route}`
    });
  } catch (error) {
    return sendJson(res, 500, {
      success: false,
      error: error.message || 'Something went wrong while handling the request.'
    });
  }
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

function normalizeRoute(req) {
  const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
  const explicitRoute = url.searchParams.get('route');
  if (explicitRoute) {
    return explicitRoute.startsWith('/') ? explicitRoute : `/${explicitRoute}`;
  }

  return url.pathname.replace(/^\/api\/api/, '/api') || '/health';
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

function readRequestBody(req, limit = 2 * 1024 * 1024) {
  if (Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }

  if (typeof req.body === 'string') {
    return Promise.resolve(Buffer.from(req.body, 'utf-8'));
  }

  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(Buffer.from(JSON.stringify(req.body), 'utf-8'));
  }

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

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(statusCode === 204 ? '' : JSON.stringify(payload, null, 2));
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
    // Vercel production uses dashboard environment variables.
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
