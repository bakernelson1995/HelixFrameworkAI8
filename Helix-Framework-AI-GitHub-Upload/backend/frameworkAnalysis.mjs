import { FRAMEWORK_DOMAINS, FRAMEWORK_SOURCE, FRAMEWORK_SUMMARY, GRADE_BANDS, scoreToRating } from './framework.mjs';

const DEFAULT_CONTEXT = {
  scope: 'department',
  course: '',
  gradeBand: 'auto'
};
const LOCAL_SCORE_BASELINE = 24;
const LOCAL_EVIDENCE_BONUS = 3;
const AI_SCORE_CURVE = 3;

export async function analyzeFrameworkUpload(file, context = {}) {
  const normalizedContext = { ...DEFAULT_CONTEXT, ...context };
  const localAnalysis = analyzeLocally(file, normalizedContext);

  if (!process.env.OPENAI_API_KEY) {
    return {
      ...localAnalysis,
      analysisMode: 'Local rubric',
      aiNote: buildLocalAiNote(localAnalysis)
    };
  }

  try {
    const aiAnalysis = await analyzeWithOpenAI(file, normalizedContext, localAnalysis);
    return {
      ...localAnalysis,
      ...aiAnalysis,
      name: file.name,
      type: localAnalysis.type,
      analysisMode: 'AI',
      source: FRAMEWORK_SOURCE
    };
  } catch (error) {
    return {
      ...localAnalysis,
      aiNote: `AI unavailable; local framework scoring used. ${error.message}`
    };
  }
}

export function buildAggregateAnalysis(analyses, context = {}) {
  if (!analyses.length) {
    return null;
  }

  const score = Math.round(average(analyses.map(item => item.overallScore)));
  const domainAverages = FRAMEWORK_DOMAINS.map(domain => {
    const domainScores = analyses
      .map(item => item.domainScores.find(scoreItem => scoreItem.domain === domain.name)?.score)
      .filter(Number.isFinite);
    const domainScore = Math.round(average(domainScores));
    return {
      domain: domain.name,
      score: domainScore,
      rating: scoreToRating(domainScore)
    };
  });
  const priorityDomain = [...domainAverages].sort((a, b) => a.score - b.score)[0];
  const strongestDomain = [...domainAverages].sort((a, b) => b.score - a.score)[0];
  const commonGaps = topItems(analyses.flatMap(item => item.gaps || []), 4);
  const scopeLabel = scopeToLabel(context.scope);

  return {
    scope: context.scope || 'department',
    score,
    rating: scoreToRating(score),
    domainAverages,
    summary: `${scopeLabel} alignment is ${scoreToRating(score).toLowerCase()} against the Science Department OS Framework. Strongest signal: ${strongestDomain.domain}. Priority domain: ${priorityDomain.domain}.`,
    nextSteps: commonGaps.length
      ? commonGaps.map(gap => `Strengthen evidence for ${gap}.`)
      : ['Keep collecting common artifacts and compare evidence by framework domain during PLC.']
  };
}

function analyzeLocally(file, context) {
  const text = normalize(`${file.name || ''} ${file.text || ''}`);
  const inferredGradeBand = inferGradeBand(text, context.gradeBand);
  const type = classifyArtifact(text, context.scope);
  const domainScores = FRAMEWORK_DOMAINS.map(domain => scoreDomain(domain, text, inferredGradeBand, context.scope));
  const overallScore = Math.round(average(domainScores.map(domain => domain.score)));
  const strongestDomain = [...domainScores].sort((a, b) => b.score - a.score)[0];
  const priorityDomain = [...domainScores].sort((a, b) => a.score - b.score)[0];
  const evidence = domainScores.flatMap(domain => domain.evidence).slice(0, 5);
  const gaps = domainScores.flatMap(domain => domain.gaps).slice(0, 6);
  const nextSteps = buildNextSteps(domainScores, context.scope);

  return {
    name: file.name,
    type,
    source: FRAMEWORK_SOURCE,
    analysisMode: 'Local rubric',
    scope: context.scope || 'department',
    course: context.course || '',
    gradeBand: inferredGradeBand.label,
    overallScore,
    rating: scoreToRating(overallScore),
    summary: buildSummary(type, overallScore, strongestDomain, priorityDomain, context),
    domainScores,
    evidence,
    gaps,
    nextSteps,
    readableTextLength: String(file.text || '').length,
    readableWordCount: countWords(file.text || '')
  };
}

