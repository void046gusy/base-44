import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, box, cylinder, cone, plane, sigilTexture } from './materials.js';
import { addCollider, addBlocker } from './colliders.js';
import { KINGDOM, GATE } from './layout.js';

const WALL_HEIGHT = 12;
const WALL_THICKNESS = 3;

function crenellationRow(length, thickness, topY, { step = 4.2, size = 1.9, height = 1.7 } = {}) {
  const geometries = [];
  const count = Math.max(1, Math.floor(length / step));
  for (let i = 0; i <= count; i++) {
    const geo = new THREE.BoxGeometry(size, height, thickness);
    geo.translate(-length / 2 + (i * length) / count, topY + height / 2, 0);
    geometries.push(geo);
  }
  return mergeGeometries(geometries);
}

function crenellationLine(length, x, z, rotY, topY) {
  const geo = crenellationRow(length, 1.5, 0, { step: 3.6, size: 1.6, height: 1.6 });
  geo.applyMatrix4(new THREE.Matrix4().makeRotationY(rotY));
  geo.translate(x, topY, z);
  return geo;
}

function wallSegment(parent, { x, z, length, axis = 'x' }) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  if (axis === 'z') group.rotation.y = Math.PI / 2;
  parent.add(group);

  const body = box(length, WALL_HEIGHT, WALL_THICKNESS, M.stone, 0, WALL_HEIGHT / 2, 0, { parent: group });
  box(length, 0.5, WALL_THICKNESS + 1.1, M.stoneLight, 0, WALL_HEIGHT + 0.2, 0, { parent: group });

  const crenellations = new THREE.Mesh(
    crenellationRow(length, WALL_THICKNESS * 0.9, WALL_HEIGHT + 0.45),
    M.stoneDark,
  );
  crenellations.castShadow = true;
  crenellations.receiveShadow = true;
  group.add(crenellations);

  addBlocker(body);
  if (axis === 'x') {
    addCollider(x, z, length / 2, WALL_THICKNESS / 2 + 0.4);
  } else {
    addCollider(x, z, WALL_THICKNESS / 2 + 0.4, length / 2);
  }
  return group;
}

function tower(parent, { x, z, radius = 6, height = 18, roofMaterial = M.roofSlate, roofHeight = 7 }) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  parent.add(group);

  const body = cylinder(radius, radius * 1.07, height, 12, M.stone, 0, height / 2, 0, { parent: group });
  cylinder(radius * 1.14, radius * 1.14, 0.7, 12, M.stoneLight, 0, height + 0.35, 0, { parent: group });

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    box(1.7, 1.5, 1.1, M.stoneDark, Math.cos(angle) * radius * 1.02, height + 1.4, Math.sin(angle) * radius * 1.02, {
      parent: group,
      rotY: -angle,
    });
  }

  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + 0.4;
    box(0.5, 1.7, 0.35, M.window, Math.cos(angle) * radius * 0.99, height * 0.62, Math.sin(angle) * radius * 0.99, {
      parent: group,
      rotY: -angle,
    });
  }

  if (roofHeight > 0) {
    cone(radius * 1.28, roofHeight, 12, roofMaterial, 0, height + 0.7 + roofHeight / 2, 0, { parent: group });
  }

  addBlocker(body);
  addCollider(x, z, radius * 0.86, radius * 0.86);
  return group;
}

function banner(parent, bannerMaterial, { x, y, z, width = 3, height = 6.4, rotY = 0 }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;
  parent.add(group);

  plane(width, height, bannerMaterial, 0, 0, 0, { parent: group });
  box(width + 0.7, 0.14, 0.14, M.woodDark, 0, height / 2 + 0.1, 0.02, { parent: group });
  return group;
}

