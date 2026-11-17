import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt } from './terrain.js';
import { RIFTS } from './layout.js';
import { M } from './materials.js';
import { createRiftAura } from './fx.js';

const UP = new THREE.Vector3(0, 1, 0);

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pineGeometries() {
  const trunk = new THREE.CylinderGeometry(0.34, 0.62, 5.2, 5);
  trunk.translate(0, 2.6, 0);

  const layers = [
    [3.5, 4.6, 4.6],
    [2.7, 4.0, 7.2],
    [1.8, 3.4, 9.6],
  ].map(([radius, height, y]) => {
    const geo = new THREE.ConeGeometry(radius, height, 7);
    geo.translate(0, y, 0);
    return geo;
  });

  return { trunk, foliage: mergeGeometries(layers) };
}

function instance(geometry, material, items, { castShadow = true, colorize = null } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const color = new THREE.Color();

  items.forEach((item, index) => {
    quaternion.setFromAxisAngle(UP, item.rotation);
    scale.set(item.scale, item.scale * item.stretch, item.scale);
    position.set(item.x, item.y, item.z);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);

    if (colorize) {
      colorize(color, item, index);
      mesh.setColorAt(index, color);
    }
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

function createRift(parent, rift, index) {
  const y = heightAt(rift.x, rift.z);
  const group = new THREE.Group();
  group.position.set(rift.x, y, rift.z);
  parent.add(group);

  const scorched = new THREE.Mesh(
    new THREE.CircleGeometry(8, 28),
    new THREE.MeshStandardMaterial({ color: 0x191020, roughness: 1 }),
  );
  scorched.rotation.x = -Math.PI / 2;
  scorched.position.y = 0.1;
  scorched.receiveShadow = true;
  group.add(scorched);

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a1038,
    emissive: 0x9d4ce0,
    emissiveIntensity: 3,
    roughness: 0.45,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.35, 10, 32), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.45;
  group.add(ring);

  // fissuras no chão
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + index;
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.08, 3.4 + (i % 3)),
      new THREE.MeshStandardMaterial({ color: 0x3a1650, emissive: 0x6d1fa8, emissiveIntensity: 1.2 }),
    );
    crack.position.set(Math.cos(angle) * 2.6, 0.14, Math.sin(angle) * 2.6);
    crack.rotation.y = angle;
    group.add(crack);
  }

  // pilares de pedra quebrados
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + index * 0.7;
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.1, 5 + (i % 2) * 2.2, 6),
      M.rock,
    );
    pillar.position.set(Math.cos(angle) * 6.4, 2.6, Math.sin(angle) * 6.4);
    pillar.rotation.z = 0.12 * (i - 1);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);
  }

  const light = new THREE.PointLight(0xa855f7, 70, 30, 1.9);
  light.position.set(0, 3.2, 0);
  group.add(light);

  parent.add(createRiftAura(new THREE.Vector3(rift.x, y + 0.6, rift.z)));

  return group;
}

export function createForest(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const random = mulberry32(20261117);
  const { trunk, foliage } = pineGeometries();

  const pines = [];
  const bushes = [];
  const rocks = [];

  let attempts = 0;
  while (attempts < 14000 && pines.length < 1750) {
    attempts++;
    const angle = random() * Math.PI * 2;
    const radius = 76 + Math.pow(random(), 0.72) * 190;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    // manter o reino e a estrada livres
    if (Math.abs(x) < 68 && z > -56 && z < 68) continue;
    if (Math.abs(x) < 27 && z > 56) continue;
    if (RIFTS.some((rift) => Math.hypot(rift.x - x, rift.z - z) < 12)) continue;

    pines.push({
      x,
      z,
      y: heightAt(x, z) - 0.15,
      rotation: random() * Math.PI * 2,
      scale: 0.72 + random() * 0.78,
      stretch: 0.85 + random() * 0.45,
      distance: radius,
    });
  }

  for (let i = 0; i < 620; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 74 + Math.pow(random(), 0.6) * 175;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x) < 66 && z > -54 && z < 66) continue;
    if (Math.abs(x) < 24 && z > 56) continue;
    bushes.push({
      x,
      z,
      y: heightAt(x, z) + 0.2,
      rotation: random() * Math.PI,
      scale: 0.8 + random() * 1.5,
      stretch: 0.55,
      distance: radius,
    });
  }

  for (let i = 0; i < 340; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 70 + Math.pow(random(), 0.7) * 200;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x) < 66 && z > -54 && z < 66) continue;
    rocks.push({
      x,
      z,
      y: heightAt(x, z) - 0.2,
      rotation: random() * Math.PI * 2,
      scale: 0.5 + random() * 1.7,
      stretch: 0.7,
      distance: radius,
    });
  }

  const near = pines.filter((tree) => tree.distance < 155);
  const far = pines.filter((tree) => tree.distance >= 155);

  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x2e2318, roughness: 1 });
  const foliageMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    flatShading: true,
  });
  const bushMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x596160, roughness: 1, flatShading: true });

  const greenShade = (color, item, index) => {
    const hue = 0.33 + ((index % 9) / 9) * 0.035;
    const lightness = 0.13 + ((index % 7) / 7) * 0.07;
    color.setHSL(hue, 0.32 + (item.scale - 0.7) * 0.12, lightness);
  };

  for (const group of [near, far]) {
    const cast = group === near;
    root.add(instance(trunk, trunkMaterial, group, { castShadow: cast }));
    root.add(instance(foliage, foliageMaterial, group, { castShadow: cast, colorize: greenShade }));
  }

  root.add(
    instance(new THREE.IcosahedronGeometry(1, 0), bushMaterial, bushes, {
      castShadow: false,
      colorize: (color, item, index) => {
        color.setHSL(0.34 + ((index % 5) / 5) * 0.03, 0.36, 0.12 + ((index % 4) / 4) * 0.05);
      },
    }),
  );

  root.add(
    instance(new THREE.DodecahedronGeometry(1, 0), rockMaterial, rocks, {
      castShadow: true,
      colorize: (color, item, index) => {
        color.setHSL(0.5, 0.05, 0.28 + ((index % 5) / 5) * 0.1);
      },
    }),
  );

  RIFTS.forEach((rift, index) => createRift(root, rift, index));

  return root;
}
