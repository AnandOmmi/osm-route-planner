const { planRouteFromOsm } = require('./core');

// Node only: read a local .osm file
const planRouteFromFile = (filePath, opts) =>
  planRouteFromOsm(require('fs').readFileSync(filePath, 'utf8'), opts);

// Node 18+ / browser: download a .osm file
const planRouteFromUrl = async (url, opts) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return planRouteFromOsm(await res.text(), opts);
};

module.exports = { planRouteFromFile, planRouteFromUrl };
