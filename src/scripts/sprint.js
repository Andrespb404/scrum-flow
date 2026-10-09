import { getAll, put, remove, nuevoSprint } from './db.js';
import { $, esc } from './util.js';

const state = { tasks: [], sprints: [] };

async function load() {
  [state.tasks, state.sprints] = await Promise.all([getAll('tasks'), getAll('sprints')]);
}

const fmt = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—');

function render() {
  const sprints = [...state.sprints].sort((a, b) => Number(b.activo) - Number(a.activo) || (b.inicio ?? '').localeCompare(a.inicio ?? ''));
  $('#vacio').classList.toggle('d-none', sprints.length > 0);
  $('#lista').innerHTML = sprints
    .map((s) => {
      const ts = state.tasks.filter((t) => t.sprintId === s.id);
      const total = ts.reduce((n, t) => n + (Number(t.puntos) || 0), 0);
      const hechos = ts.filter((t) => t.estado === 'done').reduce((n, t) => n + (Number(t.puntos) || 0), 0);
      const pct = total ? Math.round((hechos / total) * 100) : 0;
      return `<div class="col-12 col-lg-6"><div class="card h-100 ${s.activo ? 'border-success' : ''}" data-id="${s.id}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <h2 class="h5 mb-1">${esc(s.nombre || 'Sprint')} ${s.activo ? '<span class="badge text-bg-success">Activo</span>' : ''}</h2>
            <span class="small text-body-secondary">${fmt(s.inicio)} → ${fmt(s.fin)}</span>
          </div>
          ${s.meta ? `<p class="mb-2">${esc(s.meta)}</p>` : ''}
          <div class="progress mb-1" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar" style="width:${pct}%">${pct}%</div>
          </div>
          <div class="small text-body-secondary mb-3">${ts.length} tareas · ${hechos}/${total} pts hechos</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm ${s.activo ? 'btn-outline-secondary' : 'btn-success'} js-activar">${s.activo ? 'Desactivar' : 'Activar'}</button>
            <a class="btn btn-sm btn-outline-primary" href="/tablero">Ver tablero</a>
            <button class="btn btn-sm btn-outline-danger ms-auto js-borrar"><i class="bi bi-trash"></i> Borrar</button>
          </div>
        </div></div></div>`;
    })
    .join('');
}

async function crear(e) {
  e.preventDefault();
  const inicio = $('#s-inicio').value;
  const fin = $('#s-fin').value;
  if (inicio && fin && fin < inicio) return alert('La fecha de fin no puede ser anterior al inicio.');
  const s = nuevoSprint({ nombre: $('#s-nombre').value.trim(), meta: $('#s-meta').value.trim(), inicio: inicio || null, fin: fin || null });
  await put('sprints', s);
  e.target.reset();
  await load();
  render();
}

async function init() {
  await load();
  render();
  $('#form-sprint').addEventListener('submit', crear);

  $('#lista').addEventListener('click', async (e) => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    const s = state.sprints.find((x) => x.id === card.dataset.id);
    if (e.target.closest('.js-activar')) {
      const activar = !s.activo;
      for (const o of state.sprints) {
        const nuevo = o.id === s.id ? activar : false;
        if (o.activo !== nuevo) { o.activo = nuevo; await put('sprints', o); }
      }
    } else if (e.target.closest('.js-borrar')) {
      if (!confirm('¿Borrar sprint? Sus tareas vuelven al backlog.')) return;
      for (const t of state.tasks.filter((x) => x.sprintId === s.id)) { t.sprintId = null; await put('tasks', t); }
      await remove('sprints', s.id);
    } else return;
    await load();
    render();
  });
}

init();
