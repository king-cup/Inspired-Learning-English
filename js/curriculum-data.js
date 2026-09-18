let reading = null;
let middle = null;
let audio = null;
let readingPromise = null;
let middlePromise = null;

async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const value = await response.json();
  if (!value || value.schemaVersion !== 1 || value.contentVersion !== '1.10') throw new Error(`${url}: invalid schema`);
  return value;
}

export async function loadReading() {
  if (reading && audio) return reading;
  if (!readingPromise) {
    readingPromise = Promise.all([json('reading-content.json'), json('reading-audio-manifest.json')])
      .then(([nextReading, nextAudio]) => { reading = nextReading; audio = nextAudio; return reading; })
      .catch((error) => { readingPromise = null; throw error; });
  }
  return readingPromise;
}

export async function loadMiddle() {
  if (middle) return middle;
  if (!middlePromise) {
    middlePromise = json('middle-school.json')
      .then((value) => { middle = value; return middle; })
      .catch((error) => { middlePromise = null; throw error; });
  }
  return middlePromise;
}

export const article = (id) => reading && reading.articles.find((row) => row.id === id);
export const audioRecord = (id) => audio && audio.recordings.find((row) => row.articleId === id);
export const middleExercise = (grade, section, id) =>
  middle && (middle.grades[grade]?.[section] || []).find((row) => row.id === id);
export const nextMiddle = (grade, section, id) => {
  const rows = middle?.grades[grade]?.[section] || [];
  return rows[rows.findIndex(row => row.id === id) + 1];
};

let highPromise;
export async function loadHigh() {
  if (!highPromise) highPromise = fetch('high-school.json').then(async response => {
    if (!response.ok) throw new Error('High-school content unavailable');
    const data = await response.json();
    if (data.schemaVersion !== 1 || !data.grades) throw new Error('Invalid high-school content');
    return data;
  }).catch(error => { highPromise = null; throw error; });
  return highPromise;
}
