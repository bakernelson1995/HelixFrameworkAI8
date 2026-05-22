import { extractTextFromUpload } from '../../Helix-Framework-AI-GitHub-Upload/backend/documentText.mjs';
import { analyzeFrameworkUpload, buildAggregateAnalysis } from '../../Helix-Framework-AI-GitHub-Upload/backend/frameworkAnalysis.mjs';
import { parseMultipart, buildUploadContext } from '../utils/upload.js';

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
    const contentType = req.headers['content-type'] || '';
    let files = [];
    let fields = {};

    if (contentType.includes('multipart/form-data')) {
      const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1]
        || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
      const bodyBuffer = await readBody(req);
      const parsed = parseMultipart(bodyBuffer, boundary);
      files = parsed.files;
      fields = parsed.fields;
    } else if (contentType.includes('application/json')) {
      const body = await readBody(req);
      const parsed = JSON.parse(body.toString('utf-8') || '{}');
      files = Array.isArray(parsed.files)
        ? parsed.files.map(file => ({
          name: file.name || 'artifact.txt',
          mimeType: file.mimeType || 'text/plain',
          data: Buffer.from(file.text || '', 'utf-8')
        }))
        : [];
      fields = parsed;
    }

    const context = buildUploadContext(fields, fields.scope || 'department');
    const enrichedFiles = files.map(file => ({
      ...file,
      text: extractTextFromUpload(file)
    }));

    const insights = await Promise.all(enrichedFiles.map(file => analyzeFrameworkUpload(file, context)));

    res.status(200).json({
      success: true,
      insights,
      aggregate: buildAggregateAnalysis(insights, context),
      filesProcessed: insights.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message || 'Something went wrong while handling the request.'
    });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    const limit = 80 * 1024 * 1024;

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
