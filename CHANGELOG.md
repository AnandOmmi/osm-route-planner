# Changelog

## 0.1.0 — 2026-11-26

First release.

- Parse `.osm` XML into a road graph (`parseOsm`), honouring `oneway` tags.
- Heading-aware shortest path (`planRoute`): state-space Dijkstra that never turns more than 90° from the current heading and checks the goal heading.
- Oriented pose output (lat/lon + ENU quaternion + yaw) and a GeoJSON LineString.
- Loaders: `planRouteFromOsm` (string), `planRouteFromFile` (Node), `planRouteFromUrl` (fetch).
- Multi-route: `nextStart(route)` gives the start pose for the next route (previous route's last point, facing its last segment). Optional `planMultiRoute` plans several goals in one call.
- `quatFromBearing` helper and `RoutePlanError` with codes `BAD_INPUT`, `NO_NODES`, `SAME_NODE`, `NO_PATH`.
