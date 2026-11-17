import * as THREE from 'three';
import { M, box, cylinder, cone, plane, signTexture, stripeTexture } from './materials.js';
import { addCollider, addBlocker } from './colliders.js';
import { createSmoke } from './fx.js';

const stripe = stripeTexture();
const awningMaterial = new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.95, side: THREE.DoubleSide });

const produceMaterials = [
  new THREE.MeshStandardMaterial({ color: 0xa8362c, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0xc9a13a, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0x4f7a34, roughness: 0.85 }),
];

function hangingSign(parent, text, { x = 0, y = 4.7, z = 0 }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);

  box(0.16, 0.16, 2.2, M.woodDark, 0, 0, 1.05, { parent: group });
  box(0.1, 0.55, 0.1, M.ironDark, -0.95, -0.3, 1.85, { parent: group });
  box(0.1, 0.55, 0.1, M.ironDark, 0.95, -0.3, 1.85, { parent: group });

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 1.25),
    new THREE.MeshStandardMaterial({ map: signTexture(text), roughness: 0.9 }),
  );
  board.position.set(0, -1.2, 1.87);
  board.castShadow = true;
  group.add(board);
  box(2.6, 1.35, 0.1, M.woodDark, 0, -1.2, 1.81, { parent: group });

  return group;
}

/** Casa/casarão medieval: alicerce de pedra, paredes, telhado piramidal e detalhes. */
function building({
  x,
  z,
  rotY = 0,
  w = 14,
  d = 10,
  h = 7,
  roofH = 4.8,
  wall = M.plaster,
  roof = M.roofRed,
  sign = null,
  windows = 2,
  chimney = false,
  doorAccent = null,
}) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;

  box(w + 0.7, 1.1, d + 0.7, M.stoneDark, 0, 0.55, 0, { parent: group });
  const body = box(w, h, d, wall, 0, h / 2 + 0.5, 0, { parent: group });

  // madeiramento aparente
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(0.36, h, 0.36, M.woodDark, sx * (w / 2 - 0.15), h / 2 + 0.5, sz * (d / 2 - 0.15), { parent: group });
    }
  }
  box(w, 0.3, 0.3, M.woodDark, 0, h + 0.35, d / 2 + 0.03, { parent: group });
  box(w, 0.26, 0.26, M.woodDark, 0, h * 0.62, d / 2 + 0.03, { parent: group });

  // telhado
  const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(1, roofH, 4), roof);
  roofMesh.rotation.y = Math.PI / 4;
  roofMesh.scale.set(w * 0.79, 1, d * 0.79);
  roofMesh.position.y = h + 0.5 + roofH / 2;
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  group.add(roofMesh);

  // porta
  box(2.7, 3.7, 0.24, M.woodDark, 0, 2.35, d / 2 + 0.09, { parent: group });
  box(3.3, 0.3, 0.5, M.woodDark, 0, 4.3, d / 2 + 0.07, { parent: group });
  box(0.12, 3.7, 0.3, M.wood, 0, 2.35, d / 2 + 0.1, { parent: group });

  // janelas iluminadas
  const spread = windows === 1 ? [0] : windows === 2 ? [-w * 0.29, w * 0.29] : [-w * 0.33, 0, w * 0.33];
  for (const wx of spread) {
    if (windows === 3 && Math.abs(wx) < 0.2) continue;
    box(1.25, 1.5, 0.22, M.window, wx, 4.6, d / 2 + 0.07, { parent: group });
    box(0.14, 1.7, 0.26, M.woodDark, wx, 4.6, d / 2 + 0.09, { parent: group });
    box(1.5, 0.16, 0.26, M.woodDark, wx, 4.6, d / 2 + 0.09, { parent: group });
  }

  let chimneyMesh = null;
  if (chimney) {
    chimneyMesh = box(1.7, roofH + 3.6, 1.7, M.stoneDark, -w * 0.3, h + 0.5 + roofH * 0.62, -d * 0.2, {
      parent: group,
    });
  }

  if (sign) hangingSign(group, sign, { x: w * 0.34, z: d / 2 });

  if (doorAccent === 'cross') {
    box(0.5, 1.5, 0.12, M.plaster, 0, 5.6, d / 2 + 0.1, { parent: group });
    box(1.5, 0.5, 0.12, M.plaster, 0, 5.6, d / 2 + 0.1, { parent: group });
  }

  addBlocker(body);
  const swapped = Math.abs(Math.sin(rotY)) > 0.5;
  addCollider(x, z, (swapped ? d : w) / 2 + 0.45, (swapped ? w : d) / 2 + 0.45);

  return { group, chimneyMesh };
}

