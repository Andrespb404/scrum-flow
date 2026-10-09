import { getAll, put, remove, nuevaRetro } from './db.js';
import { $, esc } from './util.js';

const COLUMNAS = [
  { clave: 'bien', titulo: 'Salió bien', color: 'success', icono: 'hand-thumbs-up' },
  { clave: 'mal', titulo: 'Salió mal', color: 'danger', icono: 'hand-thumbs-down' },
  { clave: 'mejorar', titulo: 'A mejorar', color: 'primary', icono: 'lightbulb' },
];

const state = { sprints: [], retros: [], sprintId: null };

function getSprint() {
  return state.sprints.find((s) => s.id === state.sprintId) || null;
}

function getRetro() {
  return state.retros.find((r) => r.sprintId === state.sprintId) || null;
}

function fmtRange(sprint) {
  if (!sprint) return 'Sin sprint';
  if (sprint.inicio && sprint.fin) return `${sprint.inicio} → ${sprint.fin}`;
  if (sprint.inicio) return `${sprint.inicio}`;
  if (sprint.fin) return `${sprint.fin}`;
  return 'Sin fechas';
}

function resumenSprint() {
  const sprint = getSprint();
  const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
  const sprintTasks = tasks.filter((t) => t.sprintId === state.sprintId);
  const total = sprintTasks.reduce((n, t) => n + (Number(t.puntos) || 0), 0);
  const hechas = sprintTasks.filter((t) => t.estado === 'done').reduce((n, t) => n + (Number(t.puntos) || 0), 0);
  const element = $('#resumen');
  if (!element) return;

  if (!sprint) {
    element.textContent = 'Selecciona un sprint';
    return;
  }

  element.textContent = `${hechas}/${total} pts · ${sprintTasks.filter((t) => t.estado === 'done').length}/${sprintTasks.length} tareas · ${fmtRange(sprint)}`;
}

function renderSelect() {
  const select = $('#sprint-select');
  if (!select) return;

  select.innerHTML = state.sprints.map((s) => `<option value="${s.id}">${esc(s.nombre || 'Sprint')}</option>`).join('');
  if (state.sprintId && state.sprints.some((s) => s.id === state.sprintId)) {
    select.value = state.sprintId;
  } else if (state.sprints[0]) {
    state.sprintId = state.sprints[0].id;
    select.value = state.sprintId;
  } else {
    state.sprintId = null;
  }
}

function renderColumnas() {
  const contenedor = $('#retro-columns');
  if (!contenedor) return;

  const retro = getRetro();
  contenedor.innerHTML = COLUMNAS.map((col) => {
    const items = retro?.[col.clave] || [];
    return `
      <div class="col-12 col-md-4">
        <div class="card border-${col.color} h-100">
          <div class="card-header bg-${col.color} bg-opacity-10 d-flex justify-content-between align-items-center">
            <h2 class="h6 mb-0"><i class="bi bi-${col.icono}"></i> ${col.titulo}</h2>
            <span class="badge text-bg-${col.color}">${items.length}</span>
          </div>
          <div class="card-body">
            <form class="input-group mb-3 js-form" data-col="${col.clave}">
              <input class="form-control" type="text" maxlength="200" placeholder="Agregar nota" aria-label="Agregar nota" />
              <button class="btn btn-${col.color}" type="submit" aria-label="Guardar nota">+</button>
            </form>
            <ul class="list-unstyled mb-0 d-grid gap-2">
              ${items.map((nota, idx) => `
                <li class="d-flex align-items-start justify-content-between gap-2 border rounded p-2 bg-body-tertiary">
                  <span>${esc(nota)}</span>
                  <button type="button" class="btn btn-sm btn-link text-body-secondary p-0 js-borrar" data-col="${col.clave}" data-index="${idx}" aria-label="Borrar nota"><i class="bi bi-x-lg"></i></button>
                </li>
              `).join('') || '<li class="text-body-secondary small">Sin notas.</li>'}
            </ul>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function render() {
  renderSelect();
  renderColumnas();
  resumenSprint();
  const sprint = getSprint();
  $('#sin-sprints')?.classList.toggle('d-none', Boolean(state.sprints.length));
  $('#sin-sprint')?.classList.toggle('d-none', Boolean(sprint));
}

async function load() {
  [state.sprints, state.retros] = await Promise.all([getAll('sprints'), getAll('retros')]);
  const active = state.sprints.find((s) => s.activo) || [...state.sprints].sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''))[0] || null;
  state.sprintId = active ? active.id : null;
}

async function agregarNota(col, texto) {
  const limpio = texto.trim();
  if (!limpio) return;
  let retro = state.retros.find((r) => r.sprintId === state.sprintId);
  if (!retro) {
    retro = nuevaRetro({ sprintId: state.sprintId });
    state.retros.push(retro);
  }
  retro[col] = retro[col] || [];
  retro[col].push(limpio);
  await put('retros', retro);
  await load();
  render();
}

async function borrarNota(col, idx) {
  const retro = getRetro();
  if (!retro || !Array.isArray(retro[col])) return;
  retro[col].splice(idx, 1);
  await put('retros', retro);
  await load();
  render();
}

async function init() {
  await load();
  render();

  $('#retro-columns')?.addEventListener('submit', async (e) => {
    const form = e.target.closest('.js-form');
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector('input');
    await agregarNota(form.dataset.col, input.value);
    input.value = '';
  });

  $('#retro-columns')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.js-borrar');
    if (!btn) return;
    await borrarNota(btn.dataset.col, Number(btn.dataset.index));
  });

  $('#sprint-select')?.addEventListener('change', (e) => {
    state.sprintId = e.target.value || null;
    render();
  });
}

init();
