import * as db from './db.js';

let currentExam = null;
let timerInterval = null;

export function initQuiz() {
  document.getElementById('exam-submit').addEventListener('click', () => submitExam(false));
  document.getElementById('exam-abort').addEventListener('click', () => submitExam(true));
}

export async function refreshExamSetup() {
  const all = await db.getAllQuestions();
  const container = document.getElementById('exam-setup-form');

  if (all.length === 0) {
    container.innerHTML = `<p class="hint" style="text-align:center;padding:40px 0;">
      Aucune question disponible. <a href="#import">Importe d'abord un fichier JSON.</a>
    </p>`;
    return;
  }

  // Regrouper matières / chapitres
  const matieres = {};
  for (const q of all) {
    matieres[q.matiere] = matieres[q.matiere] || {};
    matieres[q.matiere][q.chapitre] = (matieres[q.matiere][q.chapitre] || 0) + 1;
  }

  container.innerHTML = `
    <div class="setup-field">
      <label class="title">Matière</label>
      <select id="setup-matiere">
        <option value="">— Toutes les matières —</option>
        ${Object.keys(matieres).sort().map(m => `<option value="${escapeAttr(m)}">${escapeHtml(m)}</option>`).join('')}
      </select>
    </div>

    <div class="setup-field" id="setup-chapitres-field">
      <label class="title">Chapitres <span class="hint">(cliquer pour filtrer)</span></label>
      <div class="chip-group" id="setup-chapitres"></div>
    </div>

    <div class="setup-field">
      <label class="title">Difficulté</label>
      <div class="chip-group" id="setup-difficulte">
        <label class="chip selected"><input type="radio" name="difficulte" value="all" checked>Toutes</label>
        <label class="chip"><input type="radio" name="difficulte" value="1">Facile (N1)</label>
        <label class="chip"><input type="radio" name="difficulte" value="12">Facile + Moyen</label>
        <label class="chip"><input type="radio" name="difficulte" value="23">Moyen + Difficile</label>
        <label class="chip"><input type="radio" name="difficulte" value="3">Difficile (N3)</label>
      </div>
    </div>

    <div class="setup-field">
      <label class="title">Nombre de questions</label>
      <select id="setup-count">
        <option value="10">10</option>
        <option value="20" selected>20</option>
        <option value="30">30</option>
        <option value="50">50</option>
        <option value="all">Toutes</option>
      </select>
    </div>

    <div class="preview-count" id="setup-preview"></div>

    <button class="btn btn-primary btn-block" id="setup-launch">Lancer l'examen</button>
  `;

  const matSelect = document.getElementById('setup-matiere');
  const diffRadios = document.querySelectorAll('input[name="difficulte"]');
  const countSelect = document.getElementById('setup-count');

  function refreshChapitres() {
    const m = matSelect.value;
    const chapBox = document.getElementById('setup-chapitres');
    const chapField = document.getElementById('setup-chapitres-field');
    if (!m) {
      chapField.style.display = 'none';
      chapBox.innerHTML = '';
      return;
    }
    chapField.style.display = '';
    const chaps = Object.keys(matieres[m]);
    chapBox.innerHTML = chaps.map(c => `
      <label class="chip selected">
        <input type="checkbox" class="chap-check" value="${escapeAttr(c)}" checked>
        ${escapeHtml(c)} <span class="hint">(${matieres[m][c]})</span>
      </label>
    `).join('');
    chapBox.querySelectorAll('.chip').forEach(chip => {
      const input = chip.querySelector('input');
      chip.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') input.checked = !input.checked;
        chip.classList.toggle('selected', input.checked);
        updatePreview();
      });
    });
    updatePreview();
  }

  function getFilters() {
    const m = matSelect.value;
    const chaps = m
      ? Array.from(document.querySelectorAll('.chap-check:checked')).map(i => i.value)
      : [];
    const diff = document.querySelector('input[name="difficulte"]:checked').value;
    const count = countSelect.value;
    return { matiere: m, chapitres: chaps, diff, count };
  }

  function filterQuestions() {
    const f = getFilters();
    let qs = all;
    if (f.matiere) qs = qs.filter(q => q.matiere === f.matiere);
    if (f.matiere && f.chapitres.length > 0) qs = qs.filter(q => f.chapitres.includes(q.chapitre));
    if (f.diff === '1') qs = qs.filter(q => q.niveau === 1);
    else if (f.diff === '3') qs = qs.filter(q => q.niveau === 3);
    else if (f.diff === '12') qs = qs.filter(q => q.niveau <= 2);
    else if (f.diff === '23') qs = qs.filter(q => q.niveau >= 2);
    return qs;
  }

  function updatePreview() {
    const pool = filterQuestions();
    const f = getFilters();
    const finalCount = f.count === 'all' ? pool.length : Math.min(parseInt(f.count), pool.length);
    document.getElementById('setup-preview').innerHTML =
      `<strong>${finalCount}</strong> question(s) sélectionnée(s)<br><span class="hint">sur ${pool.length} disponible(s)</span>`;
    document.getElementById('setup-launch').disabled = finalCount === 0;
  }

  matSelect.addEventListener('change', refreshChapitres);
  diffRadios.forEach(r => r.addEventListener('change', (e) => {
    document.querySelectorAll('#setup-difficulte .chip').forEach(c => c.classList.toggle('selected', c.querySelector('input').checked));
    updatePreview();
  }));
  countSelect.addEventListener('change', updatePreview);

  document.getElementById('setup-launch').addEventListener('click', () => launchExam());

  refreshChapitres();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function launchExam() {
  // Récupérer les filtres depuis le DOM (recalcul identique à refreshExamSetup)
  const matiere = document.getElementById('setup-matiere').value;
  const chapitres = matiere
    ? Array.from(document.querySelectorAll('.chap-check:checked')).map(i => i.value)
    : [];
  const diff = document.querySelector('input[name="difficulte"]:checked').value;
  const count = document.getElementById('setup-count').value;

  // Reconstruire le pool
  db.getAllQuestions().then(all => {
    let qs = all;
    if (matiere) qs = qs.filter(q => q.matiere === matiere);
    if (matiere && chapitres.length > 0) qs = qs.filter(q => chapitres.includes(q.chapitre));
    if (diff === '1') qs = qs.filter(q => q.niveau === 1);
    else if (diff === '3') qs = qs.filter(q => q.niveau === 3);
    else if (diff === '12') qs = qs.filter(q => q.niveau <= 2);
    else if (diff === '23') qs = qs.filter(q => q.niveau >= 2);

    qs = shuffle(qs);
    const finalCount = count === 'all' ? qs.length : Math.min(parseInt(count), qs.length);
    qs = qs.slice(0, finalCount);

    if (qs.length === 0) return;

    currentExam = {
      questions: qs,
      startedAt: Date.now(),
      filter: { matiere, chapitres, diff, count },
    };

    renderExam();
    window.__showScreen('exam');
    startTimer();
  });
}

