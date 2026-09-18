// Source identity belongs to the paper, never its position in a section.
export function examTitle(item) {
  if (item.packageNumber) return `Package ${item.packageNumber} · ${item.district || item.sourceName} · ${item.year} · ${item.examType}${item.part ? ' · ' + item.part : ''}`;
  const source = item.sources?.[0] || item.source || '';
  const parts = source.replace(/\.(docx?|pdf)$/i, '').replace(/_解析$/, '').split('_');
  if (/^\d+$/.test(parts[0]) && parts.length > 2) {
    const [number, year, ...place] = parts;
    return `Package ${number} · ${place.join(' · ')} · ${year}`;
  }
  return source || item.title;
}
