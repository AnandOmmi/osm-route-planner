export interface LatLon { lat: number; lon: number; }
export interface Quaternion { x?: number; y?: number; z: number; w: number; }
export interface PoseInput { position: LatLon; orientation: Quaternion; }
export interface RouteOptions { start: PoseInput; goal: PoseInput; }

export interface Pose {
  position: LatLon;
  orientation: { x: number; y: number; z: number; w: number };
  yaw_deg: number;
}

export interface RouteResult {
  nodeIds: string[];
  poses: Pose[];
  distanceM: number;
  feature: {
    type: 'Feature';
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    properties: { distance_m: number };
  };
}

export interface OsmGraph {
  nodes: Map<string, LatLon>;
  adj: Map<string, { to: string; dist: number; bearing: number }[]>;
  ways: { refs: string[]; oneway: boolean; tags: Record<string, string> }[];
}

export type RoutePlanErrorCode = 'BAD_INPUT' | 'NO_NODES' | 'SAME_NODE' | 'NO_PATH';
export class RoutePlanError extends Error {
  code: RoutePlanErrorCode;
  /** 0-based index of the failing route (planMultiRoute only) */
  leg?: number;
}

export interface MultiRouteOptions { start: PoseInput; goals: PoseInput[]; }
export interface MultiRouteResult {
  routes: RouteResult[];
  poses: Pose[];
  distanceM: number;
  feature: {
    type: 'Feature';
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    properties: { distance_m: number; routes: number };
  };
}

export function parseOsm(xmlText: string): OsmGraph;
export function planRoute(graph: OsmGraph, options: RouteOptions): RouteResult;
export function planRouteFromOsm(xmlText: string, options: RouteOptions): RouteResult;
export function planRouteFromFile(filePath: string, options: RouteOptions): RouteResult;
export function planRouteFromUrl(url: string, options: RouteOptions): Promise<RouteResult>;
/** Start pose for the next route: last point of `route`, facing its last segment. */
export function nextStart(route: RouteResult): PoseInput;
/** Optional: plan start -> goals[0] -> goals[1] -> ... in one call. */
export function planMultiRoute(graph: OsmGraph, options: MultiRouteOptions): MultiRouteResult;
export function quatFromBearing(bearingDeg: number): { x: number; y: number; z: number; w: number };
