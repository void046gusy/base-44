import * as THREE from 'three';
import { surfaceSet, repeatTextures } from './textures.js';

// Todas as superfícies usam texturas procedurais com albedo, normais e rugosidade.
// As UVs dos primitivos são escaladas em metros (material.userData.tile), então a
// mesma textura mantém a densidade de texels em paredes grandes e peças pequenas.

function surface(
  name,
  {
    color = 0xffffff,
    roughness = 1,
    metalness = 0,
    tile = 2.4,
    normalScale = 1,
    envMapIntensity = 0.7,
    ...extra
  } = {},
) {
  const set = surfaceSet(name);
  const material = new THREE.MeshStandardMaterial({
    color,
    map: set.map,
    normalMap: set.normalMap,
    normalScale: new THREE.Vector2(normalScale, normalScale),
    roughnessMap: set.roughnessMap,
    roughness,
    metalness,
    envMapIntensity,
    ...extra,
  });
  material.userData.tile = tile;
  return material;
}

export const M = {
  stone: surface('stoneWall', { color: 0xd9d3c2, tile: 3, normalScale: 1.15 }),
  stoneLight: surface('stoneWall', { color: 0xf6f0dc, tile: 3, normalScale: 1 }),
  stoneDark: surface('stoneWall', { color: 0x9c978b, tile: 3, normalScale: 1.15 }),
  cobble: surface('cobble', { color: 0xffffff, tile: 2.6, normalScale: 1.2 }),
  dirt: surface('dirt', { color: 0xc9b39a, tile: 2.2, normalScale: 0.9 }),
  dirtDark: surface('dirt', { color: 0x9a8874, tile: 2.2 }),
  wood: surface('wood', { color: 0xb28a5c, tile: 1.5, normalScale: 0.9 }),
  woodLight: surface('wood', { color: 0xdcb887, tile: 1.5, normalScale: 0.9 }),
  woodDark: surface('wood', { color: 0x7d5a38, tile: 1.5, normalScale: 0.9 }),
  plaster: surface('plaster', { color: 0xffffff, tile: 3.4, normalScale: 0.7 }),
  roofRed: surface('roofTiles', { color: 0xb0523d, tile: 2.1, normalScale: 1.4 }),
  roofSlate: surface('roofTiles', { color: 0x6b7583, tile: 2.1, normalScale: 1.4 }),
  roofBrown: surface('roofTiles', { color: 0x9d6f47, tile: 2.1, normalScale: 1.4 }),
  metal: surface('metal', {
    color: 0xdde2e8,
    metalness: 0.85,
    roughness: 0.8,
    tile: 1.1,
    normalScale: 0.6,
    envMapIntensity: 1.3,
  }),
  ironDark: surface('metal', {
    color: 0x5f646c,
    metalness: 0.7,
    roughness: 0.95,
    tile: 1.1,
    normalScale: 0.6,
    envMapIntensity: 1,
  }),
  clothRed: surface('cloth', { color: 0xb03a32, tile: 0.9, normalScale: 0.7 }),
  clothBlue: surface('cloth', { color: 0x40629b, tile: 0.9, normalScale: 0.7 }),
  hay: surface('hay', { color: 0xffffff, tile: 1.2, normalScale: 1.2 }),
  bark: surface('wood', { color: 0x574130, tile: 1, normalScale: 1 }),
  leaf: surface('cloth', { color: 0x27482f, tile: 1, normalScale: 0.6 }),
  rock: surface('stoneWall', { color: 0xa4a69c, tile: 2.4, normalScale: 1.2 }),
  water: new THREE.MeshStandardMaterial({
    color: 0x2b4148,
    roughness: 0.12,
    metalness: 0.35,
    envMapIntensity: 1.5,
  }),
  ember: new THREE.MeshStandardMaterial({
    color: 0xff8a3c,
    emissive: 0xff5a10,
    emissiveIntensity: 2.4,
    roughness: 0.6,
  }),
  window: new THREE.MeshStandardMaterial({
    color: 0xffd79a,
    emissive: 0xffb457,
    emissiveIntensity: 1.7,
    roughness: 0.5,
  }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1a1511, roughness: 1 }),
};

// --- UVs em metros -----------------------------------------------------------

const uvOf = (geometry) => geometry.attributes.uv;

/** Escala as UVs de uma caixa por face, mantendo a textura na escala do mundo. */
export function scaleBoxUV(geometry, w, h, d, tile) {
  const uv = uvOf(geometry);
  const faces = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let face = 0; face < 6; face++) {
    const su = faces[face][0] / tile;
    const sv = faces[face][1] / tile;
    for (let i = face * 4; i < face * 4 + 4; i++) {
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
  }
  uv.needsUpdate = true;
}

export function scaleCylinderUV(geometry, radius, height, tile) {
  const uv = uvOf(geometry);
  const su = (Math.PI * 2 * radius) / tile;
  const sv = height / tile;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
}