function scoreDomain(domain, text, gradeBand, scope) {
  const categoryResults = domain.categories.map(category => {
    const keywordMatches = category.keywords
      .map(keyword => ({
        keyword,
        count: countKeywordMatches(text, keyword)
      }))
      .filter(match => match.count > 0);
    const hitCount = keywordMatches.reduce((sum, match) => sum + match.count, 0);
    return {
      name: category.name,
      matched: hitCount > 0,
      hitCount,
      strength: hitCount ? Math.min(1, 0.45 + Math.log1p(hitCount) / 2.5) : 0,
      matchedKeywords: keywordMatches.map(match => match.keyword).slice(0, 4)
    };
  });
  const matchedCategories = categoryResults.filter(category => category.matched);
  const expectedCategories = domain.gradeBands[gradeBand.id] || [];
  const coverageStrength = categoryResults.reduce((sum, category) => sum + category.strength, 0);
  const expectedStrength = categoryResults
    .filter(category => expectedCategories.includes(category.name))
    .reduce((sum, category) => sum + category.strength, 0);
  const coverageScore = coverageStrength / domain.categories.length;
  const gradeFitScore = expectedCategories.length ? expectedStrength / expectedCategories.length : 0;
  const wordCount = countWords(text);
  const totalHits = categoryResults.reduce((sum, category) => sum + category.hitCount, 0);
  const depthBonus = Math.min(8, Math.floor(wordCount / 85));
  const densityBonus = totalHits ? Math.min(8, Math.round((totalHits / Math.max(80, wordCount)) * 140)) : 0;
  const varietyBonus = matchedCategories.length > 1 ? Math.min(5, matchedCategories.length - 1) : 0;
  const evidenceBonus = matchedCategories.length ? LOCAL_EVIDENCE_BONUS : 0;
  const score = clamp(Math.round(LOCAL_SCORE_BASELINE + coverageScore * 43 + gradeFitScore * 24 + depthBonus + densityBonus + varietyBonus + evidenceBonus), 18, 98);
  const missingExpected = expectedCategories.filter(category =>
    !categoryResults.find(result => result.name === category)?.matched
  );

  return {
    domain: domain.name,
    score,
    rating: scoreToRating(score),
    matchedSkills: matchedCategories.map(category => category.name),
    evidence: buildEvidence(domain.name, matchedCategories, scope),
    gaps: missingExpected.length ? missingExpected : domain.categories.filter(category =>
      !matchedCategories.some(match => match.name === category.name)
    ).slice(0, 3).map(category => category.name),
    nextSteps: buildDomainNextSteps(domain.name, missingExpected, scope)
  };
}

async function analyzeWithOpenAI(file, context, localAnalysis) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: buildOpenAISystemPrompt(context)
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: buildOpenAITask(context),
            scope: context.scope,
            course: context.course,
            gradeBand: context.gradeBand,
            documentName: file.name,
            scoringLens: buildScoringLens(context),
            localRubricDraft: context.scope === 'assignment' ? undefined : localAnalysis,
            requiredJsonShape: {
              overallScore: '0-100 number',
              rating: 'short rating label',
              summary: '2 sentence framework comparison',
              evidence: ['specific framework-aligned expectations or deliverables found in the document'],
              gaps: ['specific missing expectations, deliverables, scaffolds, or rubric criteria'],
              nextSteps: ['specific teacher/PLC revision actions'],
              domainScores: [
                {
                  domain: 'Measurement | Data Analysis | Communication in Science',
                  score: '0-100 number',
                  rating: 'short rating label',
                  matchedSkills: ['framework skills students are expected to demonstrate'],
                  evidence: ['specific assignment directions, prompts, products, rubric criteria, or deliverables'],
                  gaps: ['specific missing student expectations, deliverables, scaffolds, or rubric criteria'],
                  nextSteps: ['domain-specific assignment revision action']
                }
              ]
            },
            documentText: String(file.text || '').slice(0, 14000)
          })
        }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error(await buildOpenAIErrorMessage(response));
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
  return normalizeAiResponse(unwrapAiPayload(parsed), localAnalysis, context);
}

function buildOpenAISystemPrompt(context) {
  const assignmentLens = context.scope === 'assignment'
    ? ' For assignment/project uploads, evaluate the assignment as a teacher-designed task. Score what the directions, prompts, rubric, success criteria, and required products expect students to do and provide. Do not judge whether students have already mastered the skills, and do not penalize the upload merely because no student work sample is included. Evidence should name expected student actions or deliverables, such as measure, graph, calculate, write a CER, justify a claim, submit a lab report, or explain uncertainty.'
    : '';

  return `You are an expert science department curriculum reviewer. Compare teacher-uploaded documents to this source framework.${assignmentLens} Be slightly forgiving: give credit for implied or partially present framework evidence, especially when the teacher artifact clearly supports a domain even if it does not use the framework's exact wording. Do not inflate weak evidence; just avoid overly harsh scoring. Return only valid JSON with these exact top-level keys: overallScore, rating, summary, evidence, gaps, nextSteps, domainScores. Do not wrap the JSON in another object. ${FRAMEWORK_SUMMARY}`;
}