function barrel(parent, x, z, scale = 1) {
  cylinder(0.5 * scale, 0.52 * scale, 1.05 * scale, 10, M.woodLight, x, 0.52 * scale, z, { parent });
  cylinder(0.54 * scale, 0.54 * scale, 0.1 * scale, 10, M.ironDark, x, 0.3 * scale, z, { parent });
  cylinder(0.54 * scale, 0.54 * scale, 0.1 * scale, 10, M.ironDark, x, 0.78 * scale, z, { parent });
}

function crate(parent, x, z, scale = 1, rotY = 0) {
  const mesh = box(1.15 * scale, 1.15 * scale, 1.15 * scale, M.woodLight, x, 0.58 * scale, z, { parent, rotY });
  box(1.2 * scale, 0.14 * scale, 0.14 * scale, M.woodDark, x, 0.58 * scale, z + 0.6 * scale, { parent, rotY });
  return mesh;
}

function haybale(parent, x, z, rotY = 0) {
  box(2.2, 1.1, 1.3, M.hay, x, 0.55, z, { parent, rotY });
}

function lamp(parent, x, z, withLight = false) {
  box(0.28, 4.2, 0.28, M.woodDark, x, 2.1, z, { parent });
  box(0.9, 0.18, 0.9, M.woodDark, x, 4.2, z, { parent });
  box(0.62, 0.8, 0.62, M.window, x, 4.65, z, { parent });
  if (withLight) {
    const light = new THREE.PointLight(0xffb96a, 45, 26, 1.9);
    light.position.set(x, 4.7, z);
    parent.add(light);
  }
}

function well(parent, x, z) {
  cylinder(2.2, 2.4, 1.4, 12, M.stone, x, 0.7, z, { parent });
  cylinder(1.85, 1.85, 0.12, 12, M.water, x, 1.36, z, { parent });
  for (const sx of [-1, 1]) box(0.26, 3.6, 0.26, M.woodDark, x + sx * 1.7, 3.1, z, { parent });
  box(4, 0.22, 0.22, M.woodDark, x, 4.8, z, { parent });

  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.5, 4), M.roofBrown);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(x, 5.7, z);
  roof.castShadow = true;
  parent.add(roof);

  box(0.7, 0.55, 0.7, M.woodDark, x, 3.4, z + 1.3, { parent });
  addCollider(x, z, 2.35, 2.35);
}

function stall(parent, x, z, rotY = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  parent.add(group);

  for (const sx of [-1.9, 1.9]) {
    for (const sz of [-1.3, 1.3]) {
      box(0.16, 2.9, 0.16, M.wood, sx, 1.45, sz, { parent: group });
    }
  }
  box(4.3, 0.16, 2.9, awningMaterial, 0, 2.95, 0, { parent: group });
  box(4.2, 0.85, 1, M.woodLight, 0, 0.72, 1.05, { parent: group });

  for (let i = 0; i < 6; i++) {
    const mat = produceMaterials[i % produceMaterials.length];
    box(0.36, 0.32, 0.36, mat, -1.6 + i * 0.62, 1.32, 1.05, { parent: group });
  }
  for (let i = 0; i < 3; i++) {
    box(0.5, 0.9, 0.5, M.woodDark, -1.4 + i * 1.3, 0.45, -0.9, { parent: group });
  }
}

