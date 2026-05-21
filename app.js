const state = {
  artifacts: [],
  assignments: [],
  recommendations: [],
  aggregate: null,
  plc: null
};

const views = Array.from(document.querySelectorAll('.view'));
const navItems = Array.from(document.querySelectorAll('.nav-item'));
const toastRegion = document.querySelector('#toastRegion');

navItems.forEach(button => {
  button.addEventListener('click', () => switchView(button.dataset.view));
});

document.querySelectorAll('[data-view-link]').forEach(button => {
  button.addEventListener('click', () => switchView(button.dataset.viewLink));
});

document.querySelector('#brainForm').addEventListener('submit', async event => {
  event.preventDefault();
  const files = document.querySelector('#brainFiles').files;
  if (!files.length) {
    return showToast('Select at least one artifact first.');
  }

  const response = await uploadFiles('/api/department-brain/upload', files, 'Rating documents against the framework...', {
    scope: document.querySelector('#brainScope').value,
    course: document.querySelector('#brainCourse').value,
    gradeBand: document.querySelector('#brainGradeBand').value
  });
  state.artifacts = response.insights || [];
  state.aggregate = response.aggregate || null;
  renderBrainResults();
  renderDashboard();
  showToast(`${state.artifacts.length} document${state.artifacts.length === 1 ? '' : 's'} rated.`);
});

document.querySelector('#alignerForm').addEventListener('submit', async event => {
  event.preventDefault();
  const files = document.querySelector('#assignmentFiles').files;
  if (!files.length) {
    return showToast('Select at least one assignment first.');
  }

  const response = await uploadFiles('/api/assignment-aligner/analyze', files, 'Rating assignments against the framework...', {
    scope: 'assignment',
    course: document.querySelector('#assignmentCourse').value,
    gradeBand: document.querySelector('#assignmentGradeBand').value
  });
  state.assignments = response.analyses || [];
  state.aggregate = response.aggregate || state.aggregate;
  renderAlignerResults();
  renderDashboard();
  showToast(`${state.assignments.length} assignment${state.assignments.length === 1 ? '' : 's'} rated.`);
});

document.querySelector('#consultantForm').addEventListener('submit', async event => {
  event.preventDefault();
  const response = await postJson('/api/consultant/analyze', {
    departmentReflection: document.querySelector('#reflection').value,
    departmentScore: {
      vocabulary: Number(document.querySelector('#scoreVocabulary').value),
      alignment: Number(document.querySelector('#scoreAlignment').value),
      assessments: Number(document.querySelector('#scoreAssessments').value),
      act: Number(document.querySelector('#scoreAct').value)
    }
  }, 'Generating recommendations...');

  state.recommendations = response.recommendations || [];
  renderConsultantResults();
  renderDashboard();
  showToast('Recommendation plan generated.');
});

document.querySelector('#plcForm').addEventListener('submit', async event => {
  event.preventDefault();
  const response = await postJson('/api/plc/insights', {
    course: document.querySelector('#course').value,
    grade: document.querySelector('#grade').value,
    domain: document.querySelector('#domain').value,
    skill: document.querySelector('#skill').value
  }, 'Building PLC action brief...');

  state.plc = response;
  renderPlcResults();
  renderDashboard();
  showToast('PLC action brief ready.');
});

checkBackend();
 renderDashboard();

function switchView(viewId) {
  views.forEach(view => {
    view.classList.toggle('active', view.id === viewId);
  });

  navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.view === viewId);
  });

  const activeView = document.querySelector(`#${viewId}`);
  document.querySelector('#viewTitle').textContent = activeView?.dataset.title || 'Dashboard';
}

async function checkBackend() {
  const dot = document.querySelector('#backendDot');
  const label = document.querySelector('#backendStatus');

  try {
    const response = await fetch('/health');
    if (!response.ok) throw new Error('Unhealthy response');
    const payload = await response.json();
    dot.className = 'status-dot online';
    label.textContent = payload.aiEnabled ? 'Online with AI key' : 'Online with local rubric';
  } catch {
    dot.className = 'status-dot offline';
    label.textContent = 'Offline';
  }
}

