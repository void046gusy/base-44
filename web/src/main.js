import * as THREE from 'three';
import './style.css';
import { createTerrain } from './world/terrain.js';
import { createSky } from './world/sky.js';
import { createKingdom } from './world/kingdom.js';
import { createTown } from './world/town.js';
import { createForest } from './world/forest.js';
import { resetWorldColliders } from './world/colliders.js';
import { updateEffects } from './world/fx.js';
import { createPlayer } from './player.js';
import { createHud } from './hud.js';

resetWorldColliders();

const container = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x565f63, 0.004);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 900);

const sunPosition = new THREE.Vector3(-86, 116, 96);

// céu de crepúsculo + mapa de ambiente para reflexos
createSky(scene, renderer, {
  sunDirection: sunPosition.clone().normalize(),
  topColor: 0x16213c,
  horizonColor: 0xdb9c68,
  groundColor: 0x1b211d,
  sunColor: 0xffd7a8,
  environmentIntensity: 0.55,
});

const hemi = new THREE.HemisphereLight(0xa4bcdc, 0x3d4730, 0.85);
scene.add(hemi);

const ambient = new THREE.AmbientLight(0x40506a, 0.25);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffd2a1, 3.1);
sun.position.copy(sunPosition);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 420;
sun.shadow.camera.left = -85;
sun.shadow.camera.right = 85;
sun.shadow.camera.top = 85;
sun.shadow.camera.bottom = -85;
sun.shadow.bias = -0.0012;
sun.shadow.normalBias = 0.06;
scene.add(sun);
scene.add(sun.target);

createTerrain(scene);
createKingdom(scene);
createTown(scene);
createForest(scene);

const player = createPlayer({ scene, camera, canvas: renderer.domElement });
const hud = createHud();

const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  player.update(dt, elapsed);
  updateEffects(dt, elapsed);
  hud.update(player.getState());

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
