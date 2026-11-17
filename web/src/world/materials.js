import * as THREE from 'three';

const std = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...opts });

export const M = {
  stone: std(0x8f8d84, { roughness: 0.96 }),
  stoneLight: std(0xa9a496),
  stoneDark: std(0x68665f, { roughness: 1 }),
  cobble: std(0x7d786e, { roughness: 1 }),
  dirt: std(0x7d6549, { roughness: 1 }),
  dirtDark: std(0x4e4231, { roughness: 1 }),
  wood: std(0x5b3f27),
  woodLight: std(0x8a6438),
  woodDark: std(0x3b2a1b),
  plaster: std(0xd5cab1),
  roofRed: std(0x8a3230, { roughness: 0.95 }),
  roofSlate: std(0x39404c),
  roofBrown: std(0x6c452e),
  metal: std(0x6f747c, { metalness: 0.8, roughness: 0.34 }),
  ironDark: std(0x33363b, { metalness: 0.65, roughness: 0.5 }),
  clothRed: std(0x8e2323, { roughness: 1 }),
  clothBlue: std(0x2b4a7a),
  hay: std(0xb99a55, { roughness: 1 }),
  water: std(0x304c54, { roughness: 0.18, metalness: 0.15 }),
  ember: new THREE.MeshStandardMaterial({
    color: 0xff8a3c,
    emissive: 0xff5a10,
    emissiveIntensity: 2.4,
    roughness: 0.6,
  }),
  window: new THREE.MeshStandardMaterial({
    color: 0xffd79a,
    emissive: 0xffb457,
    emissiveIntensity: 1.7,
    roughness: 0.5,
  }),
  dark: std(0x211b16),
  leaf: std(0x27482f, { roughness: 1 }),
  bark: std(0x2f2419),
  rock: std(0x585d5c, { roughness: 1 }),
};

export function box(w, h, d, material, x = 0, y = 0, z = 0, opts = {}) {
  const { cast = true, receive = true, parent = null, rotY = 0, rotX = 0, rotZ = 0 } = opts;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rotX, rotY, rotZ);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (parent) parent.add(mesh);
  return mesh;
}

export function cylinder(rTop, rBottom, height, segments, material, x = 0, y = 0, z = 0, opts = {}) {
  const { cast = true, receive = true, parent = null, rotY = 0 } = opts;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, height, segments), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (parent) parent.add(mesh);
  return mesh;
}

export function cone(radius, height, segments, material, x = 0, y = 0, z = 0, opts = {}) {
  const { cast = true, receive = true, parent = null } = opts;
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (parent) parent.add(mesh);
  return mesh;
}

export function plane(w, h, material, x = 0, y = 0, z = 0, opts = {}) {
  const { parent = null, rotY = 0, cast = false, receive = false } = opts;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (parent) parent.add(mesh);
  return mesh;
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Estandarte do reino: campo vinho, borda e coroa dourada. */
export function sigilTexture() {
  return canvasTexture(96, 192, (ctx, w, h) => {
    ctx.fillStyle = '#781d1d';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e2bb63';
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#e2bb63';
    ctx.beginPath();
    ctx.moveTo(22, 104);
    ctx.lineTo(22, 68);
    ctx.lineTo(35, 86);
    ctx.lineTo(48, 58);
    ctx.lineTo(61, 86);
    ctx.lineTo(74, 68);
    ctx.lineTo(74, 104);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(22, 108, 52, 8);
  });
}

/** Calçamento de pedra do pátio do reino. */
export function cobbleTexture() {
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5f5a51';
    ctx.fillRect(0, 0, w, h);
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const cx = col * 32 + 16 + (random() - 0.5) * 7;
        const cy = row * 32 + 16 + (random() - 0.5) * 7;
        const radius = 12 + random() * 4;
        const shade = 126 + Math.floor(random() * 46);
        ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 14})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius, radius * 0.78, random() * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 15);
  return texture;
}

/** Placa de madeira com o nome do estabelecimento. */
export function signTexture(text) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3a2a1b';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c9a35a';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#ecd9a6';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2, w - 40);
  });
}

/** Toldo listrado das barracas do mercado. */
export function stripeTexture(a = '#8d2b2b', b = '#e6dcc2') {
  const texture = canvasTexture(64, 64, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? a : b;
      ctx.fillRect((i * w) / 8, 0, w / 8, h);
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  return texture;
}

/** Textura macia para fumaça e brilho das brechas. */
export function softDotTexture(color = 0xffffff) {
  const c = new THREE.Color(color);
  const rgb = `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`;
  return canvasTexture(64, 64, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, `rgba(${rgb}, 1)`);
    gradient.addColorStop(0.45, `rgba(${rgb}, 0.5)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
}
