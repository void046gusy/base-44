import * as THREE from 'three';
import { heightAt } from './world/terrain.js';
import { boxes, blockers } from './world/colliders.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createPlayer({ scene, camera, canvas }) {
  const root = new THREE.Group();
  root.position.set(0, 0, 46);
  scene.add(root);

  const model = new THREE.Group();
  model.rotation.y = Math.PI; // começa olhando para o castelo
  root.add(model);

  const tunic = new THREE.MeshStandardMaterial({ color: 0x2c3f66, roughness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9ba3ad, metalness: 0.8, roughness: 0.35 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.95 });
  const capeMaterial = new THREE.MeshStandardMaterial({ color: 0x7d2320, roughness: 0.95, side: THREE.DoubleSide });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc79a72, roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 1 });

  const part = (w, h, d, material, x, y, z, parent = model) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  part(0.66, 0.8, 0.4, tunic, 0, 1.26, 0);
  part(0.26, 0.46, 0.22, steel, 0, 1.3, 0.25);
  part(0.7, 0.13, 0.44, leather, 0, 0.9, 0);
  part(0.42, 0.44, 0.42, skin, 0, 1.87, 0);
  part(0.46, 0.16, 0.46, hair, 0, 2.09, 0);
  part(0.22, 0.18, 0.34, steel, -0.44, 1.6, 0);
  part(0.22, 0.18, 0.34, steel, 0.44, 1.6, 0);

  const armGeometry = new THREE.BoxGeometry(0.18, 0.64, 0.18);
  const armLeft = new THREE.Group();
  armLeft.position.set(-0.44, 1.58, 0);
  model.add(armLeft);
  const armLeftMesh = new THREE.Mesh(armGeometry, tunic);
  armLeftMesh.position.y = -0.32;
  armLeft.add(armLeftMesh);
  part(0.18, 0.2, 0.18, skin, 0, -0.66, 0, armLeft);

  const armRight = new THREE.Group();
  armRight.position.set(0.44, 1.58, 0);
  model.add(armRight);
  const armRightMesh = new THREE.Mesh(armGeometry, tunic);
  armRightMesh.position.y = -0.32;
  armRight.add(armRightMesh);
  part(0.18, 0.2, 0.18, skin, 0, -0.66, 0, armRight);

  const legGeometry = new THREE.BoxGeometry(0.22, 0.88, 0.26);
  const legLeft = new THREE.Group();
  legLeft.position.set(-0.17, 0.9, 0);
  model.add(legLeft);
  const legLeftMesh = new THREE.Mesh(legGeometry, leather);
  legLeftMesh.position.y = -0.44;
  legLeft.add(legLeftMesh);
  part(0.26, 0.16, 0.36, leather, 0, -0.85, 0.06, legLeft);

  const legRight = new THREE.Group();
  legRight.position.set(0.17, 0.9, 0);
  model.add(legRight);
  const legRightMesh = new THREE.Mesh(legGeometry, leather);
  legRightMesh.position.y = -0.44;
  legRight.add(legRightMesh);
  part(0.26, 0.16, 0.36, leather, 0, -0.85, 0.06, legRight);

  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.2), capeMaterial);
  cape.position.set(0, 1.24, -0.26);
  cape.rotation.x = 0.08;
  model.add(cape);

  const sword = new THREE.Group();
  sword.position.set(-0.04, 1.3, -0.32);
  sword.rotation.z = 0.45;
  model.add(sword);
  part(0.1, 1.1, 0.06, steel, 0, 0, 0, sword);
  part(0.34, 0.08, 0.1, leather, 0, 0.58, 0, sword);

  model.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  // --- controles
  const keys = new Set();
  const moveKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']);

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (moveKeys.has(key)) event.preventDefault();
    keys.add(key);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });

  let yaw = 0;
  let pitch = 0.38;
  let distance = 8.8;
  let dragging = false;

  const prompt = document.getElementById('click-prompt');

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') return;
    dragging = true;
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (prompt) prompt.classList.toggle('hidden', locked);
  });
  canvas.addEventListener('mousemove', (event) => {
    const locked = document.pointerLockElement === canvas;
    if (!locked && !dragging) return;
    yaw -= event.movementX * 0.0022;
    pitch = clamp(pitch + event.movementY * 0.0018, -0.22, 1.0);
  });
  canvas.addEventListener(
    'wheel',
    (event) => {
      distance = clamp(distance + event.deltaY * 0.005, 3.4, 14);
    },
    { passive: true },
  );

  // --- controles de toque
  const stick = document.createElement('div');
  stick.className = 'stick';
  stick.innerHTML = '<div class="knob"></div>';
  document.body.appendChild(stick);
  const knob = stick.querySelector('.knob');
  const touchInput = { x: 0, y: 0 };
  let moveTouch = null;
  let lookTouch = null;

  canvas.addEventListener(
    'touchstart',
    (event) => {
      for (const touch of event.changedTouches) {
        if (touch.clientX < window.innerWidth * 0.45 && !moveTouch) {
          moveTouch = { id: touch.identifier, originX: touch.clientX, originY: touch.clientY };
          stick.style.left = `${touch.clientX}px`;
          stick.style.top = `${touch.clientY}px`;
          stick.classList.add('visible');
        } else if (!lookTouch) {
          lookTouch = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
        }
      }
      if (prompt) prompt.classList.add('hidden');
      event.preventDefault();
    },
    { passive: false },
  );

  canvas.addEventListener(
    'touchmove',
    (event) => {
      for (const touch of event.changedTouches) {
        if (moveTouch && touch.identifier === moveTouch.id) {
          const dx = touch.clientX - moveTouch.originX;
          const dy = touch.clientY - moveTouch.originY;
          const length = Math.hypot(dx, dy) || 1;
          const radius = 52;
          const strength = Math.min(1, length / radius);
          touchInput.x = (dx / length) * strength;
          touchInput.y = -(dy / length) * strength;
          const kx = (dx / length) * Math.min(length, radius);
          const ky = (dy / length) * Math.min(length, radius);
          knob.style.transform = `translate(${kx}px, ${ky}px)`;
        } else if (lookTouch && touch.identifier === lookTouch.id) {
          yaw -= (touch.clientX - lookTouch.x) * 0.006;
          pitch = clamp(pitch + (touch.clientY - lookTouch.y) * 0.005, -0.22, 1.0);
          lookTouch.x = touch.clientX;
          lookTouch.y = touch.clientY;
        }
      }
      event.preventDefault();
    },
    { passive: false },
  );

  const endTouch = (event) => {
    for (const touch of event.changedTouches) {
      if (moveTouch && touch.identifier === moveTouch.id) {
        moveTouch = null;
        touchInput.x = 0;
        touchInput.y = 0;
        stick.classList.remove('visible');
        knob.style.transform = '';
      }
      if (lookTouch && touch.identifier === lookTouch.id) lookTouch = null;
    }
  };
  canvas.addEventListener('touchend', endTouch);
  canvas.addEventListener('touchcancel', endTouch);

  // --- estado e câmera
  const velocity = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const target = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  let phase = 0;
  let facing = Math.PI;

  function collide(position, radius) {
    for (const boxInfo of boxes) {
      const closestX = clamp(position.x, boxInfo.minX, boxInfo.maxX);
      const closestZ = clamp(position.z, boxInfo.minZ, boxInfo.maxZ);
      const dx = position.x - closestX;
      const dz = position.z - closestZ;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= radius * radius) continue;

      if (distanceSq > 0.0001) {
        const length = Math.sqrt(distanceSq);
        position.x = closestX + (dx / length) * radius;
        position.z = closestZ + (dz / length) * radius;
      } else {
        // dentro da caixa: empurra para o lado mais próximo
        const left = position.x - boxInfo.minX;
        const rightGap = boxInfo.maxX - position.x;
        const back = position.z - boxInfo.minZ;
        const front = boxInfo.maxZ - position.z;
        const min = Math.min(left, rightGap, back, front);
        if (min === left) position.x = boxInfo.minX - radius;
        else if (min === rightGap) position.x = boxInfo.maxX + radius;
        else if (min === back) position.z = boxInfo.minZ - radius;
        else position.z = boxInfo.maxZ + radius;
      }
    }
  }

  function updateCamera() {
    target.set(root.position.x, root.position.y + 1.55, root.position.z);
    direction
      .set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
      .normalize();

    raycaster.set(target, direction);
    raycaster.far = distance + 0.6;
    const hits = raycaster.intersectObjects(blockers, false);
    let cameraDistance = distance;
    if (hits.length > 0) cameraDistance = Math.max(1.7, hits[0].distance - 0.4);

    cameraPosition.copy(target).addScaledVector(direction, cameraDistance);
    const ground = heightAt(cameraPosition.x, cameraPosition.z) + 0.9;
    if (cameraPosition.y < ground) cameraPosition.y = ground;

    camera.position.copy(cameraPosition);
    camera.lookAt(target);
  }

  function update(dt, elapsed) {
    const keyX =
      (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const keyZ = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);

    const inputX = clamp(keyX + touchInput.x, -1, 1);
    const inputZ = clamp(keyZ + touchInput.y, -1, 1);
    const sprinting = keys.has('shift') || Math.hypot(touchInput.x, touchInput.y) > 0.85;

    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    wish.set(0, 0, 0).addScaledVector(forward, inputZ).addScaledVector(right, inputX);
    if (wish.lengthSq() > 1) wish.normalize();

    const moving = wish.lengthSq() > 0.002;
    const speed = moving ? (sprinting ? 8.6 : 4.8) : 0;
    const smoothing = 1 - Math.exp(-10 * dt);
    velocity.x += (wish.x * speed - velocity.x) * smoothing;
    velocity.z += (wish.z * speed - velocity.z) * smoothing;

    root.position.x += velocity.x * dt;
    root.position.z += velocity.z * dt;
    collide(root.position, 0.78);
    root.position.y = heightAt(root.position.x, root.position.z);

    const planarSpeed = Math.hypot(velocity.x, velocity.z);
    if (planarSpeed > 0.4) facing = Math.atan2(velocity.x, velocity.z);
    const turn = Math.atan2(Math.sin(facing - model.rotation.y), Math.cos(facing - model.rotation.y));
    model.rotation.y += turn * Math.min(1, dt * 12);

    const normalizedSpeed = clamp(planarSpeed / 8.6, 0, 1);
    phase += dt * (2.4 + planarSpeed * 1.6);
    const swing = Math.sin(phase) * (0.16 + normalizedSpeed * 0.72);
    legLeft.rotation.x = swing;
    legRight.rotation.x = -swing;
    armLeft.rotation.x = -swing * 0.85;
    armRight.rotation.x = swing * 0.85;
    model.position.y = Math.abs(Math.sin(phase)) * 0.045 * (0.35 + normalizedSpeed);
    cape.rotation.x = 0.08 + normalizedSpeed * 0.55 + Math.sin(elapsed * 2.6) * 0.03;

    updateCamera();
  }

  function getState() {
    return { x: root.position.x, z: root.position.z, facing: model.rotation.y };
  }

  updateCamera();

  return { update, getState };
}
