import * as db from './db.js';

export function initStats() {
  document.getElementById('export-all').addEventListener('click', exportAll);
  document.getElementById('export-results').addEventListener('click', exportResults);
  document.getElementById('reset-all').addEventListener('click', resetAll);
}

export async function refreshHomeStats() {
  const box = document.getElementById('home-stats');
  const [questions, sessions] = await Promise.all([db.getAllQuestions(), db.getAllSessions()]);

  if (questions.length === 0) {
    box.innerHTML = `<p class="hint" style="text-align:center;">Aucune question pour l'instant. <a href="#import">Importe ta première banque.</a></p>`;
    return;
  }

  const matieres = new Set(questions.map(q => q.matiere)).size;
  const last5 = sessions.slice(-5);
  const avgPct = last5.length > 0
    ? Math.round(100 * last5.reduce((a, s) => a + s.score / s.total, 0) / last5.length)
    : null;

  box.innerHTML = `
    <div class="stats-row"><span>Questions</span><span class="stats-value">${questions.length}</span></div>
    <div class="stats-row"><span>Matières</span><span class="stats-value">${matieres}</span></div>
    <div class="stats-row"><span>Sessions passées</span><span class="stats-value">${sessions.length}</span></div>
    ${avgPct !== null ? `<div class="stats-row"><span>Moyenne (5 dernières)</span><span class="stats-value">${avgPct}%</span></div>` : ''}
  `;
}

export async function refreshSettingsStats() {
  const box = document.getElementById('settings-stats');
  const [questions, sessions] = await Promise.all([db.getAllQuestions(), db.getAllSessions()]);
  box.innerHTML = `
    <div class="stats-row"><span>Questions stockées</span><span class="stats-value">${questions.length}</span></div>
    <div class="stats-row"><span>Sessions enregistrées</span><span class="stats-value">${sessions.length}</span></div>
  `;
}

async function exportAll() {
  const questions = await db.getAllQuestions();
  if (questions.length === 0) { alert('Aucune question à exporter.'); return; }
  downloadJSON(questions, `qcm-banque-${datestamp()}.json`);
}

async function exportResults() {
  const sessions = await db.getAllSessions();
  if (sessions.length === 0) { alert('Aucun résultat à exporter.'); return; }
  downloadJSON(sessions, `qcm-resultats-${datestamp()}.json`);
}

async function resetAll() {
  if (!confirm('Effacer TOUTES les données (questions + résultats) ? Cette action est irréversible.')) return;
  if (!confirm('Vraiment sûr ? Pense à exporter ta banque avant.')) return;
  await db.clearAllQuestions();
  await db.clearAllSessions();
  alert('Données effacées.');
  await refreshHomeStats();
  await refreshSettingsStats();
  window.__showScreen('home');
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function datestamp() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
} 
