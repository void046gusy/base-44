import * as THREE from 'three';
import './style.css';
import { createTerrain } from './world/terrain.js';
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
renderer.toneMappingExposure = 1.28;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x3c4d60, 0.0038);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 900);

// céu de crepúsculo
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(620, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x17223c) },
      horizonColor: { value: new THREE.Color(0xd89a68) },
      offset: { value: 90 },
      exponent: { value: 0.85 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        gl_FragColor = vec4(mix(horizonColor, topColor, pow(max(h, 0.0), exponent)), 1.0);
      }
    `,
  }),
);
scene.add(sky);

const hemi = new THREE.HemisphereLight(0xa8c0e2, 0x3b4430, 1.45);
scene.add(hemi);

const ambient = new THREE.AmbientLight(0x3a4658, 0.5);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffd2a1, 3.1);
sun.position.set(-86, 116, 96);
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
