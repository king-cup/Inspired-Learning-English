// HSE-only worksheet questions. The generated JSON contains only questions
// with selectable answers; written-response exercises are deliberately omitted.

let data = null;
let loading = null;

export async function load() {
  if (data) return data;
  if (!loading) {
    loading = fetch('advanced-practice.json').then(async (res) => {
      if (!res.ok) throw new Error(`advanced-practice.json: HTTP ${res.status}`);
      const parsed = await res.json();
      if (!parsed || typeof parsed !== 'object') throw new Error('advanced-practice.json is invalid');
      data = parsed;
      return data;
    }).catch((err) => { loading = null; throw err; });
  }
  return loading;
}

export async function forUnit(unitId) {
  const all = await load();
  return Array.isArray(all[String(unitId)]) ? all[String(unitId)] : [];
}
