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

## Loading the OSM file

The planner works on OSM XML text. Pick the function that matches what you have:

| You have | Use |
|---|---|
| file path | `planRouteFromFile(path, opts)` (Node only) |
| URL | `await planRouteFromUrl(url, opts)` (Node 18+ / browser) |
| XML string or uploaded file | `planRouteFromOsm(text, opts)` |
| many routes on the same map | `parseOsm(text)` once, then `planRoute(graph, opts)` |

**File path**

```js
const route = planRouteFromFile('./map.osm', { start, goal });
```

**URL**

```js
const route = await planRouteFromUrl('https://example.com/map.osm', { start, goal });
```

**Text** (upload, database, browser `<input type="file">`, …)

```js
const text = await fileInput.files[0].text();   // browser example
const route = planRouteFromOsm(text, { start, goal });
```

**Parse once, plan many** (recommended for big maps: parsing takes seconds, each route takes milliseconds)

```js
const fs = require('fs');
const { parseOsm, planRoute } = require('@anandommi/osm-route-planner');

const graph = parseOsm(fs.readFileSync('./map.osm', 'utf8'));
const route1 = planRoute(graph, { start, goal: goal1 });
const route2 = planRoute(graph, { start, goal: goal2 });
```

All of them return the same result: `{ nodeIds, poses, distanceM, feature }`.

## API

| Function | Input |
|---|---|
| `planRouteFromFile(path, opts)` | local `.osm` file (Node only) |
| `planRouteFromUrl(url, opts)` | URL, returns a Promise |
| `planRouteFromOsm(xmlText, opts)` | OSM XML string |
| `parseOsm(xmlText)` → `planRoute(graph, opts)` | parse once, plan many routes |
| `nextStart(route)` | start pose for the next route (last point + last-segment heading) |
| `planMultiRoute(graph, { start, goals })` | optional: several routes in one call |
| `quatFromBearing(deg)` | compass bearing (0 = N, clockwise) → ENU quaternion |

`opts = { start, goal }`, each `{ position: { lat, lon }, orientation: { x, y, z, w } }`.

Errors are `RoutePlanError` with `code`: `BAD_INPUT`, `NO_NODES`, `SAME_NODE`, `NO_PATH`.

Step-by-step explanation (parsing, snapping, heading rules, poses, chaining): [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)

## Multi-route

`planRoute` plans one route: one start, one goal. For more routes, plan them one by one and use the **end of the previous route as the start of the next one**:

- **start position** = last point of the previous route
- **start orientation** = direction of its last segment, so the robot keeps facing the way it arrived
- **goal** = the new goal

`nextStart(route)` gives you that start:

```js
const { parseOsm, planRoute, nextStart, quatFromBearing } = require('@anandommi/osm-route-planner');

const graph = parseOsm(osmText);

// route 1
const route1 = planRoute(graph, {
  start: { position: { lat: 12.97001, lon: 77.59001 }, orientation: quatFromBearing(0) },
  goal:  { position: { lat: 12.97049, lon: 77.59001 }, orientation: quatFromBearing(0) },
});

// route 2 starts where route 1 ended
const route2 = planRoute(graph, {
  start: nextStart(route1),
  goal:  { position: { lat: 12.97049, lon: 77.59049 }, orientation: quatFromBearing(90) },
});

// route 3: start = nextStart(route2), and so on
```

To undo the last route, drop it and use `nextStart()` of the route before it (or the original start). This is the recommended way: each route can be checked and removed on its own.

### Optional: all routes in one call

If you already know every goal and don't need to check routes one by one, `planMultiRoute` does the same chaining in one call (`start → goals[0] → goals[1] → …`):

```js
const trip = planMultiRoute(graph, {
  start: { position: { lat: 12.97001, lon: 77.59001 }, orientation: quatFromBearing(0) },
  goals: [
    { position: { lat: 12.97049, lon: 77.59001 }, orientation: quatFromBearing(0) },  // route 1
    { position: { lat: 12.97049, lon: 77.59049 }, orientation: quatFromBearing(90) }, // route 2
  ],
});
trip.routes;     // each route (same as planRoute results)
trip.poses;      // all routes joined, joint points not repeated
trip.distanceM;  // total
trip.feature;    // one GeoJSON LineString
```

If any route fails, the whole call throws a `RoutePlanError` with `leg` = index of the failing route (e.g. `route 2: No path matches ...`).

## License

BSD-3-Clause
