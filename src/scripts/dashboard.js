import Chart from 'chart.js/auto';
import { getAll, ESTADOS } from './db.js';
import { $, esc } from './util.js';
import { burndown, puntosPorProyecto, resumenSprint, tareasPorEstado, velocidadPorSprint } from './metricas.js';

const state = { projects: [], tasks: [], sprints: [], sprintId: null, charts: {} };

function getSelectedSprint() {
  return state.sprints.find((s) => s.id === state.sprintId) || null;
}

function getSprintTasks() {
  return state.tasks.filter((t) => t.sprintId === state.sprintId);
}

function updateSprintSelect() {
  const select = $('#sprint-select');
  if (!select) return;
  select.innerHTML = state.sprints.map((s) => `<option value="${s.id}">${esc(s.nombre || 'Sprint')}</option>`).join('');
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

function setDashboardVisibility(hasSprint) {
  $('#kpis')?.classList.toggle('d-none', !hasSprint);
  $('#sin-sprints')?.classList.toggle('d-none', state.sprints.length > 0);
  $('#sin-datos')?.classList.toggle('d-none', hasSprint && getSprintTasks().length > 0);
  document.querySelectorAll('.chart-panel').forEach((panel) => panel.classList.toggle('d-none', !hasSprint));
}

function renderKpis() {
  const sprint = getSelectedSprint();
  const tasks = getSprintTasks();
  const summary = resumenSprint(tasks);
  const total = summary.total || 0;
  const hechos = summary.hechas || 0;
  const tareasHechas = summary.tareasHechas || 0;
  const tareasTotal = summary.tareasTotal || 0;

  $('#kpi-avance-value').textContent = `${summary.pct}%`;
  $('#kpi-puntos-value').textContent = `${hechos}/${total} pts`;
  $('#kpi-tareas-value').textContent = `${tareasHechas}/${tareasTotal}`;

  let dias = 0;
  if (sprint?.fin) {
    const fin = new Date(sprint.fin + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diff = fin - hoy;
    dias = Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  }
  $('#kpi-dias-value').textContent = String(dias);

  $('#kpi-avance-bar').style.width = `${summary.pct}%`;
  $('#kpi-avance-bar').textContent = `${summary.pct}%`;
}

function destroyChart(name) {
  const chart = state.charts[name];
  if (chart) {
    chart.destroy();
    state.charts[name] = null;
  }
}

function renderBurndown() {
  const sprint = getSelectedSprint();
  const tasks = getSprintTasks();
  const ctx = document.getElementById('burndown-chart');
  const empty = $('#burndown-empty');

  if (!sprint || !sprint.inicio || !sprint.fin) {
    destroyChart('burndown');
    if (empty) {
      empty.textContent = 'El burndown necesita fechas de inicio y fin en el sprint.';
      empty.classList.remove('d-none');
    }
    if (ctx) ctx.classList.add('d-none');
    return;
  }

  if (empty) empty.classList.add('d-none');
  if (ctx) ctx.classList.remove('d-none');

  const data = burndown(sprint, tasks);
  if (!data) {
    destroyChart('burndown');
    return;
  }

  destroyChart('burndown');
  state.charts.burndown = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Ideal',
          data: data.ideal,
          borderColor: '#6c757d',
          backgroundColor: 'rgba(108,117,125,0.15)',
          tension: 0,
          pointRadius: 2,
        },
        {
          label: 'Real',
          data: data.real,
          borderColor: '#0d6efd',
          backgroundColor: 'rgba(13,110,253,0.15)',
          tension: 0.15,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          title: { display: true, text: 'Puntos restantes' },
        },
      },
    },
  });
}

function renderEstadoChart() {
  const tasks = getSprintTasks();
  const ctx = document.getElementById('estado-chart');
  destroyChart('estado');
  const data = tareasPorEstado(tasks);
  const valores = data.map((g) => g.value);
  const labels = data.map((g) => g.label);
  const colors = ['#0d6efd', '#ffc107', '#6f42c1', '#198754'];

  state.charts.estado = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: valores, backgroundColor: colors }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      cutout: '60%',
    },
  });
}

function renderVelocidadChart() {
  const sprints = state.sprints;
  const ctx = document.getElementById('velocidad-chart');
  destroyChart('velocidad');
  const data = velocidadPorSprint(sprints, state.tasks);

  state.charts.velocidad = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map((d) => d.label),
      datasets: [{
        label: 'Puntos hechos',
        data: data.map((d) => d.value),
        backgroundColor: '#198754',
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

function renderProyectoChart() {
  const tasks = getSprintTasks();
  const ctx = document.getElementById('proyecto-chart');
  destroyChart('proyecto');
  const data = puntosPorProyecto(tasks, state.projects);

  state.charts.proyecto = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map((d) => d.label),
      datasets: [{
        data: data.map((d) => d.value),
        backgroundColor: data.map((d) => d.color),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      cutout: '60%',
    },
  });
}

function renderCharts() {
  const sprint = getSelectedSprint();
  const tasks = getSprintTasks();
  const hasSprint = Boolean(sprint);
  setDashboardVisibility(hasSprint);

  if (!hasSprint) return;

  renderBurndown();
  renderEstadoChart();
  renderProyectoChart();
  renderVelocidadChart();

  if (tasks.length === 0) {
    $('#sin-datos').textContent = 'No hay tareas en este sprint.';
    $('#sin-datos')?.classList.remove('d-none');
  }
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
}

function render() {
  updateSprintSelect();
  renderKpis();
  renderCharts();
}

async function init() {
  await load();
  render();

  $('#sprint-select')?.addEventListener('change', (e) => {
    state.sprintId = e.target.value || null;
    render();
  });
}

init();