function buildGatehouse(parent, bannerMaterial) {
  const group = new THREE.Group();
  parent.add(group);

  const towerX = GATE.width / 2 + 6;
  tower(group, { x: -towerX, z: GATE.z, radius: 5.4, height: 17, roofMaterial: M.roofBrown, roofHeight: 8 });
  tower(group, { x: towerX, z: GATE.z, radius: 5.4, height: 17, roofMaterial: M.roofBrown, roofHeight: 8 });

  // passagem coberta sobre o portão
  const bridge = box(towerX * 2 + 3, 3.4, 7, M.stone, 0, 15.6, GATE.z, { parent: group });
  box(towerX * 2 + 4, 0.5, 7.6, M.stoneLight, 0, 17.5, GATE.z, { parent: group });
  addBlocker(bridge);

  for (let x = -towerX; x <= towerX; x += 3.6) {
    box(1.7, 1.5, 1.1, M.stoneDark, x, 18.4, GATE.z + 3, { parent: group });
    box(1.7, 1.5, 1.1, M.stoneDark, x, 18.4, GATE.z - 3, { parent: group });
  }

  // grade levadiça erguida
  const bars = [];
  for (let i = -3; i <= 3; i++) {
    const geo = new THREE.BoxGeometry(0.3, 7.5, 0.3);
    geo.translate(i * 1.9, 9.2, 0);
    bars.push(geo);
  }
  for (let j = 0; j < 4; j++) {
    const geo = new THREE.BoxGeometry(13.5, 0.26, 0.26);
    geo.translate(0, 6 + j * 2.1, 0);
    bars.push(geo);
  }
  const portcullis = new THREE.Mesh(mergeGeometries(bars), M.ironDark);
  portcullis.position.set(0, 0, GATE.z - 0.5);
  portcullis.castShadow = true;
  group.add(portcullis);

  // portões abertos para dentro
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * (GATE.width / 2), 0, GATE.z + 0.6);
    hinge.rotation.y = side * 1.15;
    group.add(hinge);
    box(GATE.width / 2, 8.6, 0.45, M.woodDark, (-side * GATE.width) / 4, 4.5, 0, { parent: hinge });
    for (let i = 0; i < 3; i++) {
      box(GATE.width / 2, 0.22, 0.55, M.ironDark, (-side * GATE.width) / 4, 2 + i * 2.4, 0, { parent: hinge });
    }
  }

  // tochas do portão
  for (const side of [-1, 1]) {
    box(0.6, 0.9, 0.6, M.ember, side * (GATE.width / 2 + 1.6), 5.4, GATE.z + 3.4, { parent: group });
    const light = new THREE.PointLight(0xff9c4a, 70, 30, 1.9);
    light.position.set(side * (GATE.width / 2 + 1.6), 6.1, GATE.z + 3.4);
    group.add(light);
  }

  banner(group, bannerMaterial, { x: -towerX, y: 11.5, z: GATE.z + 5.6, width: 3.2, height: 7 });
  banner(group, bannerMaterial, { x: towerX, y: 11.5, z: GATE.z + 5.6, width: 3.2, height: 7 });

  return group;
}

