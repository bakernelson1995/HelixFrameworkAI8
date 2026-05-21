interface AssignmentAnalysis {
  name: string;
  score: number;
  strengths: string[];
  improvements: string[];
}

interface AssignmentInput {
  originalname: string;
  text?: string;
}

const domains = {
  measurement: ['measurement', 'measure', 'variable', 'control', 'units', 'trial', 'procedure'],
  analysis: ['graph', 'table', 'trend', 'pattern', 'analyze', 'evidence', 'interpret', 'calculate'],
  communication: ['cer', 'claim', 'evidence', 'reasoning', 'conclusion', 'explain', 'justify']
};

export async function scoreAssignment(file: AssignmentInput): Promise<AssignmentAnalysis> {
  const text = (file.text || '').toLowerCase();
  const mapped = Object.entries(domains).filter(([, terms]) =>
    terms.some(term => text.includes(term))
  );
  const hasActSignal = ['act', 'passage', 'figure', 'chart'].some(term => text.includes(term));
  const hasRubric = ['rubric', 'criteria', 'proficient', 'mastery'].some(term => text.includes(term));
  let score = 42 + mapped.length * 15;

  if (hasActSignal) score += 7;
  if (hasRubric) score += 6;
  score = Math.max(35, Math.min(96, score));

  return {
    name: file.originalname,
    score,
    strengths: buildStrengths(mapped.map(([name]) => name), hasActSignal, hasRubric),
    improvements: buildImprovements(mapped.map(([name]) => name), hasActSignal, hasRubric)
  };
}

function buildStrengths(mapped: string[], hasActSignal: boolean, hasRubric: boolean): string[] {
  const strengths = [];
  if (mapped.includes('measurement')) strengths.push('Students work with measurable evidence.');
  if (mapped.includes('analysis')) strengths.push('Students interpret data patterns or trends.');
  if (mapped.includes('communication')) strengths.push('Students explain reasoning or conclusions.');
  if (hasActSignal) strengths.push('ACT-style science reasoning is visible.');
  if (hasRubric) strengths.push('Rubric language clarifies the target.');
  return strengths.slice(0, 3).length ? strengths.slice(0, 3) : ['Assignment has a clear instructional purpose.'];
}

function buildImprovements(mapped: string[], hasActSignal: boolean, hasRubric: boolean): string[] {
  const improvements = [];
  if (!mapped.includes('measurement')) improvements.push('Add variable, unit, or data collection expectations.');
  if (!mapped.includes('analysis')) improvements.push('Add graph, table, or trend interpretation.');
  if (!mapped.includes('communication')) improvements.push('Add a CER conclusion or written explanation.');
  if (!hasActSignal) improvements.push('Include one ACT-style figure or passage question.');
  if (!hasRubric) improvements.push('Add a compact three-domain rubric.');
  return improvements.slice(0, 3);
}
