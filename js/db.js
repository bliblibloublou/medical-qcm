const DB_NAME = 'qcm_med_db';
const DB_VERSION = 1;
let _db = null;

export async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('questions')) {
        const s = db.createObjectStore('questions', { keyPath: 'id' });
        s.createIndex('matiere', 'matiere', { unique: false });
        s.createIndex('chapitre', 'chapitre', { unique: false });
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function promisify(req) {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function getAllQuestions() {
  const db = await openDB();
  const t = db.transaction('questions', 'readonly');
  return promisify(t.objectStore('questions').getAll());
}

export async function putQuestions(questions) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction('questions', 'readwrite');
    const s = t.objectStore('questions');
    for (const q of questions) s.put(q);
    t.oncomplete = () => res(true);
    t.onerror = () => rej(t.error);
  });
}

export async function deleteQuestion(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction('questions', 'readwrite');
    t.objectStore('questions').delete(id);
    t.oncomplete = () => res(true);
    t.onerror = () => rej(t.error);
  });
}

export async function clearAllQuestions() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction('questions', 'readwrite');
    t.objectStore('questions').clear();
    t.oncomplete = () => res(true);
    t.onerror = () => rej(t.error);
  });
}

export async function saveSession(session) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction('sessions', 'readwrite');
    t.objectStore('sessions').put(session);
    t.oncomplete = () => res(true);
    t.onerror = () => rej(t.error);
  });
}

export async function getAllSessions() {
  const db = await openDB();
  const t = db.transaction('sessions', 'readonly');
  return promisify(t.objectStore('sessions').getAll());
}

export async function clearAllSessions() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction('sessions', 'readwrite');
    t.objectStore('sessions').clear();
    t.oncomplete = () => res(true);
    t.onerror = () => rej(t.error);
  });
} 