function renderExam() {
  const container = document.getElementById('exam-questions');
  container.innerHTML = currentExam.questions.map((q, idx) => {
    const inputType = q.type === 'QCS' ? 'radio' : 'checkbox';
    return `
      <div class="q-card" data-qid="${escapeAttr(q.id)}">
        <div class="q-header">
          <span class="q-num">Q${idx + 1}</span>
          <span class="q-meta">${q.type} · N${q.niveau} · ${escapeHtml(q.matiere)}</span>
        </div>
        <p class="q-enonce">${escapeHtml(q.enonce)}</p>
        <div class="q-props">
          ${q.propositions.map(p => `
            <label class="prop">
              <input type="${inputType}" name="q_${escapeAttr(q.id)}" value="${escapeAttr(p.lettre)}">
              <span class="prop-letter">${escapeHtml(p.lettre)}</span>
              <span class="prop-text">${escapeHtml(p.texte)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('exam-progress').textContent = `0/${currentExam.questions.length}`;
  document.getElementById('exam-timer').textContent = '00:00';

  // Met à jour le compteur répondu
  container.addEventListener('change', () => {
    const answered = currentExam.questions.filter(q => {
      const checked = document.querySelectorAll(`input[name="q_${CSS.escape(q.id)}"]:checked`);
      return checked.length > 0;
    }).length;
    document.getElementById('exam-progress').textContent = `${answered}/${currentExam.questions.length}`;
  });
}

function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    if (!currentExam) return;
    const s = Math.floor((Date.now() - currentExam.startedAt) / 1000);
    document.getElementById('exam-timer').textContent =
      String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

async function submitExam(abort) {
  if (!currentExam) return;
  if (abort) {
    if (!confirm('Abandonner l\'examen ? La progression sera perdue.')) return;
    stopTimer();
    currentExam = null;
    window.__showScreen('home');
    return;
  }

  const unanswered = currentExam.questions.filter(q => {
    return document.querySelectorAll(`input[name="q_${CSS.escape(q.id)}"]:checked`).length === 0;
  }).length;

  const msg = unanswered > 0
    ? `Il reste ${unanswered} question(s) sans réponse. Terminer quand même ?`
    : 'Terminer l\'examen ?';
  if (!confirm(msg)) return;

  // Collecte des réponses
  const answers = {};
  for (const q of currentExam.questions) {
    const checked = document.querySelectorAll(`input[name="q_${CSS.escape(q.id)}"]:checked`);
    answers[q.id] = Array.from(checked).map(i => i.value);
  }

  const durationSec = Math.round((Date.now() - currentExam.startedAt) / 1000);
  const results = currentExam.questions.map(q => scoreQuestion(q, answers[q.id] || []));
  const score = results.filter(r => r.correct).length;

  const session = {
    id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    date: new Date().toISOString(),
    filter: currentExam.filter,
    durationSec,
    score,
    total: currentExam.questions.length,
    details: results.map((r, i) => ({
      qid: currentExam.questions[i].id,
      answer: answers[currentExam.questions[i].id] || [],
      correct: r.correct,
    })),
  };
  await db.saveSession(session);

  // Mettre à jour les stats par question
  const updates = currentExam.questions.map((q, i) => ({
    ...q,
    stats: {
      seen: (q.stats?.seen || 0) + 1,
      correct: (q.stats?.correct || 0) + (results[i].correct ? 1 : 0),
    },
  }));
  await db.putQuestions(updates);

  // Afficher les résultats
  stopTimer();
  renderResults(session, currentExam.questions, results);
  currentExam = null;
  window.__showScreen('results');
}

function scoreQuestion(q, userAnswer) {
  const correct = q.propositions.filter(p => p.correcte).map(p => p.lettre).sort();
  const user = [...userAnswer].sort();
  const ok = correct.length === user.length && correct.every((c, i) => c === user[i]);
  return { correct: ok, correctAnswer: correct, userAnswer: user };
}

function renderResults(session, questions, results) {
  const pct = Math.round((session.score / session.total) * 100);
  const mins = Math.floor(session.durationSec / 60);
  const secs = session.durationSec % 60;

  document.getElementById('results-summary').innerHTML = `
    <div class="results-hero">
      <p class="results-score">${session.score}/${session.total}</p>
      <p class="results-label">${pct}% · ${mins}min ${secs}s</p>
    </div>
  `;

  document.getElementById('results-questions').innerHTML = questions.map((q, idx) => {
    const r = results[idx];
    return `
      <div class="res-q ${r.correct ? 'correct' : 'wrong'}">
        <div class="res-q-status">${r.correct ? '✓ Correct' : '✗ Incorrect'} — Q${idx + 1} · ${q.type} · N${q.niveau}</div>
        <p class="q-enonce">${escapeHtml(q.enonce)}</p>
        ${q.propositions.map(p => {
          const isCorrect = p.correcte;
          const userPicked = r.userAnswer.includes(p.lettre);
          let cls = '';
          let marker = '·';
          if (isCorrect && userPicked) { cls = 'is-correct'; marker = '✓'; }
          else if (!isCorrect && userPicked) { cls = 'is-wrong'; marker = '✗'; }
          else if (isCorrect && !userPicked) { cls = 'missed'; marker = '⚠'; }
          return `
            <div class="res-prop ${cls}">
              <span class="marker">${marker}</span>
              <span><strong>${escapeHtml(p.lettre)}.</strong> ${escapeHtml(p.texte)}</span>
            </div>
          `;
        }).join('')}
        ${q.explication ? `<div class="explication">${escapeHtml(q.explication)}</div>` : ''}
      </div>
    `;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s);
}
