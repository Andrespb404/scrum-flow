export const $ = (s) => document.querySelector(s);
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const PRIO = { alta: 'danger', media: 'warning', baja: 'secondary' };
export const PRIO_ORDEN = { alta: 0, media: 1, baja: 2 };