export function scaleConeUV(geometry, radius, height, tile) {
  const slant = Math.hypot(radius, height);
  const uv = uvOf(geometry);
  const su = (Math.PI * 2 * radius) / tile;
  const sv = slant / tile;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
}

const tileOf = (material) => material?.userData?.tile ?? 0;

// --- primitivos --------------------------------------------------------------

export function box(w, h, d, material, x = 0, y = 0, z = 0, opts = {}) {
  const { cast = true, receive = true, parent = null, rotY = 0, rotX = 0, rotZ = 0 } = opts;
  const geometry = new THREE.BoxGeometry(w, h, d);
  const tile = tileOf(material);
  if (tile > 0) scaleBoxUV(geometry, w, h, d, tile);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rotX, rotY, rotZ);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (parent) parent.add(mesh);
  return mesh;
}

export function cylinder(rTop, rBottom, height, segments, material, x = 0, y = 0, z = 0, opts = {}) {
  const { cast = true, receive = true, parent = null, rotY = 0 } = opts;
  const geometry = new THREE.CylinderGeometry(rTop, rBottom, height, segments);
  const tile = tileOf(material);
  if (tile > 0) scaleCylinderUV(geometry, (rTop + rBottom) / 2, height, tile);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (parent) parent.add(mesh);
  return mesh;
}

export function cone(radius, height, segments, material, x = 0, y = 0, z = 0, opts = {}) {
  const { cast = true, receive = true, parent = null } = opts;
  const geometry = new THREE.ConeGeometry(radius, height, segments);
  const tile = tileOf(material);
  if (tile > 0) scaleConeUV(geometry, radius, height, tile);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (parent) parent.add(mesh);
  return mesh;
}

export function plane(w, h, material, x = 0, y = 0, z = 0, opts = {}) {
  const { parent = null, rotY = 0, cast = false, receive = false } = opts;
  const geometry = new THREE.PlaneGeometry(w, h);
  const tile = tileOf(material);
  if (tile > 0) {
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile);
    uv.needsUpdate = true;
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (parent) parent.add(mesh);
  return mesh;
}

// --- texturas especiais ------------------------------------------------------

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Estandarte do reino: campo vinho, borda e coroa dourada. */
export function sigilTexture() {
  return canvasTexture(96, 192, (ctx, w, h) => {
    ctx.fillStyle = '#781d1d';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e2bb63';
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#e2bb63';
    ctx.beginPath();
    ctx.moveTo(22, 104);
    ctx.lineTo(22, 68);
    ctx.lineTo(35, 86);
    ctx.lineTo(48, 58);
    ctx.lineTo(61, 86);
    ctx.lineTo(74, 68);
    ctx.lineTo(74, 104);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(22, 108, 52, 8);
  });
}

/** Alvenaria de pedra para muralhas e castelo. */
export function brickTexture() {
  return surfaceSet('stoneWall').map;
}

export function brickMaterial(_repeatX, _repeatY, tint = 0xffffff) {
  if (tint === 0xffffff) return M.stone;
  return new THREE.MeshStandardMaterial({
    color: tint,
    map: surfaceSet('stoneWall').map,
    normalMap: surfaceSet('stoneWall').normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: surfaceSet('stoneWall').roughnessMap,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.7,
  });
}

/** Calçamento de pedra do pátio do reino. */
export function cobbleTexture(repeatX = 44, repeatY = 40) {
  const textures = repeatTextures(surfaceSet('cobble'), repeatX, repeatY);
  return textures.map;
}

export function cobbleMaterial(repeatX = 44, repeatY = 40) {
  const textures = repeatTextures(surfaceSet('cobble'), repeatX, repeatY);
  return new THREE.MeshStandardMaterial({
    map: textures.map,
    normalMap: textures.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughnessMap: textures.roughnessMap,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.7,
  });
}

/** Terreno gramado: detalhe multiplicado pelas cores por vértice. */
export function groundMaterial(repeat = 72) {
  const textures = repeatTextures(surfaceSet('ground'), repeat, repeat);
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: textures.map,
    normalMap: textures.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: textures.roughnessMap,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.6,
  });
}

/** Placa de madeira com o nome do estabelecimento. */
export function signTexture(text) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3a2a1b';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c9a35a';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#ecd9a6';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2, w - 40);
  });
}

/** Toldo listrado das barracas do mercado. */
export function stripeTexture(a = '#8d2b2b', b = '#e6dcc2') {
  const texture = canvasTexture(64, 64, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? a : b;
      ctx.fillRect((i * w) / 8, 0, w / 8, h);
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  return texture;
}

/** Textura macia para fumaça e brilho das brechas. */
export function softDotTexture(color = 0xffffff) {
  const c = new THREE.Color(color);
  const rgb = `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`;
  return canvasTexture(64, 64, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, `rgba(${rgb}, 1)`);
    gradient.addColorStop(0.45, `rgba(${rgb}, 0.5)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
}
