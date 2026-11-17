import * as THREE from 'three';
import { cobbleMaterial, groundMaterial } from './materials.js';
import { KINGDOM, RIFTS, GATE } from './layout.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Altura do terreno: plano dentro do reino, colinas suaves na floresta. */
export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  const outside = smoothstep(74, 168, r);
  const hills =
    Math.sin(x * 0.021) * Math.cos(z * 0.017) * 3.1 +
    Math.sin(x * 0.0085 + z * 0.013) * 5.2 +
    Math.cos(z * 0.031 + x * 0.004) * 1.6;
  return hills * outside;
}

function distanceToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = dx * dx + dz * dz || 1;
  const t = clamp01(((px - ax) * dx + (pz - az) * dz) / len);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function hash(x, z) {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function groundPlane(size, segments, y, material) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

export function createTerrain(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // --- terreno geral
  const size = 760;
  const segments = 240;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const position = geo.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const grass = new THREE.Color(0x415c31);
  const grassDark = new THREE.Color(0x27381e);
  const moss = new THREE.Color(0x36492a);
  const dirt = new THREE.Color(0x7d6a4d);
  const mixed = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, heightAt(x, z));

    const noise = hash(x * 0.35, z * 0.35);
    mixed.copy(grass).lerp(grassDark, noise * 0.7).lerp(moss, hash(x * 0.08, z * 0.08) * 0.5);

    const onRoad = Math.abs(x) < 8.5 && z > GATE.z - 2 && z < 190;
    const onTrail = RIFTS.some((rift) => distanceToSegment(x, z, rift.x, rift.z, GATE.x, GATE.z) < 3.2);
    if (onRoad || onTrail) mixed.lerp(dirt, onTrail ? 0.88 : 0.72);

    colors[i * 3] = mixed.r;
    colors[i * 3 + 1] = mixed.g;
    colors[i * 3 + 2] = mixed.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const ground = new THREE.Mesh(geo, groundMaterial(150));
  ground.receiveShadow = true;
  root.add(ground);

  // --- calçamento interno do reino
  const courtyardWidth = KINGDOM.maxX - KINGDOM.minX - 4;
  const courtyardDepth = KINGDOM.maxZ - KINGDOM.minZ - 4;
  const courtyard = groundPlane(
    Math.max(courtyardWidth, courtyardDepth),
    1,
    0.05,
    cobbleMaterial(courtyardWidth / 2.6, courtyardDepth / 2.6),
  );
  courtyard.scale.set(courtyardWidth / Math.max(courtyardWidth, courtyardDepth), 1, courtyardDepth / Math.max(courtyardWidth, courtyardDepth));
  courtyard.position.set(0, 0.05, (KINGDOM.minZ + KINGDOM.maxZ) / 2);
  root.add(courtyard);

  return root;
}
