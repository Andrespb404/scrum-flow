// Capa de datos local con IndexedDB (sin librerías).
// Stores: projects, tasks, sprints, retros
const DB_NAME = 'scrumflow';
const DB_VERSION = 1;
const STORES = ['projects', 'tasks', 'sprints', 'retros'];

export const ESTADOS = ['todo', 'doing', 'review', 'done'];
export const ESTADO_LABEL = { todo: 'Por hacer', doing: 'En progreso', review: 'Revisión', done: 'Hecho' };

let dbPromise;
function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const res = fn(t.objectStore(store));
    t.oncomplete = () => resolve(res?.result ?? res);
    t.onerror = () => reject(t.error);
  });
}

export const uid = () => crypto.randomUUID();
export const getAll = (store) => tx(store, 'readonly', (s) => s.getAll());
export const get = (store, id) => tx(store, 'readonly', (s) => s.get(id));
export const put = (store, item) => tx(store, 'readwrite', (s) => s.put(item));
export const remove = (store, id) => tx(store, 'readwrite', (s) => s.delete(id));

// ---- Fábricas ----
export const nuevoProyecto = (nombre, color = '#0d6efd') => ({ id: uid(), nombre, color, creado: Date.now() });
export const nuevaTarea = (data) => ({
  id: uid(),
  titulo: '',
  descripcion: '',
  proyectoId: null,
  sprintId: null, // null = backlog
  estado: 'todo',
  prioridad: 'media', // baja | media | alta
  puntos: 1,
  etiquetas: [],
  creado: Date.now(),
  terminado: null, // fecha en que pasó a "done" (para burndown)
  ...data,
});
export const nuevoSprint = (data) => ({
  id: uid(),
  nombre: '',
  meta: '',
  inicio: null, // 'YYYY-MM-DD'
  fin: null,
  activo: false,
  ...data,
});
export const nuevaRetro = (data) => ({ id: uid(), sprintId: null, bien: [], mal: [], mejorar: [], creado: Date.now(), ...data });

// ---- Respaldo ----
export async function exportJSON() {
  const data = {};
  for (const s of STORES) data[s] = await getAll(s);
  const blob = new Blob([JSON.stringify({ version: DB_VERSION, data }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `scrumflow-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importJSON(file) {
  const parsed = JSON.parse(await file.text());
  if (!parsed?.data) throw new Error('falta la clave "data"');
  if (!confirm('Importar reemplaza TODOS los datos actuales. ¿Continuar?')) return;
  for (const s of STORES) {
    await tx(s, 'readwrite', (st) => st.clear());
    for (const item of parsed.data[s] ?? []) await put(s, item);
  }
}
