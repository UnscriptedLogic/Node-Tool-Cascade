import { S } from "./state.js";
export let ANALYTICS, ANALYTICS_OFF;
export function analyticsAllowed() {
  try {
    if (localStorage.getItem(ANALYTICS_OFF) === '1') return false;
  } catch (e) {}
  return !(navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl);
}
export function track(name, o) {
  if (!ANALYTICS.on || !analyticsAllowed()) return;
  try {
    const body = JSON.stringify(Object.assign({
      name
    }, o || {}));
    if (!(navigator.sendBeacon && navigator.sendBeacon('/api/event', new Blob([body], {
      type: 'application/json'
    })))) fetch('/api/event', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body,
      keepalive: true
    }).catch(() => {});
  } catch (e) {}
}
// ghost suggestions a person kept or dismissed, counted per block type
export function trackGhosts(name, ids) {
  const by = {};
  ids.forEach(i => {
    const n = S.nodes[i];
    if (n && n.ghost) by[n.type] = (by[n.type] || 0) + 1;
  });
  Object.keys(by).forEach(t => track(name, {
    label: t,
    count: by[t]
  }));
}
export function initialize() {
  ANALYTICS = {
    on: false
  };
  ANALYTICS_OFF = 'cascade-analytics-off';
}
