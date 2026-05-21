export const FRAMEWORK_SOURCE = 'Science Department OS Framework Manual';

export const FRAMEWORK_SUMMARY = `
The Science Department OS Framework develops student growth in science practices through a scaffolded high-school progression. The department tracks common skill evidence for PLC meetings and ACT science readiness.

Core domains:
1. Measurement: estimation, measuring, correct units, appropriate instrument use, unit conversions, dimensional analysis, accuracy and precision, technology, upper-level math, engineering applications, and probes.
2. Data Analysis: data collection, organization, variable identification, graph components, graph construction, variable relationships, calculations, trend identification, technology such as Google Sheets, verbal graph summaries, complex statistics, and evaluating data validity.
3. Communication in Science: reading scientific text, hypothesis writing, papers and presentations, following and writing lab procedures, conclusions supported by data, claim analysis, word problems, full lab reports, peer review, CER, primary literature, evaluating claims, and identifying pseudoscience.

Grade progression:
Freshman/9th grade focuses on foundations: measuring, estimation, units, instrument use, data collection, variable identification, data organization, graph parts, graphing preorganized data, reading science texts, hypothesis writing, papers or presentations, and following lab procedure.
Sophomore/10th grade extends the foundations: unit conversions, derived units, dimensional analysis, variable relationships, calculations, trend identification, Google Sheets, verbal graph summaries, graphing obtained data, procedures, conclusions, claim analysis, presentations, and word problems.
Junior/Senior/11th-12th grade emphasizes enrichment and transfer: accuracy and precision, upper-level math, technology and probes, engineering applications, complex statistical analysis, advanced graph and data analysis, full lab reports, peer review, CER, primary research, evaluating invalid claims, and pseudoscience.

ACT science transfer: the framework should help students read passages, interpret graphs/tables, reason from evidence, compare data sets, evaluate claims, and apply scientific reasoning without abandoning science content.
`;

