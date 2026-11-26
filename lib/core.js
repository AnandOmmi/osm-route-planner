// Heading-aware shortest path over an OSM road graph.
const { DOMParser } = require('@xmldom/xmldom');

// ─── MinHeap ─────────────────────────────────────────────────────────────────

class MinHeap {
  constructor() { this._d = []; }
  get size() { return this._d.length; }
  push(item) {
    this._d.push(item);
    this._up(this._d.length - 1);
  }
  pop() {
    const top  = this._d[0];
    const last = this._d.pop();
    if (this._d.length > 0) { this._d[0] = last; this._down(0); }
    return top;
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._d[i][0] < this._d[p][0]) {
        [this._d[i], this._d[p]] = [this._d[p], this._d[i]]; i = p;
      } else break;
    }
  }
  _down(i) {
    const n = this._d.length;
    for (;;) {
      let s = i;
      const l = 2 * i + 1, r = l + 1;
      if (l < n && this._d[l][0] < this._d[s][0]) s = l;
      if (r < n && this._d[r][0] < this._d[s][0]) s = r;
      if (s === i) break;
      [this._d[i], this._d[s]] = [this._d[s], this._d[i]]; i = s;
    }
  }
}

// ─── Haversine distance in metres ────────────────────────────────────────────

const haversine = (lat1, lon1, lat2, lon2) => {
  const R  = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a  =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Heading / quaternion helpers (ENU yaw, REP-103) ─────────────────────────
//
// Convention is matched to the frontend:
//   compass bearing (0 = N, clockwise)  →  ENU yaw (0 = E, CCW)  →  {z, w}
//   recover with: yaw = 2 * atan2(z, w)

const toDeg = (r) => (r * 180) / Math.PI;

const bearingDeg = (lat1, lon1, lat2, lon2) => {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y  = Math.sin(Δλ) * Math.cos(φ2);
  const x  = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

// compass bearing → unit quaternion {x, y, z, w} (yaw-only)
const quatFromBearing = (bearing) => {
  const yawEnu = (((90 - bearing + 360) % 360) * Math.PI) / 180;
  return { x: 0, y: 0, z: Math.sin(yawEnu / 2), w: Math.cos(yawEnu / 2) };
};

// normalise a caller-supplied orientation to a full unit quaternion
const asQuat = (o) => {
  const x = o?.x ?? 0;
  const y = o?.y ?? 0;
  const z = o?.z ?? 0;
  const w = o?.w ?? 1;
  const m = Math.hypot(x, y, z, w) || 1;
  return { x: x / m, y: y / m, z: z / m, w: w / m };
};

const yawDegFromQuat = ({ z, w }) => ((2 * Math.atan2(z, w) * 180) / Math.PI + 360) % 360;

// ENU quaternion → compass bearing (0=N, CW):
//   start_heading = (90 - yaw_deg + 360) % 360
const compassFromQuat = (q) => {
  const { z, w } = asQuat(q ?? { z: 0, w: 1 });
  const yawDeg   = yawDegFromQuat({ z, w });
  return (90 - yawDeg + 360) % 360;
};

// Angular difference between two compass bearings (always 0-180)
const headingDiff = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

// True when bearing b is within `tol` degrees of target a
const isHeadingValid = (a, b, tol = 90) => headingDiff(a, b) <= tol;

const parseOsm = (xmlText) => {
  const doc   = new DOMParser().parseFromString(xmlText, "text/xml");
  const nodes = new Map();
  const adj   = new Map();
  const ways  = [];

  for (const node of Array.from(doc.getElementsByTagName("node"))) {
    const id  = node.getAttribute("id");
    const lat = parseFloat(node.getAttribute("lat"));
    const lon = parseFloat(node.getAttribute("lon"));
    if (id && !isNaN(lat) && !isNaN(lon)) {
      nodes.set(id, { lat, lon });
      adj.set(id, []);
    }
  }

  for (const way of Array.from(doc.getElementsByTagName("way"))) {
    const refs = Array.from(way.getElementsByTagName("nd"))
      .map((nd) => nd.getAttribute("ref"))
      .filter((r) => nodes.has(r));

    if (refs.length < 2) continue;

    const tags = {};
    for (const tag of Array.from(way.getElementsByTagName("tag"))) {
      tags[tag.getAttribute("k")] = tag.getAttribute("v");
    }

    const onewayVal = tags["oneway"];
    const oneway    = onewayVal === "yes"  || onewayVal === "1"  || onewayVal === "true";
    const onewayRev = onewayVal === "-1"   || onewayVal === "reverse";
    ways.push({ refs, oneway: oneway || onewayRev, tags });

    for (let i = 0; i < refs.length - 1; i++) {
      const a  = refs[i];
      const b  = refs[i + 1];
      const na = nodes.get(a), nb = nodes.get(b);
      const dist = haversine(na.lat, na.lon, nb.lat, nb.lon);
      // oneway=-1 reverses direction: only b→a allowed
      if (!onewayRev) adj.get(a).push({ to: b, dist, bearing: bearingDeg(na.lat, na.lon, nb.lat, nb.lon) });
      if (!oneway)    adj.get(b).push({ to: a, dist, bearing: bearingDeg(nb.lat, nb.lon, na.lat, na.lon) });
    }
  }

  return { nodes, adj, ways };
};

// ─── Nearest node ─────────────────────────────────────────────────────────────

const nearestNode = (nodes, lat, lon) => {
  let bestId   = null;
  let bestDist = Infinity;
  for (const [id, n] of nodes) {
    const d = haversine(lat, lon, n.lat, n.lon);
    if (d < bestDist) { bestDist = d; bestId = id; }
  }
  return bestId;
};


// ─── Heading-bucketed state-space Dijkstra ───────────────────────────────────
//
// State = (nodeId, bucket(heading)).  An edge is skipped when
// its bearing is more than 90° from the incoming heading.

const HEADING_BUCKET = 10.0;

const findPathWithHeadingsDijkstra = (
  nodes, adj, startId, goalId, startHeading, goalHeading, reverseAllowed, totalNodes
) => {
  const bucket  = (h) => ((Math.round(h / HEADING_BUCKET) * HEADING_BUCKET) % 360 + 360) % 360;
  const stateKey = (id, h) => `${id}:${bucket(h)}`;

  const heap    = new MinHeap();
  const gScore  = new Map();
  const cameFrom = new Map();
  const closed  = new Set();

  const s0 = stateKey(startId, startHeading);
  gScore.set(s0, 0);
  heap.push([0, startId, startHeading]);

  while (heap.size > 0) {
    const [cost, node, prevHeading] = heap.pop();
    const state = stateKey(node, prevHeading);

    if (closed.has(state)) continue;
    closed.add(state);

    if (node === goalId && isHeadingValid(prevHeading, goalHeading)) {
      // Reconstruct path: follow cameFrom from state back to start
      const path = [];
      let cur = state;
      while (cur !== undefined) {
        path.push(cur.split(":")[0]);      // extract nodeId
        cur = cameFrom.get(cur);
      }
      path.reverse();
      return path;
    }

    // Heading-illegal edges are pruned outright: a path stitched together
    // via a heading-illegal hop means no route exists that actually matches
    // the requested direction, so there is nothing to reach for by paying a
    // penalty and exploring it anyway (reverseAllowed retained in the
    // signature for API compatibility; it no longer widens the search).
    for (const edge of (adj.get(node) || [])) {
      if (!isHeadingValid(prevHeading, edge.bearing)) continue;

      const newCost   = cost + edge.dist;
      const nextState = stateKey(edge.to, edge.bearing);
      const existing  = gScore.get(nextState);

      if (existing === undefined || newCost < existing) {
        gScore.set(nextState, newCost);
        cameFrom.set(nextState, state);
        heap.push([newCost, edge.to, edge.bearing]);
      }
    }
  }
  return null;
};

// ─── Build an oriented pose path from the node id sequence ────────────────────
//
// pose[0]    → caller-supplied start orientation (robot's current heading)
// pose[last] → caller-supplied goal orientation
// interior   → forward tangent (bearing from this waypoint to the next)
// Zero-length segments carry the previous heading rather than snapping to 0°.

const buildPosePath = (pathIds, nodes, startOri, goalOri) => {
  const n = pathIds.length;
  const pts = pathIds.map((id) => nodes.get(id));

  // Per-segment forward bearing, with carry-over across degenerate segments.
  const segBearing = new Array(Math.max(n - 1, 0)).fill(null);
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const d = haversine(a.lat, a.lon, b.lat, b.lon);
    segBearing[i] = d < 1e-6 ? (i > 0 ? segBearing[i - 1] : null) : bearingDeg(a.lat, a.lon, b.lat, b.lon);
  }
  // Backfill any leading nulls from the first valid bearing.
  const firstValid = segBearing.find((b) => b !== null) ?? 0;
  for (let i = 0; i < segBearing.length; i++) {
    if (segBearing[i] === null) segBearing[i] = i > 0 ? segBearing[i - 1] : firstValid;
  }

  return pts.map((p, i) => {
    let orientation;
    if (i === 0 && startOri) {
      orientation = asQuat(startOri);
    } else if (i === n - 1 && goalOri) {
      orientation = asQuat(goalOri);
    } else {
      // leaving-bearing for interior points, arriving-bearing for the last point
      const brg = i < n - 1 ? segBearing[i] : segBearing[n - 2];
      orientation = quatFromBearing(brg ?? firstValid);
    }
    return {
      position:    { lat: p.lat, lon: p.lon },
      orientation,                                  // { x, y, z, w }
      yaw_deg:     parseFloat(yawDegFromQuat(orientation).toFixed(2)),
    };
  });
};

// ─── Public API ──────────────────────────────────────────────────────────────

class RoutePlanError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// graph = result of parseOsm(xmlText)
const planRoute = (graph, { start, goal }) => {
  const { nodes, adj } = graph;
  if (!start?.position || !goal?.position) throw new RoutePlanError('BAD_INPUT', 'start and goal positions required.');
  if (!start.orientation || !goal.orientation) throw new RoutePlanError('BAD_INPUT', 'start and goal orientation required.');
  if (nodes.size === 0) throw new RoutePlanError('NO_NODES', 'OSM data has no usable nodes.');

  const startId = nearestNode(nodes, start.position.lat, start.position.lon);
  const goalId  = nearestNode(nodes, goal.position.lat, goal.position.lon);
  if (startId === goalId) throw new RoutePlanError('SAME_NODE', 'Start and goal snap to the same node.');

  const pathIds = findPathWithHeadingsDijkstra(
    nodes, adj, startId, goalId,
    compassFromQuat(start.orientation), compassFromQuat(goal.orientation),
    true, nodes.size
  );
  if (!pathIds || pathIds.length < 2) throw new RoutePlanError('NO_PATH', 'No path matches start/goal position and heading.');

  const poses = buildPosePath(pathIds, nodes, start.orientation, goal.orientation);
  const coordinates = pathIds.map((id) => [nodes.get(id).lon, nodes.get(id).lat]);
  let distanceM = 0;
  for (let i = 1; i < pathIds.length; i++) {
    const a = nodes.get(pathIds[i - 1]), b = nodes.get(pathIds[i]);
    distanceM += haversine(a.lat, a.lon, b.lat, b.lon);
  }
  return {
    nodeIds: pathIds,
    poses,
    distanceM: +distanceM.toFixed(2),
    feature: { type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: { distance_m: +distanceM.toFixed(2) } },
  };
};

const planRouteFromOsm = (osmText, opts) => planRoute(parseOsm(osmText), opts);

// ─── Multi-route (chained legs) ──────────────────────────────────────────────
//
// Same chaining as the boson_webapp Route Planner: the next leg starts at the
// previous leg's last coordinate, facing the direction of its last segment
// (bearing second-last → last point), not the goal orientation the user drew.

const nextStart = (route) => {
  const pts = route?.poses?.map((p) => p.position)
    ?? route?.feature?.geometry?.coordinates?.map(([lon, lat]) => ({ lat, lon }));
  if (!pts || pts.length === 0) throw new RoutePlanError('BAD_INPUT', 'route has no points.');
  const last = pts[pts.length - 1];
  // walk back past zero-length segments so the heading is never a fake 0°
  for (let i = pts.length - 2; i >= 0; i--) {
    if (haversine(pts[i].lat, pts[i].lon, last.lat, last.lon) > 1e-6) {
      return { position: { lat: last.lat, lon: last.lon },
               orientation: quatFromBearing(bearingDeg(pts[i].lat, pts[i].lon, last.lat, last.lon)) };
    }
  }
  return { position: { lat: last.lat, lon: last.lon }, orientation: { x: 0, y: 0, z: 0, w: 1 } };
};

// Optional: plan several routes in one call. Same as calling planRoute for each
// goal with start = nextStart(previous route). Prefer one-by-one planRoute when
// the user needs to check / remove routes individually.
const planMultiRoute = (graph, { start, goals }) => {
  if (!Array.isArray(goals) || goals.length === 0) throw new RoutePlanError('BAD_INPUT', 'goals must be a non-empty array.');
  const routes = [];
  let from = start;
  for (let i = 0; i < goals.length; i++) {
    try {
      routes.push(planRoute(graph, { start: from, goal: goals[i] }));
    } catch (err) {
      if (err instanceof RoutePlanError) { err.leg = i; err.message = `route ${i + 1}: ${err.message}`; }
      throw err;
    }
    from = nextStart(routes[i]);
  }
  const poses = routes.flatMap((r, i) => (i === 0 ? r.poses : r.poses.slice(1)));
  const coordinates = routes.flatMap((r, i) => (i === 0 ? r.feature.geometry.coordinates : r.feature.geometry.coordinates.slice(1)));
  const distanceM = +routes.reduce((sum, r) => sum + r.distanceM, 0).toFixed(2);
  return {
    routes,
    poses,
    distanceM,
    feature: { type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: { distance_m: distanceM, routes: routes.length } },
  };
};

module.exports = { parseOsm, planRoute, planRouteFromOsm, nextStart, planMultiRoute, quatFromBearing, RoutePlanError };
