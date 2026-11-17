// A tiny event bus. Systems talk to each other through events instead of importing each other,
// which keeps modules loosely coupled (and avoids import cycles).
//   on('built', ({ b, i }) => ...)   listen
//   emit('built', payload)            announce
//   off('built', fn)                  stop listening
const listeners = new Map();
export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event).push(fn);
  return () => off(event, fn);
}
export function off(event, fn) {
  const list = listeners.get(event); if (!list) return;
  const k = list.indexOf(fn); if (k >= 0) list.splice(k, 1);
}
export function emit(event, data) {
  const list = listeners.get(event); if (!list) return;
  for (const fn of [...list]) fn(data);
}
