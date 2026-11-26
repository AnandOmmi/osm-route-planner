const path = require('path');
const { planRouteFromFile, quatFromBearing } = require('..');   // = require('@anandommi/osm-route-planner') once installed

const result = planRouteFromFile(path.join(__dirname, 'map.osm'), {
  start: { position: { lat: 12.97001, lon: 77.59001 }, orientation: quatFromBearing(45) },  // near node 1, facing NE
  goal:  { position: { lat: 12.97049, lon: 77.59049 }, orientation: quatFromBearing(45) },  // near node 3, facing NE
});

console.log('node ids :', result.nodeIds.join(' -> '));
console.log('distance :', result.distanceM, 'm');
console.log('poses    :');
for (const p of result.poses) console.log(`  ${p.position.lat}, ${p.position.lon}  yaw=${p.yaw_deg}°`);
