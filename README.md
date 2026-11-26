# @anandommi/osm-route-planner

[![CI](https://github.com/AnandOmmi/osm-route-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/AnandOmmi/osm-route-planner/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@anandommi/osm-route-planner)](https://www.npmjs.com/package/@anandommi/osm-route-planner)

Heading-aware shortest path over an OpenStreetMap (`.osm` XML) road graph.
Respects `oneway` tags and never turns more than 90° from the current heading.

## Install

```bash
npm install @anandommi/osm-route-planner
```

## Usage

```js
const { planRouteFromFile, quatFromBearing } = require('@anandommi/osm-route-planner');

const result = planRouteFromFile('./map.osm', {
  start: { position: { lat: 12.97001, lon: 77.59001 }, orientation: quatFromBearing(45) },
  goal:  { position: { lat: 12.97049, lon: 77.59049 }, orientation: quatFromBearing(0) },
});

result.nodeIds;   // ['1', '3']
result.distanceM; // 77.63
result.poses;     // [{ position: {lat, lon}, orientation: {x, y, z, w}, yaw_deg }]
result.feature;   // GeoJSON LineString Feature
```

## API

| Function | Input |
|---|---|
| `planRouteFromFile(path, opts)` | local `.osm` file (Node only) |
| `planRouteFromUrl(url, opts)` | URL, returns a Promise |
| `planRouteFromOsm(xmlText, opts)` | OSM XML string |
| `parseOsm(xmlText)` → `planRoute(graph, opts)` | parse once, plan many routes |
| `planMultiRoute(graph, { start, goals })` | chained legs: each leg starts where the last one ended |
| `nextStart(route)` | start pose for the next leg (last point + last-segment heading) |
| `quatFromBearing(deg)` | compass bearing (0 = N, clockwise) → ENU quaternion |

`opts = { start, goal }`, each `{ position: { lat, lon }, orientation: { x, y, z, w } }`.

Errors are `RoutePlanError` with `code`: `BAD_INPUT`, `NO_NODES`, `SAME_NODE`, `NO_PATH`.

Step-by-step explanation (parsing, snapping, heading rules, poses, chaining): [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)

## Multi-route (chained legs)

To plan route after route, start each new leg where the previous one ended:

- **start position** = last coordinate of the previous route
- **start orientation** = direction of its last segment (second-last → last point), so the vehicle keeps facing the way it arrived
- **goal** = the new goal you pick

All legs at once:

```js
const { parseOsm, planMultiRoute, quatFromBearing } = require('@anandommi/osm-route-planner');

const graph = parseOsm(osmText);
const trip = planMultiRoute(graph, {
  start: { position: { lat: 12.97001, lon: 77.59001 }, orientation: quatFromBearing(0) },
  goals: [
    { position: { lat: 12.97049, lon: 77.59001 }, orientation: quatFromBearing(0) },
    { position: { lat: 12.97049, lon: 77.59049 }, orientation: quatFromBearing(90) },
  ],
});
trip.legs;      // one planRoute result per leg
trip.poses;     // all legs joined (shared joint point appears once)
trip.distanceM; // total
trip.feature;   // one GeoJSON LineString for the whole trip
```

If a leg fails, the `RoutePlanError` has `leg` (0-based) set, e.g. `leg 2: No path matches ...`.

One leg at a time (interactive UI, goal picked after each route):

```js
let start = { position: vehicle.position, orientation: vehicle.orientation };
const leg1 = planRoute(graph, { start, goal: goal1 });
start = nextStart(leg1);                       // continue from end of leg1
const leg2 = planRoute(graph, { start, goal: goal2 });
```

To undo the last leg, drop it and call `nextStart()` on the one before it (or go back to the original start).

## Development

```bash
npm test          # smoke test against example/map.osm
npm run example   # print a sample route
```

Releases: bump the version, add a `CHANGELOG.md` entry, push a `v*` tag; the publish workflow runs the tests and publishes to npm (needs the `NPM_TOKEN` repo secret).

## License

BSD-3-Clause
