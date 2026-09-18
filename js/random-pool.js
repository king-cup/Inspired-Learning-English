// Shared Cloze policy: unseen first, least-used next, never immediately repeat.
export function chooseRandom(ids, pulls, last, random = Math.random) {
  const pool = [...new Set(ids.map(String))];
  if (!pool.length) return null;
  const eligible = pool.length > 1 ? pool.filter(id => id !== last) : pool;
  const count = id => Number.isFinite(Number(pulls[id])) ? Math.max(0, Number(pulls[id])) : 0;
  const least = Math.min(...eligible.map(count));
  const candidates = eligible.filter(id => count(id) === least);
  return candidates[Math.min(candidates.length - 1, Math.floor(Math.max(0, random()) * candidates.length))];
}
