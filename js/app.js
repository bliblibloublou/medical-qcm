import { initImport } from './import.js';
import { initLibrary } from './library.js';
import { initQuiz, refreshExamSetup } from './quiz.js';
import { initStats, refreshHomeStats, refreshSettingsStats } from './stats.js';

const SCREENS = ['home', 'import', 'library', 'exam-setup', 'exam', 'results', 'settings'];

// ⚠️ CORRECTIF v1.1 : showScreen dispatche l'événement 'screen:show'
export function showScreen(name) {
  if (!SCREENS.includes(name)) name = 'home';
  SCREENS.forEach(s => {
    document.getElementById('screen-' + s)?.classList.toggle('active', s === name);
  });
  window.scrollTo(0, 0);
  document.dispatchEvent(new CustomEvent('screen:show', { detail: { name } }));
}

window.__showScreen = showScreen;

function handleHash() {
  const name = location.hash.slice(1) || 'home';
  showScreen(name);
}

window.addEventListener('hashchange', handleHash);

document.addEventListener('DOMContentLoaded', async () => {
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

  document.addEventListener('screen:show', async (e) => {
    if (e.detail.name === 'home') await refreshHomeStats();
    if (e.detail.name === 'settings') await refreshSettingsStats();
    if (e.detail.name === 'exam-setup') await refreshExamSetup();
  });

  initImport();
  initLibrary();
  initQuiz();
  initStats();

  handleHash();

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
      reg.update();
    } catch (e) {
      console.error('SW register failed:', e);
    }
  }
}); 
