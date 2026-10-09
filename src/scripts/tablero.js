import { Modal } from 'bootstrap';
import Sortable from 'sortablejs';
import { getAll, put, remove, nuevaTarea, nuevoProyecto, ESTADOS, ESTADO_LABEL } from './db.js';
import { $, esc, PRIO, PRIO_ORDEN } from './util.js';

const state = { projects: [], tasks: [], sprints: [], sprintId: null };

function getSelectedSprint() {
  return state.sprints.find((s) => s.id === state.sprintId) || null;
}

function updateSprintSelect() {
  const select = $('#sprint-select');
  if (!select) return;
  const options = state.sprints
    .map((s) => `<option value="${s.id}">${esc(s.nombre || 'Sprint')}</option>`)
    .join('');
  select.innerHTML = options;
  select.disabled = state.sprints.length === 0;
  if (state.sprintId && state.sprints.some((s) => s.id === state.sprintId)) {
    select.value = state.sprintId;
  } else if (state.sprints[0]) {
    state.sprintId = state.sprints[0].id;
    select.value = state.sprintId;
  } else {
    state.sprintId = null;
  }
}

function updateTaskSelects() {
  const proyecto = $('#task-proyecto');
  if (proyecto) {
    proyecto.innerHTML = '<option value="">Sin proyecto</option>' + state.projects
      .map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`)
      .join('');
  }

  const sprint = $('#task-sprint');
  if (sprint) {
    sprint.innerHTML = '<option value="">Backlog</option>' + state.sprints
      .map((s) => `<option value="${s.id}">${esc(s.nombre || 'Sprint')}</option>`)
      .join('');
  }
}

function renderSummary() {
  const tasks = state.tasks.filter((t) => t.sprintId === state.sprintId);
  const total = tasks.reduce((n, t) => n + (Number(t.puntos) || 0), 0);
  const hechos = tasks.filter((t) => t.estado === 'done').reduce((n, t) => n + (Number(t.puntos) || 0), 0);
  const pct = total ? Math.round((hechos / total) * 100) : 0;
  const resumen = $('#resumen-puntos');
  const bar = $('#resumen-bar');
  if (resumen) resumen.textContent = `${hechos}/${total} pts`;
  if (bar) {
    bar.style.width = `${pct}%`;
    bar.textContent = `${pct}%`;
  }
}

function taskCard(task) {
  const proyecto = state.projects.find((p) => p.id === task.proyectoId);
  const prio = PRIO[task.prioridad] || 'secondary';

  return `
    <article class="card border-0 shadow-sm mb-2" data-id="${task.id}">
      <div class="card-body p-2">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div class="fw-semibold">${esc(task.titulo)}</div>
          <div class="btn-group btn-group-sm">
            <button type="button" class="btn btn-outline-secondary js-editar" aria-label="Editar tarea"><i class="bi bi-pencil-square"></i></button>
            <button type="button" class="btn btn-outline-danger js-borrar" aria-label="Borrar tarea"><i class="bi bi-trash"></i></button>
          </div>
        </div>
        ${proyecto ? `<div class="mt-2"><span class="badge" style="background:${esc(proyecto.color)}">${esc(proyecto.nombre)}</span></div>` : ''}
        ${task.descripcion ? `<div class="small text-body-secondary mt-2">${esc(task.descripcion)}</div>` : ''}
        <div class="d-flex justify-content-between align-items-center mt-2">
          <span class="badge text-bg-${prio}">${esc(task.prioridad)}</span>
          <span class="small fw-semibold">${Number(task.puntos) || 0} pts</span>
        </div>
      </div>
    </article>
  `;
}

function renderBoard() {
  const tasks = state.tasks.filter((t) => t.sprintId === state.sprintId);
  const sprints = state.sprints.length > 0;

  $('#sin-sprints')?.classList.toggle('d-none', sprints);
  $('#sin-tareas')?.classList.toggle('d-none', tasks.length > 0 || !sprints);

  document.querySelectorAll('.columna').forEach((col) => {
    const estado = col.dataset.estado;
    const items = tasks.filter((t) => t.estado === estado).sort((a, b) => (PRIO_ORDEN[a.prioridad] ?? 1) - (PRIO_ORDEN[b.prioridad] ?? 1) || a.creado - b.creado);
    col.innerHTML = items.length ? items.map(taskCard).join('') : '<div class="small text-body-secondary">Sin tareas</div>';

    const badge = col.closest('.card')?.querySelector('[data-count]');
    if (badge) badge.textContent = String(items.length);
  });

  renderSummary();
}

async function load() {
  [state.projects, state.tasks, state.sprints] = await Promise.all([
    getAll('projects'),
    getAll('tasks'),
    getAll('sprints'),
  ]);

  const active = state.sprints.find((s) => s.activo) || state.sprints[0] || null;
  state.sprintId = active ? active.id : null;
  updateSprintSelect();
  updateTaskSelects();
}

function render() {
  updateSprintSelect();
  renderBoard();
}

function openTaskModal(task = null) {
  const form = $('#task-form');
  if (!form) return;

  form.reset();
  form.dataset.taskId = task ? task.id : '';
  $('#task-title').value = task ? task.titulo : '';
  $('#task-descripcion').value = task ? task.descripcion : '';
  $('#task-prioridad').value = task ? task.prioridad : 'media';
  $('#task-puntos').value = String(task ? Number(task.puntos) || 0 : 1);
  $('#task-proyecto').value = task?.proyectoId ?? '';
  $('#task-sprint').value = task ? (task.sprintId ?? '') : (state.sprintId ?? '');
  $('#task-submit').textContent = task ? 'Guardar' : 'Crear';
  $('#task-delete').classList.toggle('d-none', !task);

  const modal = Modal.getOrCreateInstance(document.getElementById('task-modal'));
  modal.show();
}

async function saveTask(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const taskId = form.dataset.taskId;
  const title = $('#task-title').value.trim();
  if (!title) {
    $('#task-title').focus();
    return alert('El título es obligatorio.');
  }

  const sprintValue = $('#task-sprint').value;
  const proyectoValue = $('#task-proyecto').value;
  const puntos = Math.max(0, Number($('#task-puntos').value) || 0);

  const existing = taskId ? state.tasks.find((t) => t.id === taskId) : null;
  const tarea = existing || nuevaTarea({ sprintId: sprintValue || state.sprintId || null, estado: 'todo' });

  tarea.titulo = title;
  tarea.descripcion = $('#task-descripcion').value.trim();
  tarea.proyectoId = proyectoValue || null;
  tarea.sprintId = sprintValue ? sprintValue : null;
  tarea.prioridad = $('#task-prioridad').value;
  tarea.puntos = puntos;
  tarea.estado = existing ? existing.estado : 'todo';
  if (tarea.estado === 'done') tarea.terminado = tarea.terminado || Date.now();
  else tarea.terminado = null;

  await put('tasks', tarea);
  Modal.getInstance(document.getElementById('task-modal'))?.hide();
  await load();
  render();
}

async function deleteTask(taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || !confirm('¿Borrar esta tarea?')) return;
  await remove('tasks', taskId);
  Modal.getInstance(document.getElementById('task-modal'))?.hide();
  await load();
  render();
}

async function saveProject(event) {
  event.preventDefault();
  const nombre = $('#project-nombre').value.trim();
  const color = $('#project-color').value;
  if (!nombre) {
    $('#project-nombre').focus();
    return alert('El nombre del proyecto es obligatorio.');
  }

  const proyecto = nuevoProyecto(nombre, color);
  await put('projects', proyecto);
  Modal.getInstance(document.getElementById('project-modal'))?.hide();
  event.target.reset();
  await load();
  render();
}

function setupSortable() {
  document.querySelectorAll('.columna').forEach((col) => {
    if (col.dataset.sortableBound === 'true') return;
    col.dataset.sortableBound = 'true';
    new Sortable(col, {
      group: 'tablero',
      animation: 150,
      sort: false,
      onEnd: async (evt) => {
        const taskId = evt.item.dataset.id;
        const nextEstado = evt.to.dataset.estado;
        if (!taskId || !nextEstado) return;
        const task = state.tasks.find((x) => x.id === taskId);
        if (!task || task.estado === nextEstado) return;
        task.estado = nextEstado;
        task.terminado = nextEstado === 'done' ? Date.now() : null;
        await put('tasks', task);
        await load();
        render();
      },
    });
  });
}

async function init() {
  await load();
  render();
  setupSortable();

  $('#sprint-select')?.addEventListener('change', (e) => {
    state.sprintId = e.target.value || null;
    render();
  });

  $('#btn-nueva-tarea')?.addEventListener('click', () => openTaskModal());
  $('#btn-nuevo-proyecto')?.addEventListener('click', () => {
    const modal = Modal.getOrCreateInstance(document.getElementById('project-modal'));
    modal.show();
  });

  $('#task-form')?.addEventListener('submit', saveTask);
  $('#task-delete')?.addEventListener('click', () => deleteTask($('#task-form').dataset.taskId));
  $('#project-form')?.addEventListener('submit', saveProject);

  document.addEventListener('click', async (e) => {
    const editButton = e.target.closest('.js-editar');
    const deleteButton = e.target.closest('.js-borrar');

    if (editButton) {
      const id = editButton.closest('[data-id]')?.dataset.id;
      const task = state.tasks.find((t) => t.id === id);
      if (task) openTaskModal(task);
      return;
    }

    if (deleteButton) {
      const id = deleteButton.closest('[data-id]')?.dataset.id;
      if (id) await deleteTask(id);
    }
  });
}

init();