function buildOpenAITask(context) {
  if (context.scope === 'assignment') {
    return 'Rate this assignment or project against the Science Department OS Framework by evaluating what students are asked to do, produce, explain, calculate, graph, justify, or submit.';
  }

  return 'Rate this document against the Science Department OS Framework for the requested scope.';
}

function buildScoringLens(context) {
  if (context.scope === 'assignment') {
    return {
      judge: [
        'the assignment directions',
        'student-facing prompts',
        'required student products or deliverables',
        'rubric or success criteria',
        'scaffolds that make framework skills visible'
      ],
      doNotJudge: [
        'whether a student response already demonstrates mastery',
        'missing student work samples',
        'teacher intent that is not visible in the uploaded task'
      ]
    };
  }

  return {
    judge: ['visible framework alignment in the uploaded artifact'],
    doNotJudge: ['materials that are not present in the upload']
  };
}

async function buildOpenAIErrorMessage(response) {
  const fallback = `OpenAI request failed with status ${response.status}`;

  try {
    const body = await response.text();
    const parsed = JSON.parse(body);
    const message = parsed.error?.message || parsed.error?.code;
    return message ? `OpenAI request failed: ${message}` : fallback;
  } catch {
    return fallback;
  }
}

function unwrapAiPayload(parsed) {
  if (hasAnalysisShape(parsed)) {
    return parsed;
  }

  const candidates = [
    parsed.analysis,
    parsed.frameworkAnalysis,
    parsed.result,
    parsed.rating,
    parsed.response
  ];

  return candidates.find(hasAnalysisShape) || parsed;
}

function hasAnalysisShape(value) {
  return Boolean(value && typeof value === 'object' && (
    Array.isArray(value.domainScores)
    || value.overallScore !== undefined
    || value.summary !== undefined
  ));
}

function normalizeAiResponse(parsed, localAnalysis, context) {
  const domainScores = Array.isArray(parsed.domainScores) && parsed.domainScores.length
    ? parsed.domainScores.map(domain => {
      const score = applyAiCurve(Number(domain.score || 0));
      return {
        domain: String(domain.domain || ''),
        score,
        rating: scoreToRating(score),
        matchedSkills: arrayOfStrings(domain.matchedSkills),
        evidence: arrayOfStrings(domain.evidence),
        gaps: arrayOfStrings(domain.gaps),
        nextSteps: arrayOfStrings(domain.nextSteps)
      };
    })
    : localAnalysis.domainScores;

  const overallScore = deriveOverallScore(parsed, domainScores, localAnalysis, context);
  const strongestDomain = [...domainScores].sort((a, b) => b.score - a.score)[0];
  const priorityDomain = [...domainScores].sort((a, b) => a.score - b.score)[0];

  return {
    overallScore,
    rating: scoreToRating(overallScore),
    summary: chooseSummary(parsed.summary, overallScore, strongestDomain, priorityDomain, context),
    evidence: arrayOfStrings(parsed.evidence).length ? arrayOfStrings(parsed.evidence) : localAnalysis.evidence,
    gaps: arrayOfStrings(parsed.gaps).length ? arrayOfStrings(parsed.gaps) : localAnalysis.gaps,
    nextSteps: arrayOfStrings(parsed.nextSteps).length ? arrayOfStrings(parsed.nextSteps) : localAnalysis.nextSteps,
    domainScores
  };
}

function deriveOverallScore(parsed, domainScores, localAnalysis, context) {
  const cleanDomainScores = domainScores.map(domain => Number(domain.score)).filter(Number.isFinite);

  if (context.scope === 'assignment' && cleanDomainScores.length) {
    return Math.round(average(cleanDomainScores));
  }

  return applyAiCurve(Number(parsed.overallScore || localAnalysis.overallScore));
}

function chooseSummary(summary, score, strongestDomain, priorityDomain, context) {
  const fallback = buildFallbackSummary(score, strongestDomain, priorityDomain, context);
  const text = String(summary || '').trim();
  if (!text) {
    return fallback;
  }

  if (context.scope !== 'assignment') {
    return text;
  }

  return fallback;
}

function buildFallbackSummary(score, strongestDomain, priorityDomain, context) {
  if (context.scope === 'assignment') {
    return `Assignment/project rates ${score}/100 for framework-aligned student expectations. Strongest expected evidence is in ${strongestDomain.domain}; the main revision area is ${priorityDomain.domain}.`;
  }

  const scopeLabel = scopeToLabel(context.scope);
  return `${scopeLabel} alignment rates ${score}/100 against the Science Department OS Framework. Strongest signal: ${strongestDomain.domain}. Priority domain: ${priorityDomain.domain}.`;
}

function applyAiCurve(score) {
  if (!Number.isFinite(score) || score <= 0) {
    return 0;
  }

  return clamp(score + AI_SCORE_CURVE, 0, 100);
}

