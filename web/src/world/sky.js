import * as THREE from 'three';

// Céu de crepúsculo com halo de sol + mapa de ambiente gerado a partir dele,
// para que metal, pedra e tecido recebam reflexos coerentes com a luz.

const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 groundColor;
  uniform vec3 sunColor;
  uniform vec3 sunDirection;
  varying vec3 vWorldPosition;

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float h = clamp(dir.y, 0.0, 1.0);

    vec3 col = mix(horizonColor, topColor, pow(h, 0.62));
    col = mix(col, horizonColor, smoothstep(0.16, 0.0, h) * 0.55);

    vec3 sunDir = normalize(sunDirection);
    float s = max(dot(dir, sunDir), 0.0);
    col += sunColor * (pow(s, 420.0) * 2.6 + pow(s, 24.0) * 0.32 + pow(s, 5.0) * 0.09);

    col = mix(groundColor, col, smoothstep(-0.15, 0.03, dir.y));

    float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 220.0;
    gl_FragColor = vec4(col + dither, 1.0);
  }
`;

export function createSky(
  scene,
  renderer,
  {
    sunDirection = new THREE.Vector3(-0.5, 0.7, 0.55),
    topColor = 0x16213c,
    horizonColor = 0xd89a66,
    groundColor = 0x1b211d,
    sunColor = 0xffd7a8,
    environmentIntensity = 0.55,
  } = {},
) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      topColor: { value: new THREE.Color(topColor) },
      horizonColor: { value: new THREE.Color(horizonColor) },
      groundColor: { value: new THREE.Color(groundColor) },
      sunColor: { value: new THREE.Color(sunColor) },
      sunDirection: { value: sunDirection.clone().normalize() },
    },
    vertexShader,
    fragmentShader,
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(620, 32, 16), material);
  dome.frustumCulled = false;
  scene.add(dome);

  // ambiente pré-filtrado a partir do próprio céu
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envMesh = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), material);
  envScene.add(envMesh);
  const environment = pmrem.fromScene(envScene, 0.02, 1, 1200);
  scene.environment = environment.texture;
  scene.environmentIntensity = environmentIntensity;

  pmrem.dispose();
  envMesh.geometry.dispose();

  return dome;
}
