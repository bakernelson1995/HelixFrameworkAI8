import zlib from 'node:zlib';

const TEXT_EXTENSIONS = new Set(['.txt', '.csv', '.md', '.json', '.xml', '.html', '.htm']);

export function extractTextFromUpload(file) {
  const extension = getExtension(file.name);
  const mimeType = String(file.mimeType || '').toLowerCase();
  const data = file.data || Buffer.from(file.text || '', 'utf-8');

  if (!data.length) {
    return '';
  }

  if (mimeType.startsWith('text/') || TEXT_EXTENSIONS.has(extension)) {
    return cleanText(data.toString('utf-8'));
  }

  if (extension === '.pdf' || mimeType.includes('pdf')) {
    return cleanText(extractPdfText(data));
  }

  if (['.docx', '.pptx', '.xlsx'].includes(extension) || mimeType.includes('officedocument')) {
    return cleanText(extractOfficeText(data, extension));
  }

  return cleanText(data.toString('utf-8'));
}

function extractPdfText(buffer) {
  const raw = buffer.toString('latin1');
  const sources = [raw, ...extractFlatePdfStreams(raw)];
  const pieces = [];

  sources.forEach(source => {
    for (const match of source.matchAll(/\((?:\\.|[^\\()]){2,}\)\s*Tj/g)) {
      pieces.push(decodePdfLiteral(match[0]));
    }

    for (const match of source.matchAll(/\[(.*?)\]\s*TJ/gs)) {
      const group = match[1];
      for (const literal of group.matchAll(/\((?:\\.|[^\\()]){2,}\)/g)) {
        pieces.push(decodePdfLiteral(literal[0]));
      }
    }
  });

  if (pieces.join(' ').trim().length > 80) {
    return pieces.join(' ');
  }

  return raw
    .replace(/[^\x20-\x7E\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 12000);
}

function extractFlatePdfStreams(raw) {
  const decoded = [];
  const streamPattern = /<<(?:.|\r|\n){0,1400}?\/FlateDecode(?:.|\r|\n){0,1400}?>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;

  for (const match of raw.matchAll(streamPattern)) {
    try {
      const compressed = Buffer.from(match[1], 'latin1');
      decoded.push(zlib.inflateSync(compressed).toString('latin1'));
    } catch {
      // Some PDF streams use filters or predictors this lightweight reader does not handle.
    }
  }

  return decoded;
}

function decodePdfLiteral(value) {
  return value
    .replace(/^\(/, '')
    .replace(/\)\s*T[Jj]$/, '')
    .replace(/\)$/, '')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\\\/g, '\\');
}

function extractOfficeText(buffer, extension) {
  const entries = readZipEntries(buffer);
  const textEntries = entries.filter(entry => {
    if (extension === '.docx') return entry.name === 'word/document.xml';
    if (extension === '.pptx') return /^ppt\/slides\/slide\d+\.xml$/.test(entry.name);
    if (extension === '.xlsx') return entry.name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name);
    return false;
  });

  return textEntries
    .map(entry => xmlToText(entry.data.toString('utf-8')))
    .join(' ');
}

function readZipEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset === -1) {
    return [];
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf-8', offset + 46, offset + 46 + fileNameLength);
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

    let data = Buffer.alloc(0);
    if (compressionMethod === 0) {
      data = compressedData;
    } else if (compressionMethod === 8) {
      data = zlib.inflateRawSync(compressedData);
    }

    entries.push({ name, data });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50;
  const start = Math.max(0, buffer.length - 66000);

  for (let index = buffer.length - 22; index >= start; index -= 1) {
    if (buffer.readUInt32LE(index) === signature) {
      return index;
    }
  }

  return -1;
}

function xmlToText(xml) {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function cleanText(value) {
  return String(value || '')
    .replace(/\0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getExtension(fileName) {
  const match = String(fileName || '').toLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : '';
}