async function uploadFiles(endpoint, files, pendingMessage, metadata = {}) {
  showToast(pendingMessage);
  const formData = new FormData();
  Object.entries(metadata).forEach(([key, value]) => formData.append(key, value));
  Array.from(files).forEach(file => formData.append('files', file));

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData
  });

  return handleResponse(response);
}

async function postJson(endpoint, body, pendingMessage) {
  showToast(pendingMessage);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  return handleResponse(response);
}

async function handleResponse(response) {
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload;
}

function renderDashboard() {
  document.querySelector('#artifactCount').textContent = String(state.artifacts.length);
  document.querySelector('#avgScore').textContent = currentScores().length ? `${averageScore()}%` : '--';
  document.querySelector('#frameworkSignal').textContent = state.aggregate?.rating || state.plc?.result || 'Ready';

  setDomainSignal('Measurement', '#measurementSignal');
  setDomainSignal('Data Analysis', '#analysisSignal');
  setDomainSignal('Communication', '#communicationSignal');

  const recommendationPreview = document.querySelector('#recommendationPreview');
  if (state.recommendations.length) {
    recommendationPreview.innerHTML = state.recommendations
      .slice(0, 3)
      .map(item => `<li>${escapeHtml(item.title)}: ${escapeHtml(item.recommendations[0])}</li>`)
      .join('');
  } else {
    recommendationPreview.innerHTML = '<li>Use the Consultant tab to generate recommendations.</li>';
  }

  const scorePreview = document.querySelector('#scorePreview');
  if (state.assignments.length) {
    scorePreview.classList.remove('empty-state');
    scorePreview.innerHTML = state.assignments
      .slice(0, 3)
      .map(item => `
        <article class="result-card">
          <h4>${escapeHtml(item.name)}</h4>
          <p><strong>${item.score}%</strong> framework score</p>
        </article>
      `)
      .join('');
  } else {
    scorePreview.className = 'empty-state';
    scorePreview.textContent = 'Upload an assignment to see scores.';
  }
}

function renderBrainResults() {
  document.querySelector('#brainCount').textContent = `${state.artifacts.length} processed`;
  const target = document.querySelector('#brainResults');

  if (!state.artifacts.length) {
    target.className = 'result-stack empty-state';
    target.textContent = 'No artifact insights yet.';
    return;
  }

  target.className = 'result-stack';
  target.innerHTML = `${renderAggregate(state.aggregate)}${state.artifacts.map(renderFrameworkCard).join('')}`;
}

function renderConsultantResults() {
  document.querySelector('#consultantCount').textContent = `${state.recommendations.length} focus areas`;
  const target = document.querySelector('#consultantResults');

  if (!state.recommendations.length) {
    target.className = 'result-stack empty-state';
    target.textContent = 'Recommendations will appear here.';
    return;
  }

  target.className = 'result-stack';
  target.innerHTML = state.recommendations.map(item => `
    <article class="result-card">
      <h4>${escapeHtml(item.title)}</h4>
      <ul>
        ${(item.recommendations || []).map(action => `<li>${escapeHtml(action)}</li>`).join('')}
      </ul>
    </article>
  `).join('');
}

function renderAlignerResults() {
  document.querySelector('#alignerCount').textContent = `${state.assignments.length} scored`;
  const target = document.querySelector('#alignerResults');

  if (!state.assignments.length) {
    target.className = 'result-stack empty-state';
    target.textContent = 'No assignment scores yet.';
    return;
  }

  target.className = 'result-stack';
  target.innerHTML = `${renderAggregate(state.aggregate)}${state.assignments.map(renderFrameworkCard).join('')}`;
}

function renderPlcResults() {
  const target = document.querySelector('#plcResults');
  document.querySelector('#plcCount').textContent = state.plc?.result || 'Ready';

  if (!state.plc) {
    target.className = 'result-stack empty-state';
    target.textContent = 'Submit a PLC focus to see the action brief.';
    return;
  }

  target.className = 'result-stack';
  target.innerHTML = `
    <article class="result-card">
      <h4>${escapeHtml(state.plc.course)} ${escapeHtml(state.plc.grade)}: ${escapeHtml(state.plc.skill)}</h4>
      <div class="pill-row">
        <span class="pill">${escapeHtml(state.plc.domain)}</span>
        <span class="pill">${escapeHtml(state.plc.result)}</span>
      </div>
      <p>${escapeHtml(state.plc.action)}</p>
      <ul>${(state.plc.nextSteps || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ul>
    </article>
  `;
}

