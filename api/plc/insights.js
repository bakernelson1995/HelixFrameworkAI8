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
    const response = buildPlcResponse(body);
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message || 'Something went wrong while handling the request.'
    });
  }
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

function hash(value) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
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
