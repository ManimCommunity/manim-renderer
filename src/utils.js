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
  ];
}

export function allClose(arr1, arr2) {
  console.assert(
    arr1.length === arr2.length,
    "Called allClose() on arrays of different lengths"
  );
  for (let j = 0; j < arr1.length; j++) {
    if (Math.abs(arr1[j] - arr2[j]) > 1e-6) {
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