function trainingDummy(parent, x, z) {
  cylinder(0.16, 0.22, 2.3, 8, M.wood, x, 1.15, z, { parent });
  box(1.9, 0.18, 0.18, M.wood, x, 1.75, z, { parent });
  box(0.55, 0.7, 0.5, M.hay, x, 2.35, z, { parent });
  cylinder(0.9, 0.9, 0.14, 10, M.woodLight, x, 0.07, z, { parent });
}

function fence(parent, x, z, length, rotY = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  parent.add(group);
  const posts = Math.max(2, Math.round(length / 2.4));
  for (let i = 0; i <= posts; i++) {
    box(0.22, 1.3, 0.22, M.wood, -length / 2 + (i * length) / posts, 0.65, 0, { parent: group });
  }
  box(length, 0.16, 0.12, M.woodLight, 0, 0.95, 0, { parent: group });
  box(length, 0.16, 0.12, M.woodLight, 0, 0.5, 0, { parent: group });
}

function cart(parent, x, z, rotY = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  parent.add(group);

  box(3.2, 0.6, 1.8, M.woodLight, 0, 0.95, 0, { parent: group });
  box(3.4, 0.3, 0.2, M.woodDark, 0, 1.4, 0.9, { parent: group });
  box(3.4, 0.3, 0.2, M.woodDark, 0, 1.4, -0.9, { parent: group });

  const wheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.16, 12);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, M.woodDark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * 1.1, 0.7, sz * 0.85);
      wheel.castShadow = true;
      group.add(wheel);
    }
  }
  haybale(group, 0, 0);
}

function forge(parent, x, z) {
  box(4.4, 1.2, 3, M.stoneDark, x, 0.6, z, { parent });
  box(3.6, 0.5, 2.2, M.ember, x, 1.35, z, { parent, cast: false });
  box(1.2, 0.9, 1.2, M.stone, x - 2.4, 0.45, z + 1.6, { parent });
  box(1.6, 0.55, 0.9, M.ironDark, x + 2.6, 0.6, z + 0.6, { parent });
  box(0.5, 0.45, 0.5, M.ironDark, x + 2.6, 0.28, z + 0.6, { parent });
  box(0.14, 0.9, 1.6, M.ironDark, x + 3.9, 1.4, z - 1.2, { parent });
  box(0.14, 0.9, 1.6, M.ironDark, x + 3.9, 2.1, z - 1.2, { parent });

  const light = new THREE.PointLight(0xff6a1e, 90, 24, 1.7);
  light.position.set(x, 2, z);
  parent.add(light);
}

function herbGarden(parent, x, z) {
  const soil = new THREE.MeshStandardMaterial({ color: 0x3d2f22, roughness: 1 });
  const herbs = new THREE.MeshStandardMaterial({ color: 0x557a3a, roughness: 1 });
  for (let row = 0; row < 3; row++) {
    box(5.4, 0.24, 1.1, soil, x, 0.12, z + (row - 1) * 1.5, { parent });
    for (let i = 0; i < 5; i++) {
      box(0.55, 0.5, 0.55, herbs, x - 2.1 + i * 1.05, 0.45, z + (row - 1) * 1.5, { parent });
    }
  }
}

