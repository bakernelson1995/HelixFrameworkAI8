export function parseMultipart(buffer, boundary) {
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

export function buildUploadContext(fields, defaultScope) {
  return {
    scope: normalizeScope(fields.scope || defaultScope),
    course: fields.course || '',
    gradeBand: fields.gradeBand || 'auto'
  };
}

export function normalizeScope(value) {
  const scope = String(value || '').toLowerCase();
  if (scope.includes('assignment') || scope.includes('project')) return 'assignment';
  if (scope.includes('course')) return 'course';
  return 'department';
}
