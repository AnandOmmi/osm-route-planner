const assert = require('assert');
const path = require('path');
const { parseOsm, planRoute, planRouteFromFile, planMultiRoute, nextStart, quatFromBearing, RoutePlanError } = require('..');

const osmPath = path.join(__dirname, '..', 'example', 'map.osm');
const near1 = { lat: 12.97001, lon: 77.59001 };
const near3 = { lat: 12.97049, lon: 77.59049 };
const opts = (startBearing, goalBearing) => ({
  start: { position: near1, orientation: quatFromBearing(startBearing) },
  goal: { position: near3, orientation: quatFromBearing(goalBearing) },
});

// facing NE: one-way diagonal shortcut 1 -> 3 is allowed
const ne = planRouteFromFile(osmPath, opts(45, 45));
assert.deepStrictEqual(ne.nodeIds, ['1', '3']);
assert.ok(Math.abs(ne.distanceM - 77.63) < 0.1);
assert.strictEqual(ne.poses.length, 2);
assert.strictEqual(ne.feature.geometry.type, 'LineString');

// facing SE: diagonal needs too sharp a turn, so it goes round 1 -> 4 -> 3
const graph = parseOsm(require('fs').readFileSync(osmPath, 'utf8'));
const se = planRoute(graph, opts(160, 0));
assert.deepStrictEqual(se.nodeIds, ['1', '4', '3']);

// start and goal on the same node
assert.throws(
  () => planRoute(graph, { start: opts(0, 0).start, goal: { position: near1, orientation: quatFromBearing(0) } }),
  (e) => e instanceof RoutePlanError && e.code === 'SAME_NODE'
);

// empty map
assert.throws(
  () => planRoute(parseOsm('<osm></osm>'), opts(0, 0)),
  (e) => e instanceof RoutePlanError && e.code === 'NO_NODES'
);

// multi-route: leg 2 starts at leg 1's last point, facing its last segment
const near2 = { lat: 12.97049, lon: 77.59001 };
const multi = planMultiRoute(graph, {
  start: { position: near1, orientation: quatFromBearing(0) },
  goals: [
    { position: near2, orientation: quatFromBearing(0) },   // 1 -> 2 (north)
    { position: near3, orientation: quatFromBearing(90) },  // 2 -> 3 (east)
  ],
});
assert.deepStrictEqual(multi.legs.map((l) => l.nodeIds), [['1', '2'], ['2', '3']]);
assert.strictEqual(multi.poses.length, 3);                       // shared node 2 not duplicated
assert.deepStrictEqual(multi.feature.geometry.coordinates.length, 3);
assert.ok(Math.abs(multi.distanceM - (multi.legs[0].distanceM + multi.legs[1].distanceM)) < 0.01);
const ns = nextStart(multi.legs[0]);
assert.deepStrictEqual(ns.position, { lat: 12.9705, lon: 77.59 });
assert.ok(Math.abs(ns.orientation.z - quatFromBearing(0).z) < 1e-6); // facing north

// a failing leg reports which one
assert.throws(
  () => planMultiRoute(graph, {
    start: { position: near1, orientation: quatFromBearing(0) },
    goals: [{ position: near2, orientation: quatFromBearing(0) }, { position: near1, orientation: quatFromBearing(180) }],
  }),
  (e) => e instanceof RoutePlanError && e.leg === 1
);

console.log('smoke test passed');
