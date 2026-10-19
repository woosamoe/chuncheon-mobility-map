'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const data = JSON.parse(fs.readFileSync('site/public/data/banner-routes.json', 'utf8'));
const routes = data.routes;
const ids = routes.map(route => route.id);
assert.equal(routes.length, 82, 'all XLSX route IDs should be retained');
assert.equal(new Set(ids).size, routes.length, 'route IDs should be unique');
assert.equal(routes.filter(route => Number.isFinite(route.capacity)).length, 75,
  '75 routes should have a numeric capacity');
assert.equal(routes.reduce((sum, route) => sum + (route.capacity || 0), 0), 1303,
  'capacity total should include both A/B directions for X2-X5');
assert.equal(routes.find(route => route.id === 'X2').capacity, 40,
  'X2 should combine its two 20-unit directions');
assert.equal(routes.find(route => route.id === 'A10').capacity, 26,
  'A10 numeric capacity should be recovered from the source text');
assert.equal(routes.find(route => route.id === 'D6').capacity, null,
  'missing source capacities must remain missing');
assert(fs.existsSync('site/public/assets/banner-routes-reference.webp'),
  'route reference image should be packaged');
const lines = JSON.parse(fs.readFileSync('site/public/data/banner-route-lines.json', 'utf8'));
assert.equal(lines.metadata.pathCount, 39, 'all digitized corridor paths should be retained');
assert.equal(lines.metadata.snappedPathCount, 39, 'every corridor path should be aligned to the road network');
assert.equal(lines.metadata.fallbackPathCount, 0, 'road-network data should not contain unsnapped fallback paths');
const index = fs.readFileSync('site/public/index.html', 'utf8');
assert(index.includes('./banner-routes.js'), 'route UI script should be loaded');
const routeUi = fs.readFileSync('site/public/banner-routes.js', 'utf8');
assert(routeUi.includes('L.polyline'), 'streetlight routes should render as Leaflet vectors');
assert(routeUi.includes("./data/banner-route-lines.json"), 'road-aligned vector data should be loaded');
assert(routeUi.includes('벡터 노선 표시'), 'vector route visibility control should be present');
assert(!routeUi.includes('L.imageOverlay'), 'reference image must not be overlaid on the map');
console.log('Banner route smoke test passed: 82 IDs, 75 counted routes, 1,303 total capacity.');