export const FRAMEWORK_DOMAINS = [
  {
    id: 'measurement',
    name: 'Measurement',
    color: 'green',
    description: 'Students collect reliable measurements with correct units, instruments, precision, conversions, and technology.',
    categories: [
      {
        name: 'Measuring',
        keywords: ['measure', 'measurement', 'measuring technique', 'length', 'mass', 'volume', 'temperature', 'time']
      },
      {
        name: 'Estimation',
        keywords: ['estimate', 'estimation', 'predict measurement', 'reasonable estimate']
      },
      {
        name: 'Correct units',
        keywords: ['unit', 'units', 'metric', 'si unit', 'grams', 'meters', 'liters', 'celsius']
      },
      {
        name: 'Instrument use',
        keywords: ['instrument', 'graduated cylinder', 'balance', 'thermometer', 'probe', 'ruler', 'meter stick', 'microscope']
      },
      {
        name: 'Unit conversions',
        keywords: ['conversion', 'convert', 'derived unit', 'dimensional analysis', 'factor label']
      },
      {
        name: 'Accuracy and precision',
        keywords: ['accuracy', 'precision', 'significant figures', 'sig figs', 'uncertainty', 'error analysis']
      },
      {
        name: 'Technology and upper-level math',
        keywords: ['vernier', 'sensor', 'calculator', 'technology', 'engineering', 'trigonometry', 'calculus']
      }
    ],
    gradeBands: {
      freshman: ['Measuring', 'Estimation', 'Correct units', 'Instrument use'],
      sophomore: ['Measuring', 'Estimation', 'Correct units', 'Instrument use', 'Unit conversions'],
      upper: ['Accuracy and precision', 'Technology and upper-level math', 'Instrument use']
    }
  },
  {
    id: 'dataAnalysis',
    name: 'Data Analysis',
    color: 'blue',
    description: 'Students organize, graph, calculate, interpret, and evaluate data to identify relationships and trends.',
    categories: [
      {
        name: 'Data collection',
        keywords: ['data collection', 'collect data', 'qualitative', 'quantitative', 'observation', 'trial']
      },
      {
        name: 'Data organization',
        keywords: ['organize data', 'data table', 'table', 'record data', 'labels']
      },
      {
        name: 'Variable identification',
        keywords: ['variable', 'independent variable', 'dependent variable', 'control variable', 'constant']
      },
      {
        name: 'Graph components',
        keywords: ['graph', 'axis', 'axes', 'title', 'legend', 'scale', 'data points']
      },
      {
        name: 'Graph construction',
        keywords: ['construct a graph', 'create a graph', 'plot', 'scatter plot', 'line graph', 'bar graph']
      },
      {
        name: 'Relationships among variables',
        keywords: ['relationship', 'direct', 'indirect', 'exponential', 'correlation', 'proportional']
      },
      {
        name: 'Calculations',
        keywords: ['calculate', 'calculation', 'rate', 'average', 'slope', 'percent', 'formula']
      },
      {
        name: 'Trend identification',
        keywords: ['trend', 'pattern', 'outlier', 'prediction', 'extrapolate', 'interpolate']
      },
      {
        name: 'Technology for analysis',
        keywords: ['google sheets', 'spreadsheet', 'technology', 'digital graph', 'software']
      },
      {
        name: 'Complex statistics',
        keywords: ['statistics', 'standard deviation', 'regression', 'statistical analysis', 'validity']
      }
    ],
    gradeBands: {
      freshman: ['Data collection', 'Data organization', 'Variable identification', 'Graph components', 'Graph construction'],
      sophomore: ['Relationships among variables', 'Calculations', 'Trend identification', 'Technology for analysis', 'Graph construction'],
      upper: ['Complex statistics', 'Technology for analysis', 'Relationships among variables', 'Trend identification']
    }
  },
  {
    id: 'communication',
    name: 'Communication in Science',
    color: 'teal',
    description: 'Students read, write, present, critique, and argue from scientific evidence using lab reports, CER, and research.',
    categories: [
      {
        name: 'Reading scientific text',
        keywords: ['read', 'reading', 'textbook', 'article', 'passage', 'scientific text']
      },
      {
        name: 'Hypothesis writing',
        keywords: ['hypothesis', 'testable hypothesis', 'prediction', 'research question']
      },
      {
        name: 'Papers and presentations',
        keywords: ['paper', 'presentation', 'present', 'poster', 'slide', 'citations']
      },
      {
        name: 'Lab procedure',
        keywords: ['procedure', 'lab procedure', 'method', 'steps', 'safety']
      },
      {
        name: 'Conclusions',
        keywords: ['conclusion', 'findings', 'supported by data', 'limitations']
      },
      {
        name: 'Claim analysis',
        keywords: ['claim', 'evaluate claims', 'bias', 'logical fallacy', 'argument']
      },
      {
        name: 'Word problems',
        keywords: ['word problem', 'multi step', 'extract information', 'equation']
      },
      {
        name: 'Full lab reports',
        keywords: ['lab report', 'introduction', 'methods', 'results', 'discussion']
      },
      {
        name: 'Peer review',
        keywords: ['peer review', 'critique', 'feedback', 'classmate']
      },
      {
        name: 'CER',
        keywords: ['cer', 'claim evidence reasoning', 'evidence and reasoning', 'reasoning']
      },
      {
        name: 'Primary research and pseudoscience',
        keywords: ['primary literature', 'research paper', 'pseudoscience', 'fake news', 'invalid claim']
      }
    ],
    gradeBands: {
      freshman: ['Reading scientific text', 'Hypothesis writing', 'Papers and presentations', 'Lab procedure'],
      sophomore: ['Lab procedure', 'Conclusions', 'Claim analysis', 'Word problems', 'Papers and presentations'],
      upper: ['Full lab reports', 'Peer review', 'CER', 'Primary research and pseudoscience']
    }
  }
];

export const GRADE_BANDS = [
  {
    id: 'freshman',
    label: 'Freshman / 9th',
    keywords: ['freshman', '9th', 'ninth', 'biology', 'honors bio', 'integrated biology', 'i.bio']
  },
  {
    id: 'sophomore',
    label: 'Sophomore / 10th',
    keywords: ['sophomore', '10th', 'tenth', 'chemistry', 'honors chem', 'n/s chem']
  },
  {
    id: 'upper',
    label: 'Junior/Senior / 11th-12th',
    keywords: ['junior', 'senior', '11th', '12th', 'ap chem', 'physics', 'honors physics', 'environmental science', 'anatomy', 'bio 2', 'zoology']
  }
];

export function scoreToRating(score) {
  if (score >= 85) return 'Strongly aligned';
  if (score >= 70) return 'Aligned';
  if (score >= 55) return 'Developing';
  if (score >= 40) return 'Emerging';
  return 'Not yet aligned';
}
