import * as db from './db.js';

let allQuestions = [];

export function initLibrary() {
  document.getElementById('library-search').addEventListener('input', render);
  document.addEventListener('screen:show', async (e) => {
    if (e.detail.name === 'library') {
      allQuestions = await db.getAllQuestions();
      render();
    }
  });
}

function render() {
  const search = document.getElementById('library-search').value.trim().toLowerCase();
  const filtered = search
    ? allQuestions.filter(q =>
        q.enonce.toLowerCase().includes(search) ||
        q.matiere.toLowerCase().includes(search) ||
        q.chapitre.toLowerCase().includes(search))
    : allQuestions;

  const container = document.getElementById('library-content');

  if (filtered.length === 0) {
    container.innerHTML = `<p class="hint" style="text-align:center;padding:40px 0;">
      ${allQuestions.length === 0
        ? 'Aucune question pour l\'instant. Importe un fichier JSON depuis l\'écran Importer.'
        : 'Aucun résultat pour cette recherche.'}
    </p>`;
    return;
  }

  // Grouper par matière → chapitre
  const byMatiere = {};
  for (const q of filtered) {
    byMatiere[q.matiere] = byMatiere[q.matiere] || {};
    byMatiere[q.matiere][q.chapitre] = byMatiere[q.matiere][q.chapitre] || [];
    byMatiere[q.matiere][q.chapitre].push(q);
  }

  container.innerHTML = Object.keys(byMatiere).sort().map(matiere => {
    const chapitres = byMatiere[matiere];
    const total = Object.values(chapitres).reduce((a, c) => a + c.length, 0);
    return `
      <div class="matiere-block">
        <div class="matiere-header">
          <span class="matiere-name">${escapeHtml(matiere)}</span>
          <span class="matiere-count">${total} question(s)</span>
        </div>
        ${Object.keys(chapitres).sort().map(chap => `
          <div class="chapitre-row">
            <span>${escapeHtml(chap)}</span>
            <span class="matiere-count">${chapitres[chap].length}</span>
          </div>
          <div class="question-list">
            ${chapitres[chap].map(q => `
              <div class="question-item">
                <span class="q-type-tag">${q.type}·N${q.niveau}</span>
                ${escapeHtml(q.enonce.slice(0, 120))}${q.enonce.length > 120 ? '…' : ''}
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
} 
