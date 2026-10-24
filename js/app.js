import * as db from './db.js';
import { initImport } from './import.js';
import { initLibrary } from './library.js';
import { initQuiz, refreshExamSetup } from './quiz.js';
import { initStats, refreshHomeStats, refreshSettingsStats } from './stats.js';

const SCREENS = ['home', 'import', 'library', 'exam-setup', 'exam', 'results', 'settings'];

export function showScreen(name) {
  SCREENS.forEach(s => {
    document.getElementById('screen-' + s)?.classList.toggle('active', s === name);
  });
  window.scrollTo(0, 0);
}

function handleHash() {
  const name = location.hash.slice(1) || 'home';
  if (SCREENS.includes(name)) showScreen(name);
}

window.addEventListener('hashchange', handleHash);

document.addEventListener('DOMContentLoaded', async () => {
  // Toggle `.selected` sur les labels de propositions
  document.addEventListener('change', (e) => {
    const input = e.target;
    if (!input.matches('.prop input')) return;
    if (input.type === 'radio') {
      document.querySelectorAll(`input[name="${CSS.escape(input.name)}"]`).forEach(i => {
        i.closest('.prop')?.classList.toggle('selected', i.checked);
      });
    } else {
      input.closest('.prop')?.classList.toggle('selected', input.checked);
    }
  });

  // Init modules
  initImport();
  initLibrary();
  initQuiz();
  initStats();

  // Home stats & settings stats refresh à chaque retour
  document.addEventListener('screen:show', async (e) => {
    if (e.detail.name === 'home') await refreshHomeStats();
    if (e.detail.name === 'settings') await refreshSettingsStats();
    if (e.detail.name === 'exam-setup') await refreshExamSetup();
  });

  // Patch showScreen pour émettre l'événement
  const origShow = showScreen;
  window.__showScreen = (name) => {
    origShow(name);
    document.dispatchEvent(new CustomEvent('screen:show', { detail: { name } }));
  };

  await refreshHomeStats();
  handleHash();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }
});

// Exposer le router globalement pour les autres modules
window.__showScreen = (name) => {
  showScreen(name);
  document.dispatchEvent(new CustomEvent('screen:show', { detail: { name } }));
}; 
