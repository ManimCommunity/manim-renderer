import * as THREE from "three";

const snakeToCamel = (str) =>
  str.replace(/([-_][a-z])/g, (group) =>
    group
      .toUpperCase()
      .replace("-", "")
      .replace("_", "")
  );

export function snakeToCamelDict(dict) {
  let camelCaseDict = {};
  for (let [key, val] of Object.entries(dict)) {
    camelCaseDict[snakeToCamel(key)] = val;
  }
  return camelCaseDict;
}

export function extractMobjectProto(mobjectProto) {
  let points = [];
  for (let point of mobjectProto.vectorized_mobject_data.points) {
    points.push([point.x, point.y, point.z]);
  }
  return [
    mobjectProto.id,
    points,
    snakeToCamelDict(mobjectProto.style),
    mobjectProto.vectorized_mobject_data.needs_redraw,
    mobjectProto.root_mobject_offset,
  ];
}

export function extractPoints(mobjectProto) {
  let points = [];
  for (let point of mobjectProto.vectorized_mobject_data.points) {
    let { x, y, z } = point;
    points.push(new THREE.Vector3(x, y, z));
  }

  let boundingBox = new THREE.Box3().setFromPoints(points);
  let center = new THREE.Vector3();
  boundingBox.getCenter(center);

  for (let point of points) {
    point.sub(center);
  }

  return [points, center];
}

export function allClose(vec1, vec2) {
  for (let coord of ["x", "y", "z"]) {
    if (Math.abs(vec1[coord] - vec2[coord]) > 1e-6) {
      return false;
    }
  }
  return true;
}

// https://github.com/mrdoob/three.js/blob/0950e5b6e8bceb520c154f45b5c240af45f0ed11/src/extras/core/ShapePath.js#L87
export function isPointInsidePolygon(inPt, inPolygon) {
  var polyLen = inPolygon.length;

  // inPt on polygon contour => immediate success    or
  // toggling of inside/outside at every single! intersection point of an edge
  //  with the horizontal line through inPt, left of inPt
  //  not counting lowerY endpoints of edges and whole edges on that line
  var inside = false;
  for (var p = polyLen - 1, q = 0; q < polyLen; p = q++) {
    var edgeLowPt = inPolygon[p];
    var edgeHighPt = inPolygon[q];

    var edgeDx = edgeHighPt.x - edgeLowPt.x;
    var edgeDy = edgeHighPt.y - edgeLowPt.y;

    if (Math.abs(edgeDy) > Number.EPSILON) {
      // not parallel
      if (edgeDy < 0) {
        edgeLowPt = inPolygon[q];
        edgeDx = -edgeDx;
        edgeHighPt = inPolygon[p];
        edgeDy = -edgeDy;
      }
      if (inPt.y < edgeLowPt.y || inPt.y > edgeHighPt.y) continue;

      if (inPt.y === edgeLowPt.y) {
        if (inPt.x === edgeLowPt.x) return true; // inPt is on contour ?
        // continue;				// no intersection or edgeLowPt => doesn't count !!!
      } else {
        var perpEdge =
          edgeDy * (inPt.x - edgeLowPt.x) - edgeDx * (inPt.y - edgeLowPt.y);
        if (perpEdge === 0) return true; // inPt is on contour ?
        if (perpEdge < 0) continue;
        inside = !inside; // true intersection left of inPt
      }
    } else {
      // parallel or collinear
      if (inPt.y !== edgeLowPt.y) continue; // parallel
      // edge lies on the same horizontal line as inPt
      if (
        (edgeHighPt.x <= inPt.x && inPt.x <= edgeLowPt.x) ||
        (edgeLowPt.x <= inPt.x && inPt.x <= edgeHighPt.x)
      )
        return true; // inPt: Point on contour !
      // continue;
    }
  }

  return inside;
}

export function clip(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function sigmoid(x) {
  return 1.0 / (1 + Math.exp(-x));
}

export function smooth(t, inflection = 10) {
  let error = sigmoid(-inflection / 2);
  return clip(
    (sigmoid(inflection * (t - 0.5)) - error) / (1 - 2 * error),
    0,
    1
  );
}

export function there_and_back(t, inflection = 10) {
  let new_t = t < 0.5 ? 2 * t : 2 * (1 - t);
  return smooth(new_t, inflection);
}

export function interpolate(a, b, t) {
  return a + t * b;
}
