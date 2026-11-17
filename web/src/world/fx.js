import * as THREE from 'three';
import { softDotTexture } from './materials.js';

const updaters = [];

export function updateEffects(dt, time) {
  for (const update of updaters) update(dt, time);
}

const vertexShader = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uRise;
  uniform float uSize;
  uniform float uSpread;
  varying float vAlpha;

  void main() {
    float life = fract(uTime * 0.22 + aSeed);
    vec3 p = position;
    p.y += life * uRise;
    p.x += sin((life + aSeed) * 6.2831) * uSpread * life;
    p.z += cos((life * 1.3 + aSeed * 2.0) * 6.2831) * uSpread * life;

    vAlpha = smoothstep(0.0, 0.12, life) * (1.0 - life);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (0.6 + life * 1.8) * (320.0 / max(-mv.z, 0.001));
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform sampler2D uMap;
  varying float vAlpha;

  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    float alpha = tex.a * vAlpha;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function particleCloud(position, { count, color, size, rise, spread, additive = false, opacity = 1 }) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = spread * 0.35 * ((i % 4) / 4 + 0.3);
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = (i % 5) * 0.15;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    seeds[i] = (i * 0.61803398875) % 1;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRise: { value: rise },
      uSize: { value: size },
      uSpread: { value: spread },
      uColor: { value: new THREE.Color(color) },
      uMap: { value: softDotTexture(0xffffff) },
      uOpacity: { value: opacity },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  material.uniforms.uColor.value.multiplyScalar(1);

  const points = new THREE.Points(geo, material);
  points.position.copy(position);
  points.frustumCulled = false;

  updaters.push((dt, time) => {
    material.uniforms.uTime.value = time;
  });

  return points;
}

/** Fumaça subindo da chaminé do ferreiro/taverna. */
export function createSmoke(position, opts = {}) {
  return particleCloud(position, {
    count: opts.count ?? 16,
    color: opts.color ?? 0x9aa0a6,
    size: opts.size ?? 2.6,
    rise: opts.rise ?? 7,
    spread: opts.spread ?? 1.1,
  });
}

/** Aura violeta da brecha por onde os monstros saem. */
export function createRiftAura(position) {
  return particleCloud(position, {
    count: 42,
    color: 0x9d4ce0,
    size: 3.4,
    rise: 9,
    spread: 4.4,
    additive: true,
  });
}