function buildCastle(parent, bannerMaterial) {
  const group = new THREE.Group();
  group.position.set(0, 0, -32);
  parent.add(group);

  const plinth = box(42, 2.6, 27, M.stoneDark, 0, 1.3, 0, { parent: group });
  addBlocker(plinth);
  addCollider(0, -32, 21, 13.5);

  // escadaria de acesso
  box(12, 0.4, 2.6, M.stoneLight, 0, 2.9, 14.4, { parent: group });
  box(12.8, 0.4, 2.4, M.stoneLight, 0, 2.4, 16.2, { parent: group });
  box(13.6, 0.4, 2.2, M.stoneLight, 0, 1.9, 18, { parent: group });

  // torreão principal
  const keep = box(28, 20, 17, M.stone, 0, 12.6, 0, { parent: group });
  addBlocker(keep);
  addCollider(0, -32, 14, 8.5);

  const ringGeometries = [
    crenellationLine(29.2, 0, -8.5, 0, 22.6),
    crenellationLine(29.2, 0, 8.5, 0, 22.6),
    crenellationLine(18.2, -14, 0, Math.PI / 2, 22.6),
    crenellationLine(18.2, 14, 0, Math.PI / 2, 22.6),
  ];
  const ring = new THREE.Mesh(mergeGeometries(ringGeometries), M.stoneDark);
  ring.castShadow = true;
  ring.receiveShadow = true;
  group.add(ring);

  // torres de canto
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const turret = cylinder(4, 4.2, 27, 12, M.stone, sx * 14, 13.5, sz * 8.5, { parent: group });
      cylinder(4.5, 4.5, 0.6, 12, M.stoneLight, sx * 14, 27.3, sz * 8.5, { parent: group });
      cone(4.7, 8.5, 12, M.roofSlate, sx * 14, 31.8, sz * 8.5, { parent: group });
      addBlocker(turret);
      addCollider(sx * 14, -32 + sz * 8.5, 3.6, 3.6);
    }
  }

  // grande torre ao fundo
  const greatTower = cylinder(5.6, 6, 36, 14, M.stone, 0, 18, -5, { parent: group });
  cylinder(6.2, 6.2, 0.7, 14, M.stoneLight, 0, 36.2, -5, { parent: group });
  cone(6.4, 13, 14, M.roofSlate, 0, 43, -5, { parent: group });
  box(0.18, 5, 0.18, M.ironDark, 0, 52, -5, { parent: group });
  plane(3.4, 2.2, M.clothRed, 1.75, 53.4, -5, { parent: group, receive: true });
  addBlocker(greatTower);

  // portal
  box(5.4, 7.2, 0.7, M.dark, 0, 6.2, 8.6, { parent: group });
  box(2.4, 6.8, 0.4, M.woodDark, -1.3, 6, 8.75, { parent: group });
  box(2.4, 6.8, 0.4, M.woodDark, 1.3, 6, 8.75, { parent: group });
  box(7.6, 1.1, 1.1, M.stoneLight, 0, 10.6, 8.7, { parent: group });

  for (const sx of [-1, 1]) {
    box(1.2, 2, 0.3, M.window, sx * 7.5, 17, 8.62, { parent: group });
    banner(group, bannerMaterial, { x: sx * 7.6, y: 13.4, z: 8.95, width: 3.2, height: 6.4 });
  }

  return group;
}

export function createKingdom(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const bannerMaterial = new THREE.MeshStandardMaterial({
    map: sigilTexture(),
    side: THREE.DoubleSide,
    roughness: 0.95,
  });

  const halfW = KINGDOM.maxX;
  const northZ = KINGDOM.minZ;
  const southZ = KINGDOM.maxZ;
  const sideLength = southZ - northZ;
  const gateHalf = GATE.width / 2;
  const southSide = halfW - gateHalf;

  wallSegment(root, { x: 0, z: northZ, length: halfW * 2, axis: 'x' });
  wallSegment(root, { x: -halfW, z: (northZ + southZ) / 2, length: sideLength, axis: 'z' });
  wallSegment(root, { x: halfW, z: (northZ + southZ) / 2, length: sideLength, axis: 'z' });
  wallSegment(root, { x: -(gateHalf + southSide / 2), z: southZ, length: southSide, axis: 'x' });
  wallSegment(root, { x: gateHalf + southSide / 2, z: southZ, length: southSide, axis: 'x' });

  for (const sx of [-1, 1]) {
    tower(root, { x: sx * halfW, z: northZ, radius: 5.6, height: 16, roofHeight: 7 });
    tower(root, { x: sx * halfW, z: southZ, radius: 5.6, height: 16, roofHeight: 7 });
  }
  tower(root, { x: -halfW, z: 6, radius: 4.4, height: 14, roofHeight: 6 });
  tower(root, { x: halfW, z: 6, radius: 4.4, height: 14, roofHeight: 6 });

  // estandartes na muralha norte, virados para o pátio
  for (const x of [-40, -20, 20, 40]) {
    banner(root, bannerMaterial, { x, y: 7.4, z: northZ + 2.4, width: 2.8, height: 6 });
  }
  // tochas rasas ao longo da muralha
  for (const x of [-46, -26, 26, 46]) {
    box(0.5, 0.8, 0.5, M.ember, x, 4.4, northZ + 2.2, { parent: root });
  }

  buildGatehouse(root, bannerMaterial);
  buildCastle(root, bannerMaterial);

  return root;
}
