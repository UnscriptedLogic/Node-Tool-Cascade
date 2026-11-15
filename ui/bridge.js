const legacy = {};

export function connect(values) {
  Object.assign(legacy, values);
}

export function getLegacy() {
  return legacy;
}