function setDomainSignal(domain, selector) {
  const scores = [...state.artifacts, ...state.assignments]
    .map(item => (item.domainScores || item.frameworkAnalysis?.domainScores || []).find(score => sameDomain(score.domain, domain))?.score)
    .filter(Number.isFinite);
  document.querySelector(selector).textContent = scores.length ? `${Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)}% average` : 'No artifacts yet';
}

function sameDomain(actual, expected) {
  const actualText = String(actual || '').toLowerCase();
  const expectedText = String(expected || '').toLowerCase();
  return actualText === expectedText || actualText.includes(expectedText) || expectedText.includes(actualText);
}

function averageScore() {
  const scores = currentScores();
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round(total / scores.length);
}

function currentScores() {
  return [...state.artifacts, ...state.assignments]
    .map(item => Number(item.overallScore || item.score || 0))
    .filter(score => Number.isFinite(score) && score > 0);
}

function renderAggregate(aggregate) {
  if (!aggregate) return '';

  return `
    <article class="result-card aggregate-card">
      <div class="score-card">
        <div class="score-badge">${aggregate.score}%</div>
        <div>
          <h4>${escapeHtml(aggregate.rating)}</h4>
          <p>${escapeHtml(aggregate.summary)}</p>
          <div class="domain-score-list">
            ${(aggregate.domainAverages || []).map(renderDomainScore).join('')}
          </div>
        </div>
      </div>
      <p><strong>Suggested PLC moves</strong></p>
      <ul>${(aggregate.nextSteps || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ul>
    </article>
  `;
}

function renderFrameworkCard(item) {
  const analysis = item.frameworkAnalysis || item;
  const isAssignment = String(analysis.scope || '').toLowerCase() === 'assignment'
    || String(analysis.type || '').toLowerCase().includes('assignment')
    || String(analysis.type || '').toLowerCase().includes('project');
  const evidenceLabel = isAssignment ? 'Expected student evidence' : 'Evidence';
  const nextStepsLabel = isAssignment ? 'Assignment revision moves' : 'Next steps';
  return `
    <article class="result-card">
      <div class="score-card">
        <div class="score-badge">${Number(analysis.overallScore || item.score || 0)}%</div>
        <div>
          <h4>${escapeHtml(analysis.name || item.name)}</h4>
          <div class="pill-row">
            <span class="pill">${escapeHtml(analysis.rating || 'Rated')}</span>
            <span class="pill">${escapeHtml(analysis.type || 'Artifact')}</span>
            <span class="pill">${escapeHtml(analysis.gradeBand || 'Grade band')}</span>
            <span class="pill">${escapeHtml(analysis.analysisMode || 'Local rubric')}</span>
          </div>
          <p>${escapeHtml(analysis.summary || '')}</p>
        </div>
      </div>
      <div class="domain-score-list">
        ${(analysis.domainScores || []).map(renderDomainScore).join('')}
      </div>
      <div class="evidence-grid">
        <div>
          <p><strong>${evidenceLabel}</strong></p>
          <ul>${(analysis.evidence || item.strengths || []).slice(0, 4).map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
        </div>
        <div>
          <p><strong>${nextStepsLabel}</strong></p>
          <ul>${(analysis.nextSteps || item.improvements || []).slice(0, 4).map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
        </div>
      </div>
      ${analysis.aiNote ? `<p class="source-note">${escapeHtml(analysis.aiNote)}</p>` : ''}
    </article>
  `;
}

function renderDomainScore(score) {
  const value = Number(score.score || 0);
  return `
    <div class="score-row">
      <div>
        <strong>${escapeHtml(score.domain)}</strong>
        <span>${escapeHtml(score.rating || '')}</span>
      </div>
      <div class="score-track" aria-hidden="true">
        <span class="score-fill" style="width: ${Math.max(0, Math.min(100, value))}%"></span>
      </div>
      <b>${value}%</b>
    </div>
  `;
}

function showToast(message) {
  const template = document.querySelector('#toastTemplate');
  const toast = template.content.firstElementChild.cloneNode(true);
  toast.textContent = message;
  toastRegion.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
