import { ESTADOS, ESTADO_LABEL } from './db.js';

export const sumaPuntos = (tareas) => tareas.reduce((n, t) => n + (Number(t.puntos) || 0), 0);

export function resumenSprint(tareas) {
  const total = sumaPuntos(tareas);
  const hechas = sumaPuntos(tareas.filter((t) => t.estado === 'done'));
  return {
    total,
    hechas,
    pct: total ? Math.round((hechas / total) * 100) : 0,
    tareasTotal: tareas.length,
    tareasHechas: tareas.filter((t) => t.estado === 'done').length,
  };
}

export function burndown(sprint, tareas, hoy = new Date()) {
  if (!sprint || !sprint.inicio || !sprint.fin) return null;

  const start = new Date(sprint.inicio + 'T00:00:00');
  const end = new Date(sprint.fin + 'T00:00:00');
  const total = sumaPuntos(tareas);
  const msDay = 24 * 60 * 60 * 1000;
  const dias = Math.max(0, Math.round((end - start) / msDay));
  const labels = [];
  const ideal = [];
  const real = [];

  for (let i = 0; i <= dias; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const label = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
    labels.push(label);

    const idealRemaining = total - (total * (i / (dias || 1)));
    ideal.push(Math.max(0, idealRemaining));

    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);
    const hechosHastaDia = tareas.reduce((n, t) => {
      if (t.estado !== 'done') return n;
      const terminado = t.terminado ? new Date(t.terminado) : null;
      if (terminado && terminado <= dayEnd) return n + (Number(t.puntos) || 0);
      if (!terminado && i === 0) return n + (Number(t.puntos) || 0);
      return n;
    }, 0);

    const current = d > hoy ? null : Math.max(0, total - hechosHastaDia);
    real.push(current);
  }

  return { labels, ideal, real };
}

export function tareasPorEstado(tareas) {
  return ESTADOS.map((estado) => ({
    label: ESTADO_LABEL[estado],
    value: tareas.filter((t) => t.estado === estado).length,
  }));
}

export function velocidadPorSprint(sprints, tareas) {
  return [...sprints]
    .sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''))
    .map((sprint) => ({
      label: sprint.nombre || 'Sprint',
      value: sumaPuntos(tareas.filter((t) => t.sprintId === sprint.id && t.estado === 'done')),
    }));
}

export function puntosPorProyecto(tareas, proyectos) {
  const grupos = new Map();
  for (const t of tareas) {
    const proyecto = proyectos.find((p) => p.id === t.proyectoId);
    const key = proyecto ? proyecto.nombre : 'Sin proyecto';
    const color = proyecto ? proyecto.color : '#6c757d';
    const prev = grupos.get(key) || { label: key, value: 0, color };
    prev.value += Number(t.puntos) || 0;
    grupos.set(key, prev);
  }
  return [...grupos.values()].filter((g) => g.value > 0);
}
