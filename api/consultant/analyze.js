export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJson(req);
    const response = buildConsultantResponse(body);
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message || 'Something went wrong while handling the request.'
    });
  }
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

function containsAny(text, terms) {
  return terms.some(term => text.includes(term));
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

async function readJson(req) {
  const body = await readBody(req);
  if (!body.length) {
    return {};
  }

  try {
    return JSON.parse(body.toString('utf-8'));
  } catch {
    return {};
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    const limit = 2 * 1024 * 1024;

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
