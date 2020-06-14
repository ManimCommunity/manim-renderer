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
  for (let point of mobjectProto.points) {
    points.push([point.x, point.y, point.z]);
  }
  return [mobjectProto.id, points, snakeToCamelDict(mobjectProto.style)];
}
