import { getAll, put, remove } from './db.js';
import { $, esc, PRIO, PRIO_ORDEN } from './util.js';

const state = { projects: [], tasks: [], sprints: [] };
let filtroProyecto = '';

async function load() {
  [state.projects, state.tasks, state.sprints] = await Promise.all([getAll('projects'), getAll('tasks'), getAll('sprints')]);
}

function render() {
  const lista = state.tasks
    .filter((t) => !t.sprintId && (!filtroProyecto || t.proyectoId === filtroProyecto))
    .sort((a, b) => (PRIO_ORDEN[a.prioridad] ?? 1) - (PRIO_ORDEN[b.prioridad] ?? 1) || a.creado - b.creado);

  const pts = lista.reduce((n, t) => n + (Number(t.puntos) || 0), 0);
  $('#resumen').textContent = `${lista.length} tareas · ${pts} pts`;
  $('#sin-sprints').classList.toggle('d-none', state.sprints.length > 0);
  $('#vacio').classList.toggle('d-none', lista.length > 0);

  const sprintOpts = state.sprints.map((s) => `<option value="${s.id}">${esc(s.nombre || 'Sprint')}</option>`).join('');
  $('#tabla-body').innerHTML = lista
    .map((t) => {
      const p = state.projects.find((x) => x.id === t.proyectoId);
      return `<tr data-id="${t.id}">
        <td>${esc(t.titulo)}${t.descripcion ? `<div class="small text-body-secondary">${esc(t.descripcion)}</div>` : ''}</td>
        <td>${p ? `<span class="badge" style="background:${esc(p.color)}">${esc(p.nombre)}</span>` : ''}</td>
        <td><span class="badge text-bg-${PRIO[t.prioridad] ?? 'secondary'}">${esc(t.prioridad)}</span></td>
        <td class="text-end">${Number(t.puntos) || 0}</td>
        <td style="min-width:11rem">
          <select class="form-select form-select-sm js-mover" ${state.sprints.length ? '' : 'disabled'} aria-label="Mover a sprint">
            <option value="">Mover a sprint…</option>${sprintOpts}
          </select>
        </td>
        <td class="text-end"><button class="btn btn-sm btn-outline-danger js-borrar" aria-label="Borrar tarea"><i class="bi bi-trash"></i></button></td>
      </tr>`;
    })
    .join('');
}

async function init() {
  await load();
  $('#f-proyecto').innerHTML =
    `<option value="">Todos los proyectos</option>` +
    state.projects.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('');
  render();

  $('#f-proyecto').addEventListener('change', (e) => { filtroProyecto = e.target.value; render(); });

  $('#tabla-body').addEventListener('change', async (e) => {
    if (!e.target.classList.contains('js-mover') || !e.target.value) return;
    const t = state.tasks.find((x) => x.id === e.target.closest('tr').dataset.id);
    if (!t) return;
    t.sprintId = e.target.value;
    await put('tasks', t);
    await load();
    render();
  });

  $('#tabla-body').addEventListener('click', async (e) => {
    const btn = e.target.closest('.js-borrar');
    if (!btn || !confirm('¿Borrar esta tarea?')) return;
    await remove('tasks', btn.closest('tr').dataset.id);
    await load();
    render();
  });
}

init();
