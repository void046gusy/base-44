import * as THREE from 'three';
import { M, cobbleTexture } from './materials.js';
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

/** Faixa de chão acompanhando o relevo (estrada e trilhas). */
function groundStrip(ax, az, bx, bz, width, material) {
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.hypot(dx, dz);
  const steps = Math.max(2, Math.ceil(length / 3));
  const px = (-dz / length) * (width / 2);
  const pz = (dx / length) * (width / 2);

  const positions = [];
  const indices = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = ax + dx * t;
    const z = az + dz * t;
    const y = heightAt(x, z) + 0.07;
    positions.push(x - px, y, z - pz, x + px, y, z + pz);
    if (i < steps) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

export function createTerrain(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // --- terreno geral
  const size = 760;
  const segments = 190;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const position = geo.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const grass = new THREE.Color(0x354a2b);
  const grassDark = new THREE.Color(0x1e2c19);
  const moss = new THREE.Color(0x2b3c22);
  const dirt = new THREE.Color(0x6b5940);
  const mixed = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, heightAt(x, z));

    const noise = hash(x * 0.35, z * 0.35);
    mixed.copy(grass).lerp(grassDark, noise * 0.7).lerp(moss, hash(x * 0.08, z * 0.08) * 0.5);

    const onRoad = Math.abs(x) < 9 && z > GATE.z - 2 && z < 190;
    const onTrail = RIFTS.some((rift) => distanceToSegment(x, z, rift.x, rift.z, GATE.x, GATE.z) < 3.4);
    if (onRoad || onTrail) mixed.lerp(dirt, onTrail ? 0.75 : 0.6);

    colors[i * 3] = mixed.r;
    colors[i * 3 + 1] = mixed.g;
    colors[i * 3 + 2] = mixed.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
  );
  ground.receiveShadow = true;
  root.add(ground);

  // --- calçamento interno do reino
  const courtyardWidth = KINGDOM.maxX - KINGDOM.minX - 4;
  const courtyardDepth = KINGDOM.maxZ - KINGDOM.minZ - 4;
  const courtyard = groundPlane(
    Math.max(courtyardWidth, courtyardDepth),
    1,
    0.05,
    new THREE.MeshStandardMaterial({ map: cobbleTexture(), roughness: 1, metalness: 0 }),
  );
  courtyard.scale.set(courtyardWidth / Math.max(courtyardWidth, courtyardDepth), 1, courtyardDepth / Math.max(courtyardWidth, courtyardDepth));
  courtyard.position.set(0, 0.05, (KINGDOM.minZ + KINGDOM.maxZ) / 2);
  root.add(courtyard);

  // --- estrada principal saindo do portão
  const road = groundStrip(GATE.x, GATE.z - 2, GATE.x, 200, 15, M.dirt);
  root.add(road);

  // --- trilhas das criaturas: das brechas até o portão
  for (const rift of RIFTS) {
    root.add(groundStrip(rift.x, rift.z, GATE.x, GATE.z - 1, 5, M.dirtDark));
  }

  return root;
}
