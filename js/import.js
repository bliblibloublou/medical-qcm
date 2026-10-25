import * as db from './db.js';

let parsed = null;

export function initImport() {
  document.getElementById('import-analyze').addEventListener('click', analyze);
  document.getElementById('import-file').addEventListener('change', handleFile);
  document.getElementById('import-cancel').addEventListener('click', reset);
  document.getElementById('import-confirm').addEventListener('click', confirmImport);
}

function handleFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById('import-textarea').value = reader.result;
  };
  reader.readAsText(file);
}

function reset() {
  document.getElementById('import-input-view').classList.remove('hidden');
  document.getElementById('import-preview-view').classList.add('hidden');
  document.getElementById('import-textarea').value = '';
  document.getElementById('import-file').value = '';
  document.getElementById('import-status').classList.add('hidden');
  parsed = null;
}

function showStatus(msg, kind = 'info') {
  const el = document.getElementById('import-status');
  el.textContent = msg;
  el.className = 'status-box ' + kind;
  el.classList.remove('hidden');
}

async function analyze() {
  const raw = document.getElementById('import-textarea').value.trim();
  if (!raw) { showStatus('Rien à analyser.', 'error'); return; }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    showStatus('JSON invalide : ' + e.message, 'error');
    return;
  }

  let questionsArr, meta;
  if (Array.isArray(data)) {
    questionsArr = data;
    meta = {};
  } else if (data && Array.isArray(data.questions)) {
    questionsArr = data.questions.map(q => ({
      ...q,
      matiere: q.matiere || data.matiere,
      chapitre: q.chapitre || data.chapitre,
      source: q.source || data.source,
    }));
    meta = {
      matiere: data.matiere || '',
      chapitre: data.chapitre || '',
      schemaVersion: data.schemaVersion || 1,
    };
  } else {
    showStatus('Format non reconnu : attendu { questions: [...] } ou un tableau.', 'error');
    return;
  }

  const errors = [];
  const valid = [];
  questionsArr.forEach((q, idx) => {
    const r = validateQuestion(q, idx);
    if (r.valid) valid.push(r.question);
    else errors.push({ index: idx, enonce: (q.enonce || '').slice(0, 80), errors: r.errors });
  });

  // ⚠️ CORRECTIF v1.1 : dédoublonner les IDs au sein du même lot
  const seenIds = new Set();
  valid.forEach(q => {
    if (seenIds.has(q.id)) {
      const base = q.id;
      let n = 1;
      while (seenIds.has(base + '_' + n)) n++;
      q.id = base + '_' + n;
    }
    seenIds.add(q.id);
  });

  const existing = await db.getAllQuestions();
  const byId = new Map(existing.map(q => [q.id, q]));
  const byHash = new Map(existing.map(q => [hashEnonce(q.enonce), q]));
  const duplicates = [];
  for (const q of valid) {
    const dup = byId.get(q.id) || byHash.get(hashEnonce(q.enonce));
    if (dup) duplicates.push({ newQ: q, existing: dup });
  }

  parsed = { valid, errors, duplicates, meta };
  renderPreview();
}

function validateQuestion(q, index) {
  const errors = [];

  if (!q.enonce || typeof q.enonce !== 'string' || !q.enonce.trim()) {
    errors.push('Énoncé vide.');
  }
  const type = String(q.type || '').toUpperCase();
  if (type !== 'QCS' && type !== 'QRM') {
    errors.push(`Type invalide : "${q.type}" (attendu QCS ou QRM).`);
  }
  if (!Array.isArray(q.propositions) || q.propositions.length < 3) {
    errors.push('Il faut au moins 3 propositions.');
  } else {
    q.propositions.forEach((p, i) => {
      if (!p.texte) errors.push(`Proposition ${i + 1} sans texte.`);
      if (typeof p.correcte !== 'boolean') errors.push(`Proposition ${i + 1} : "correcte" manquant.`);
    });
  }

  const nbCorrect = (q.propositions || []).filter(p => p.correcte === true).length;
  if (type === 'QCS' && nbCorrect !== 1) {
    errors.push(`QCS doit avoir exactement 1 bonne réponse (actuellement ${nbCorrect}).`);
  }
  if (type === 'QRM' && (nbCorrect < 2 || nbCorrect > 4)) {
    errors.push(`QRM doit avoir 2 à 4 bonnes réponses (actuellement ${nbCorrect}).`);
  }

  if (errors.length > 0) return { valid: false, errors };

  const niveau = [1, 2, 3].includes(Number(q.niveau)) ? Number(q.niveau) : 2;

  return {
    valid: true,
    question: {
      id: String(q.id || genId(q.enonce)),
      type,
      niveau,
      enonce: q.enonce.trim(),
      propositions: q.propositions.map((p, i) => ({
        lettre: p.lettre || String.fromCharCode(65 + i),
        texte: p.texte,
        correcte: p.correcte === true,
      })),
      explication: q.explication || '',
      matiere: q.matiere || 'Sans matière',
      chapitre: q.chapitre || 'Sans chapitre',
      source: q.source || '',
      tags: Array.isArray(q.tags) ? q.tags : [],
      stats: { seen: 0, correct: 0 },
      importedAt: new Date().toISOString(),
    },
  };
}