export function createTown(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const guild = building({
    x: -38,
    z: 2,
    rotY: Math.PI / 2,
    w: 17,
    d: 11,
    h: 8,
    roofH: 5.6,
    roof: M.roofRed,
    sign: 'GUILDA',
    windows: 2,
    chimney: true,
  });
  root.add(guild.group);
  for (const z of [-1, 5]) trainingDummy(root, -28.5, z);
  fence(root, -30, 8.4, 7, 0);

  const smith = building({
    x: 38,
    z: 2,
    rotY: -Math.PI / 2,
    w: 15,
    d: 11,
    h: 7,
    roofH: 5,
    roof: M.roofBrown,
    sign: 'FERREIRO',
    windows: 2,
    chimney: true,
  });
  root.add(smith.group);

  forge(root, 29, 5);
  barrel(root, 31.5, -3.2, 1.1);
  barrel(root, 30.5, -1.8, 0.9);
  crate(root, 26.5, -2.5, 0.9, 0.3);

  const healer = building({
    x: 36,
    z: -20,
    rotY: -Math.PI / 2,
    w: 13,
    d: 10,
    h: 6.4,
    roofH: 4.6,
    roof: M.roofSlate,
    sign: 'CURANDEIRO',
    windows: 2,
    doorAccent: 'cross',
  });
  root.add(healer.group);
  herbGarden(root, 27, -20);
  barrel(root, 28, -14.5, 0.8);

  const tavern = building({
    x: -38,
    z: -24,
    rotY: Math.PI / 2,
    w: 18,
    d: 12,
    h: 9,
    roofH: 6,
    roof: M.roofBrown,
    sign: 'TAVERNA',
    windows: 3,
    chimney: true,
  });
  root.add(tavern.group);

  barrel(root, -30.5, -18, 1);
  barrel(root, -30.5, -20, 1);
  crate(root, -30, -28, 1, 0.5);
  for (const z of [-22, -26]) {
    box(1.6, 0.12, 0.9, M.woodLight, -28.2, 0.95, z, { parent: root });
    box(0.12, 0.95, 0.12, M.woodDark, -27.6, 0.47, z, { parent: root });
    box(0.12, 0.95, 0.12, M.woodDark, -28.8, 0.47, z, { parent: root });
    box(1.9, 0.14, 0.35, M.woodDark, -28.2, 0.5, z, { parent: root });
  }

  // casas do povo
  const houses = [
    { x: -46, z: 34, rotY: Math.PI / 2, w: 12, d: 9, h: 6.2, roof: M.roofRed },
    { x: -22, z: 46, rotY: 0, w: 13, d: 9, h: 6.6, roof: M.roofBrown },
    { x: 22, z: 46, rotY: 0, w: 13, d: 9, h: 6.6, roof: M.roofRed },
    { x: 46, z: 32, rotY: -Math.PI / 2, w: 12, d: 9, h: 6.2, roof: M.roofBrown },
    { x: -48, z: -6, rotY: Math.PI / 2, w: 11, d: 8, h: 6, roof: M.roofSlate },
    { x: 48, z: -8, rotY: -Math.PI / 2, w: 11, d: 8, h: 6, roof: M.roofSlate },
  ];
  for (const house of houses) {
    const built = building({ ...house, windows: 2, chimney: true });
    root.add(built.group);
  }

  // estábulo
  fence(root, 35, 38, 8, 0);
  fence(root, 35, 46, 8, 0);
  fence(root, 31, 42, 8, Math.PI / 2);
  fence(root, 39, 42, 8, Math.PI / 2);
  haybale(root, 33.5, 40.5, 0.2);
  haybale(root, 36.5, 44.5, -0.4);
  cart(root, 35, 43, 1.2);

  // praça: poço, barracas, lampiões
  well(root, 0, 16);
  stall(root, -13, 8, 0.18);
  stall(root, 13, 8, -0.18);
  stall(root, -14, 24, 0.1);
  barrel(root, 16, 13, 0.9);
  crate(root, 16.5, 15.2, 0.8, 0.4);
  crate(root, 15, 16.4, 0.7, 0.9);
  haybale(root, -17.5, 17, 0.25);

  for (const z of [44, 30, 2, -12]) {
    lamp(root, -9.5, z, z === 30 || z === 2);
    lamp(root, 9.5, z, false);
  }

  // estandarte no centro da praça
  box(0.3, 9, 0.3, M.woodDark, 6, 4.5, 26, { parent: root });
  plane(3.2, 2, M.clothRed, 7.7, 7.6, 26, { parent: root, receive: true });

  // smoke das chaminés
  const smokeSources = [guild, smith, tavern];
  for (const source of smokeSources) {
    if (!source.chimneyMesh) continue;
    source.group.updateMatrixWorld(true);
    const worldPosition = source.chimneyMesh.localToWorld(new THREE.Vector3(0, 2.6, 0));
    root.add(createSmoke(worldPosition));
  }

  return root;
}