function inferGradeBand(text, requestedGradeBand) {
  if (requestedGradeBand && requestedGradeBand !== 'auto') {
    return GRADE_BANDS.find(band => band.id === requestedGradeBand) || GRADE_BANDS[0];
  }

  const scored = GRADE_BANDS.map(band => ({
    ...band,
    hits: band.keywords.filter(keyword => text.includes(keyword)).length
  }));

  return scored.sort((a, b) => b.hits - a.hits)[0].hits ? scored[0] : { id: 'freshman', label: 'Auto: freshman foundation' };
}

function classifyArtifact(text, scope) {
  if (scope === 'department') return 'Department artifact';
  if (scope === 'course') return 'Course artifact';
  if (scope === 'assignment') return 'Assignment or project';
  if (text.includes('syllabus') || text.includes('scope and sequence') || text.includes('curriculum map')) return 'Course artifact';
  if (text.includes('project') || text.includes('assignment') || text.includes('lab') || text.includes('investigation')) return 'Assignment or project';
  if (text.includes('plc') || text.includes('department')) return 'Department artifact';
  return 'Instructional artifact';
}

function buildSummary(type, score, strongestDomain, priorityDomain, context) {
  const scopeLabel = scopeToLabel(context.scope);
  return `${type} rates ${score}/100 for ${scopeLabel.toLowerCase()} alignment. Strongest evidence is in ${strongestDomain.domain}; the main improvement area is ${priorityDomain.domain}.`;
}

function buildLocalAiNote(localAnalysis) {
  const baseNote = 'OpenAI is not connected, so this result uses the local keyword rubric.';
  if (localAnalysis.readableWordCount < 20) {
    return `${baseNote} Only limited readable text was extracted from this upload, so scanned/image PDFs may need OCR or an API key for stronger scoring.`;
  }

  return `${baseNote} Add OPENAI_API_KEY to .env and restart the server to use AI scoring.`;
}

function buildEvidence(domainName, matchedCategories, scope) {
  return matchedCategories.slice(0, 4).map(category =>
    scope === 'assignment'
      ? `${domainName}: assignment appears to expect ${category.name} through ${category.matchedKeywords.join(', ')}.`
      : `${domainName}: ${category.name} signaled by ${category.matchedKeywords.join(', ')}.`
  );
}

function buildDomainNextSteps(domainName, missingExpected, scope) {
  const missing = missingExpected.slice(0, 2);
  if (!missing.length) {
    return scope === 'assignment'
      ? [`Use this assignment as a PLC example for making ${domainName} expectations visible to students.`]
      : [`Use this artifact as a PLC example for ${domainName}.`];
  }
  return missing.map(skill => scope === 'assignment'
    ? `Revise the assignment so students are explicitly asked to demonstrate ${skill} in the ${domainName} domain.`
    : `Add explicit evidence for ${skill} in the ${domainName} domain.`);
}

function buildNextSteps(domainScores, scope) {
  const priorityDomain = [...domainScores].sort((a, b) => a.score - b.score)[0];
  if (scope === 'assignment') {
    return [
      `Revise the task directions so students clearly demonstrate ${priorityDomain.gaps[0] || priorityDomain.domain}.`,
      'Add or tighten a rubric row that names the expected Measurement, Data Analysis, or Communication evidence.',
      'Bring the assignment to PLC and ask whether the expected student product makes framework skills visible.'
    ];
  }

  const steps = [
    `Add or revise one task so students demonstrate ${priorityDomain.gaps[0] || priorityDomain.domain}.`,
    `Bring this artifact to PLC and score it by Measurement, Data Analysis, and Communication evidence.`,
    `Document how the artifact supports the ${scopeToLabel(scope).toLowerCase()} progression across grade bands.`
  ];
  return steps;
}

function scopeToLabel(scope) {
  if (scope === 'course') return 'Course';
  if (scope === 'assignment') return 'Assignment/project';
  return 'Department';
}

function topItems(items, limit) {
  const counts = new Map();
  items.forEach(item => counts.set(item, (counts.get(item) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([item]) => item);
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

function countWords(value) {
  return (String(value || '').toLowerCase().match(/[a-z0-9]+(?:['-][a-z0-9]+)?/g) || []).length;
}

function countKeywordMatches(text, keyword) {
  const normalizedKeyword = normalize(keyword).trim();
  if (!normalizedKeyword) {
    return 0;
  }

  const escaped = normalizedKeyword
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'g');
  return [...text.matchAll(pattern)].length;
}

function average(values) {
  const cleanValues = values.filter(Number.isFinite);
  if (!cleanValues.length) return 0;
  return cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.map(item => String(item)).filter(Boolean).slice(0, 8) : [];
}