function genId(text) {
  let h = 0;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return 'q_' + Math.abs(h).toString(36);
}

function hashEnonce(text) {
  return String(text).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
}

function renderPreview() {
  document.getElementById('import-input-view').classList.add('hidden');
  document.getElementById('import-preview-view').classList.remove('hidden');

  document.getElementById('import-matiere').value = parsed.meta.matiere || '';
  document.getElementById('import-chapitre').value = parsed.meta.chapitre || '';

  const summary = document.getElementById('import-summary');
  const total = parsed.valid.length + parsed.errors.length;
  summary.innerHTML = `
    <div><strong>${total}</strong> question(s) analysée(s)</div>
    <div><span class="ok">${parsed.valid.length} valide(s)</span> · <span class="err">${parsed.errors.length} erreur(s)</span> · <span class="dup">${parsed.duplicates.length} doublon(s)</span></div>
  `;

  const errBox = document.getElementById('import-errors');
  if (parsed.errors.length === 0) {
    errBox.innerHTML = '';
  } else {
    errBox.innerHTML = `
      <details class="err-list">
        <summary>⚠️ Voir les ${parsed.errors.length} erreur(s)</summary>
        ${parsed.errors.map(e => `
          <div class="err-item">
            <strong>Question #${e.index + 1}</strong> — ${escapeHtml(e.enonce)}<br>
            ${e.errors.map(x => '• ' + escapeHtml(x)).join('<br>')}
          </div>
        `).join('')}
      </details>
    `;
  }

  const dupBox = document.getElementById('import-duplicates');
  if (parsed.duplicates.length > 0) {
    dupBox.innerHTML = `<p class="hint" style="margin-top:12px;">⚠️ ${parsed.duplicates.length} doublon(s) détecté(s) — coche/décoche « Remplacer » ci-dessus.</p>`;
  } else {
    dupBox.innerHTML = '';
  }

  document.getElementById('import-replace').checked = true;
  updateConfirmLabel();
  document.getElementById('import-replace').onchange = updateConfirmLabel;
}

function updateConfirmLabel() {
  const replace = document.getElementById('import-replace').checked;
  const dupIds = new Set(parsed.duplicates.map(d => d.newQ.id));
  const toImport = replace
    ? parsed.valid.length
    : parsed.valid.filter(q => !dupIds.has(q.id)).length;
  document.getElementById('import-confirm').textContent = `Importer ${toImport} question(s)`;
}

async function confirmImport() {
  const replace = document.getElementById('import-replace').checked;
  const matiere = document.getElementById('import-matiere').value.trim();
  const chapitre = document.getElementById('import-chapitre').value.trim();

  const dupIds = new Set(parsed.duplicates.map(d => d.newQ.id));
  let toImport = parsed.valid;
  if (!replace) toImport = toImport.filter(q => !dupIds.has(q.id));

  toImport = toImport.map(q => ({
    ...q,
    matiere: q.matiere === 'Sans matière' && matiere ? matiere : q.matiere,
    chapitre: q.chapitre === 'Sans chapitre' && chapitre ? chapitre : q.chapitre,
  }));

  if (toImport.length === 0) {
    showStatus('Aucune question à importer.', 'error');
    return;
  }

  await db.putQuestions(toImport);
  reset();
  showStatus(`✅ ${toImport.length} question(s) importée(s) avec succès.`, 'success');
  setTimeout(() => { location.hash = '#library'; }, 800);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
} 
