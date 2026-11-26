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
| `quatFromBearing(deg)` | compass bearing (0 = N, clockwise) → ENU quaternion |

`opts = { start, goal }`, each `{ position: { lat, lon }, orientation: { x, y, z, w } }`.

Errors are `RoutePlanError` with `code`: `BAD_INPUT`, `NO_NODES`, `SAME_NODE`, `NO_PATH`.

## Development

```bash
npm test          # smoke test against example/map.osm
npm run example   # print a sample route
```

Releases: bump the version, add a `CHANGELOG.md` entry, push a `v*` tag; the publish workflow runs the tests and publishes to npm (needs the `NPM_TOKEN` repo secret).

## License

BSD-3-Clause
