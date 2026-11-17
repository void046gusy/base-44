import * as THREE from 'three';

// Texturas procedurais geradas em canvas: cada superfície devolve albedo (map),
// mapa de normais (normalMap) e rugosidade (roughnessMap). Tudo é gerado uma vez
// e compartilhado entre os materiais, então o custo fica só no carregamento.

const cache = new Map();

function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d') };
}

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

function rgbString(r, g, b) {
  return `rgb(${clamp255(r)}, ${clamp255(g)}, ${clamp255(b)})`;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function tracePolygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

/** Grão fino por pixel, quebrando o aspecto "plástico" das cores chapadas. */
function addGrain(ctx, size, amount, seed) {
  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  const rand = makeRng(seed);
  for (let i = 0; i < data.length; i += 4) {
    const noise = (rand() - 0.5) * amount * 2;
    data[i] = clamp255(data[i] + noise);
    data[i + 1] = clamp255(data[i + 1] + noise);
    data[i + 2] = clamp255(data[i + 2] + noise);
  }
  ctx.putImageData(image, 0, 0);
}

/** Ruído fractal periódico (value noise) usado para manchas e desgaste. */
function fbm(size, { grid = 8, octaves = 4, gain = 0.55, seed = 1 } = {}) {
  const random = makeRng(seed);
  const layers = [];
  for (let o = 0; o < octaves; o++) {
    const g = Math.max(2, Math.round(grid * 2 ** o));
    const values = new Float32Array(g * g);
    for (let i = 0; i < values.length; i++) values[i] = random();
    layers.push({ g, values, amp: gain ** o });
  }

  const result = new Float32Array(size * size);
  const smooth = (t) => t * t * (3 - 2 * t);
  let min = Infinity;
  let max = -Infinity;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const layer of layers) {
        const { g, values, amp } = layer;
        const fx = (x / size) * g;
        const fy = (y / size) * g;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = smooth(fx - x0);
        const ty = smooth(fy - y0);
        const xa = ((x0 % g) + g) % g;
        const xb = (xa + 1) % g;
        const ya = ((y0 % g) + g) % g;
        const yb = (ya + 1) % g;
        const v00 = values[ya * g + xa];
        const v10 = values[ya * g + xb];
        const v01 = values[yb * g + xa];
        const v11 = values[yb * g + xb];
        const top = v00 * (1 - tx) + v10 * tx;
        const bottom = v01 * (1 - tx) + v11 * tx;
        v += amp * (top * (1 - ty) + bottom * ty);
      }
      result[y * size + x] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  const span = max - min || 1;
  for (let i = 0; i < result.length; i++) result[i] = (result[i] - min) / span;
  return result;
}

/** Pinta um campo de ruído interpolando entre duas cores. */
function paintField(ctx, size, field, colorA, colorB, alpha = 1) {
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let i = 0; i < field.length; i++) {
    const t = field[i];
    const p = i * 4;
    data[p] = colorA[0] + (colorB[0] - colorA[0]) * t;
    data[p + 1] = colorA[1] + (colorB[1] - colorA[1]) * t;
    data[p + 2] = colorA[2] + (colorB[2] - colorA[2]) * t;
    data[p + 3] = alpha * 255;
  }
  ctx.putImageData(image, 0, 0);
}

/** Converte um mapa de altura em mapa de normais (tangente ao espaço da UV). */
function normalFromHeight(heightCtx, size, strength) {
  const source = heightCtx.getImageData(0, 0, size, size).data;
  const { canvas, ctx } = makeCanvas(size);
  const image = ctx.createImageData(size, size);
  const out = image.data;

  const h = (x, y) => {
    const xx = ((x % size) + size) % size;
    const yy = ((y % size) + size) % size;
    return source[(yy * size + xx) * 4] / 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const nx = -dx;
      const ny = dy;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const p = (y * size + x) * 4;
      out[p] = (nx / len) * 0.5 * 255 + 127.5;
      out[p + 1] = (ny / len) * 0.5 * 255 + 127.5;
      out[p + 2] = (nz / len) * 0.5 * 255 + 127.5;
      out[p + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function toTexture(canvas, colorSpace) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

// ---------------------------------------------------------------------------
// Alvenaria de pedra (muralhas, castelo, alicerces)
// ---------------------------------------------------------------------------
function drawStoneWall({ color, height, rough, size }) {
  const rand = makeRng(1337);
  const rows = 7;
  const cols = 4;
  const rowH = size / rows;
  const brickW = size / cols;

  color.fillStyle = '#443e35';
  color.fillRect(0, 0, size, size);
  height.fillStyle = '#2b2b2b';
  height.fillRect(0, 0, size, size);
  rough.fillStyle = '#f6f6f6';
  rough.fillRect(0, 0, size, size);

  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * brickW * 0.5;
    for (let col = -1; col <= cols; col++) {
      const x = col * brickW + offset + 2.5;
      const y = row * rowH + 2.5;
      const w = brickW - 5;
      const h = rowH - 5;
      const tone = 96 + rand() * 44;
      const warm = 6 + rand() * 12;

      color.fillStyle = rgbString(tone + warm, tone + warm * 0.45, tone - 8);
      roundRect(color, x, y, w, h, 3);
      color.fill();

      color.fillStyle = 'rgba(255, 246, 226, 0.22)';
      color.fillRect(x + 1, y + 1, w - 2, 2.5);
      color.fillRect(x + 1, y + 1, 2.5, h - 2);
      color.fillStyle = 'rgba(18, 15, 12, 0.34)';
      color.fillRect(x + 1, y + h - 3.5, w - 2, 2.5);
      color.fillRect(x + w - 3.5, y + 1, 2.5, h - 2);

      for (let i = 0; i < 95; i++) {
        const px = x + rand() * w;
        const py = y + rand() * h;
        const dark = rand() > 0.42;
        color.fillStyle = dark ? 'rgba(26, 22, 17, 0.18)' : 'rgba(255, 244, 222, 0.14)';
        color.fillRect(px, py, 1 + rand() * 2.2, 1 + rand() * 1.8);
      }

      for (let i = 0; i < 4; i++) {
        color.fillStyle = `rgba(58, 46, 34, ${(0.05 + rand() * 0.08).toFixed(3)})`;
        color.beginPath();
        color.ellipse(
          x + rand() * w,
          y + rand() * h,
          5 + rand() * 12,
          3 + rand() * 8,
          rand() * Math.PI,
          0,
          Math.PI * 2,
        );
        color.fill();
      }

      const hv = 188 + rand() * 46;
      const heightGradient = height.createLinearGradient(0, y, 0, y + h);
      heightGradient.addColorStop(0, rgbString(hv + 22, hv + 22, hv + 22));
      heightGradient.addColorStop(1, rgbString(hv - 34, hv - 34, hv - 34));
      height.fillStyle = heightGradient;
      roundRect(height, x + 1, y + 1, w - 2, h - 2, 3);
      height.fill();

      const rv = 198 + rand() * 40;
      rough.fillStyle = rgbString(rv, rv, rv);
      roundRect(rough, x, y, w, h, 2);
      rough.fill();
    }
  }

  // escorridos de intempérie
  for (let i = 0; i < 70; i++) {
    const x = rand() * size;
    const y = rand() * size * 0.7;
    const length = 60 + rand() * 200;
    const streak = color.createLinearGradient(x, y, x, y + length);
    streak.addColorStop(0, 'rgba(28, 24, 18, 0.10)');
    streak.addColorStop(1, 'rgba(28, 24, 18, 0)');
    color.fillStyle = streak;
    color.fillRect(x, y, 2 + rand() * 7, length);
  }

  addGrain(color, size, 10, 5);
  addGrain(rough, size, 9, 6);
}

// ---------------------------------------------------------------------------
// Calçamento de pedra irregular (pátio do reino)
// ---------------------------------------------------------------------------
function drawCobble({ color, height, rough, size }) {
  const cells = 12;
  const cell = size / cells;
  const jointRandom = makeRng(4242);

  color.fillStyle = '#3b3729';
  color.fillRect(0, 0, size, size);
  height.fillStyle = '#2c2c2c';
  height.fillRect(0, 0, size, size);
  rough.fillStyle = '#f5f5f5';
  rough.fillRect(0, 0, size, size);

  for (let row = -1; row <= cells; row++) {
    for (let col = -1; col <= cells; col++) {
      const wrappedCol = ((col % cells) + cells) % cells;
      const wrappedRow = ((row % cells) + cells) % cells;
      const rand = makeRng(wrappedCol * 92821 + wrappedRow * 68917 + 7);

      const cx = (col + 0.5) * cell + (rand() - 0.5) * cell * 0.14;
      const cy = (row + 0.5) * cell + (rand() - 0.5) * cell * 0.14;
      const radius = cell * (0.62 + rand() * 0.06);
      const tone = 112 + rand() * 38;
      const greenish = rand() > 0.78;
      const points = [];

      for (let p = 0; p < 11; p++) {
        const angle = (p / 11) * Math.PI * 2;
        const r = radius * (0.9 + rand() * 0.14);
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * 0.95]);
      }

      color.fillStyle = greenish
        ? rgbString(tone - 12, tone - 2, tone - 24)
        : rgbString(tone + 10, tone + 3, tone - 14);
      tracePolygon(color, points);
      color.fill();

      for (let i = 0; i < 45; i++) {
        color.fillStyle = rand() > 0.5 ? 'rgba(30, 26, 20, 0.14)' : 'rgba(245, 238, 220, 0.1)';
        color.fillRect(cx + (rand() - 0.5) * radius * 1.4, cy + (rand() - 0.5) * radius * 1.4, 1 + rand() * 1.8, 1 + rand() * 1.5);
      }

      // topo levemente mais claro, sem brilho chapado
      color.fillStyle = 'rgba(250, 244, 228, 0.07)';
      tracePolygon(
        color,
        points.map(([px, py]) => [cx + (px - cx) * 0.72, cy + (py - cy) * 0.72]),
      );
      color.fill();

      const heightGradient = height.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius);
      heightGradient.addColorStop(0, 'rgb(228,228,228)');
      heightGradient.addColorStop(0.82, 'rgb(206,206,206)');
      heightGradient.addColorStop(1, 'rgb(118,118,118)');
      height.fillStyle = heightGradient;
      tracePolygon(height, points);
      height.fill();

      const rv = 196 + rand() * 34;
      rough.fillStyle = rgbString(rv, rv, rv);
      tracePolygon(rough, points);
      rough.fill();
    }
  }

  // musgo discreto nas juntas
  for (let i = 0; i < 70; i++) {
    color.fillStyle = `rgba(62, 74, 44, ${(0.03 + jointRandom() * 0.06).toFixed(3)})`;
    color.beginPath();
    color.ellipse(
      jointRandom() * size,
      jointRandom() * size,
      3 + jointRandom() * 9,
      2 + jointRandom() * 7,
      jointRandom() * Math.PI,
      0,
      Math.PI * 2,
    );
    color.fill();
  }

  addGrain(color, size, 9, 11);
  addGrain(rough, size, 10, 12);
}

// ---------------------------------------------------------------------------
// Madeira: tábuas com veios e nós
// ---------------------------------------------------------------------------
function drawWood({ color, height, rough, size }) {
  const rand = makeRng(808);
  const planks = 4;
  const width = size / planks;

  color.fillStyle = '#2f2317';
  color.fillRect(0, 0, size, size);
  height.fillStyle = '#565656';
  height.fillRect(0, 0, size, size);
  rough.fillStyle = '#e6e6e6';
  rough.fillRect(0, 0, size, size);

  for (let p = 0; p < planks; p++) {
    const x = p * width;
    const base = 118 + rand() * 34;

    const gradient = color.createLinearGradient(x, 0, x + width, 0);
    gradient.addColorStop(0, rgbString(base + 6, base * 0.7, base * 0.44));
    gradient.addColorStop(0.5, rgbString(base + 20, base * 0.78, base * 0.5));
    gradient.addColorStop(1, rgbString(base - 8, base * 0.64, base * 0.38));
    color.fillStyle = gradient;
    color.fillRect(x + 1.5, 0, width - 3, size);

    for (let i = 0; i < 160; i++) {
      const vx = x + 3 + rand() * (width - 6);
      const startY = rand() * size;
      const length = 40 + rand() * 220;
      color.strokeStyle =
        rand() > 0.35
          ? `rgba(48, 30, 16, ${(0.06 + rand() * 0.12).toFixed(3)})`
          : `rgba(210, 172, 122, ${(0.05 + rand() * 0.1).toFixed(3)})`;
      color.lineWidth = 0.7 + rand() * 1.4;
      color.beginPath();
      color.moveTo(vx, startY);
      color.bezierCurveTo(
        vx + (rand() - 0.5) * 6,
        startY + length * 0.35,
        vx + (rand() - 0.5) * 6,
        startY + length * 0.7,
        vx + (rand() - 0.5) * 4,
        startY + length,
      );
      color.stroke();
    }

    for (let k = 0; k < 2; k++) {
      const kx = x + width * (0.25 + rand() * 0.5);
      const ky = rand() * size;
      for (let ring = 4; ring > 0; ring--) {
        color.strokeStyle = `rgba(46, 28, 14, ${0.1 + ring * 0.05})`;
        color.lineWidth = 1.4;
        color.beginPath();
        color.ellipse(kx, ky, ring * 2.6, ring * 4.2, 0, 0, Math.PI * 2);
        color.stroke();
      }
    }

    color.fillStyle = 'rgba(16, 11, 7, 0.55)';
    color.fillRect(x, 0, 2, size);
    color.fillStyle = 'rgba(232, 198, 150, 0.12)';
    color.fillRect(x + 2, 0, 1.4, size);

    const heightGradient = height.createLinearGradient(x, 0, x + width, 0);
    heightGradient.addColorStop(0, 'rgb(96,96,96)');
    heightGradient.addColorStop(0.5, 'rgb(150,150,150)');
    heightGradient.addColorStop(1, 'rgb(96,96,96)');
    height.fillStyle = heightGradient;
    height.fillRect(x + 1.5, 0, width - 3, size);
  }

  addGrain(color, size, 12, 3);
  addGrain(rough, size, 10, 4);
}

// ---------------------------------------------------------------------------
// Reboco/estuque das casas
// ---------------------------------------------------------------------------
function drawPlaster({ color, height, rough, size }) {
  const rand = makeRng(2024);
  const mottle = fbm(size, { grid: 9, octaves: 5, seed: 91 });
  paintField(color, size, mottle, [196, 186, 166], [244, 238, 222], 1);

  for (let i = 0; i < 45; i++) {
    color.fillStyle = `rgba(126, 112, 88, ${(0.03 + rand() * 0.06).toFixed(3)})`;
    color.beginPath();
    color.ellipse(
      rand() * size,
      rand() * size,
      10 + rand() * 40,
      8 + rand() * 30,
      rand() * Math.PI,
      0,
      Math.PI * 2,
    );
    color.fill();
  }

  for (let i = 0; i < 7; i++) {
    color.strokeStyle = 'rgba(96, 84, 66, 0.32)';
    color.lineWidth = 0.8 + rand() * 0.8;
    color.beginPath();
    let cx = rand() * size;
    let cy = rand() * size;
    color.moveTo(cx, cy);
    for (let s = 0; s < 5; s++) {
      cx += (rand() - 0.5) * 40;
      cy += 10 + rand() * 30;
      color.lineTo(cx, cy);
    }
    color.stroke();
  }

  addGrain(color, size, 9, 13);
  const fine = fbm(size, { grid: 18, octaves: 4, seed: 33 });
  paintField(height, size, fine, [110, 110, 110], [168, 168, 168], 1);
  paintField(rough, size, fine, [228, 228, 228], [252, 252, 252], 1);
}

// ---------------------------------------------------------------------------
// Telhas cerâmicas
// ---------------------------------------------------------------------------
function drawRoofTiles({ color, height, rough, size }) {
  const rand = makeRng(555);
  const rows = 6;
  const cols = 6;
  const tileW = size / cols;
  const tileH = size / rows;

  color.fillStyle = '#463930';
  color.fillRect(0, 0, size, size);
  height.fillStyle = '#383838';
  height.fillRect(0, 0, size, size);
  rough.fillStyle = '#f2f2f2';
  rough.fillRect(0, 0, size, size);

  for (let row = 0; row < rows; row++) {
    const stagger = (row % 2) * tileW * 0.5;
    for (let col = -1; col <= cols; col++) {
      const x = col * tileW + stagger + 1.5;
      const y = row * tileH + 1.5;
      const w = tileW - 3;
      const h = tileH - 3;
      const tone = 150 + rand() * 46;

      const gradient = color.createLinearGradient(0, y, 0, y + h);
      gradient.addColorStop(0, rgbString(tone + 16, tone - 6, tone - 22));
      gradient.addColorStop(0.45, rgbString(tone, tone - 26, tone - 38));
      gradient.addColorStop(1, rgbString(tone - 62, tone - 78, tone - 88));
      color.fillStyle = gradient;
      roundRect(color, x, y, w, h, 7);
      color.fill();

      color.strokeStyle = 'rgba(255, 240, 220, 0.2)';
      color.lineWidth = 2.5;
      color.beginPath();
      color.moveTo(x + w * 0.06, y + h * 0.3);
      color.quadraticCurveTo(x + w * 0.5, y + 2, x + w * 0.94, y + h * 0.3);
      color.stroke();

      for (let i = 0; i < 60; i++) {
        color.fillStyle = rand() > 0.5 ? 'rgba(40, 24, 16, 0.12)' : 'rgba(255, 230, 205, 0.1)';
        color.fillRect(x + rand() * w, y + rand() * h, 1 + rand() * 2, 1 + rand() * 1.6);
      }

      const heightGradient = height.createLinearGradient(0, y, 0, y + h);
      heightGradient.addColorStop(0, 'rgb(228,228,228)');
      heightGradient.addColorStop(0.4, 'rgb(200,200,200)');
      heightGradient.addColorStop(1, 'rgb(118,118,118)');
      height.fillStyle = heightGradient;
      roundRect(height, x, y, w, h, 8);
      height.fill();

      const rv = 190 + rand() * 40;
      rough.fillStyle = rgbString(rv, rv, rv);
      roundRect(rough, x, y, w, h, 8);
      rough.fill();
    }
  }

  addGrain(color, size, 10, 14);
}

// ---------------------------------------------------------------------------
// Metal escovado (aço e ferro)
// ---------------------------------------------------------------------------
function drawMetal({ color, height, rough, size }) {
  const rand = makeRng(31);
  color.fillStyle = '#c2c7cd';
  color.fillRect(0, 0, size, size);

  for (let i = 0; i < 900; i++) {
    const y = rand() * size;
    color.strokeStyle =
      rand() > 0.5
        ? `rgba(255, 255, 255, ${(0.03 + rand() * 0.08).toFixed(3)})`
        : `rgba(70, 76, 84, ${(0.03 + rand() * 0.1).toFixed(3)})`;
    color.lineWidth = 0.6 + rand() * 1.6;
    color.beginPath();
    color.moveTo(0, y);
    color.lineTo(size, y + (rand() - 0.5) * 2);
    color.stroke();
  }

  for (let i = 0; i < 26; i++) {
    color.strokeStyle = `rgba(255, 255, 255, ${(0.12 + rand() * 0.2).toFixed(3)})`;
    color.lineWidth = 0.7;
    color.beginPath();
    const x = rand() * size;
    const y = rand() * size;
    color.moveTo(x, y);
    color.lineTo(x + (rand() - 0.5) * 60, y + (rand() - 0.5) * 14);
    color.stroke();
  }

  addGrain(color, size, 10, 15);
  paintField(height, size, fbm(size, { grid: 6, octaves: 3, seed: 12 }), [116, 116, 116], [142, 142, 142], 1);
  paintField(rough, size, fbm(size, { grid: 5, octaves: 3, seed: 13 }), [128, 128, 128], [180, 180, 180], 1);
}

// ---------------------------------------------------------------------------
// Tecido (túnicas, estandartes, toldos)
// ---------------------------------------------------------------------------
function drawCloth({ color, height, rough, size }) {
  const rand = makeRng(404);
  color.fillStyle = '#d2ccc0';
  color.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 3) {
    color.fillStyle = `rgba(255, 255, 255, ${(0.05 + rand() * 0.05).toFixed(3)})`;
    color.fillRect(0, y, size, 1.3);
    color.fillStyle = `rgba(60, 58, 52, ${(0.04 + rand() * 0.05).toFixed(3)})`;
    color.fillRect(0, y + 1.6, size, 1);
  }
  for (let x = 0; x < size; x += 3) {
    color.fillStyle = `rgba(50, 48, 44, ${(0.03 + rand() * 0.05).toFixed(3)})`;
    color.fillRect(x, 0, 1, size);
    color.fillStyle = `rgba(255, 255, 255, ${(0.03 + rand() * 0.04).toFixed(3)})`;
    color.fillRect(x + 1.5, 0, 1, size);
  }

  addGrain(color, size, 16, 16);

  const weave = fbm(size, { grid: 64, octaves: 2, seed: 61 });
  paintField(height, size, weave, [104, 104, 104], [152, 152, 152], 1);
  paintField(rough, size, fbm(size, { grid: 8, octaves: 3, seed: 62 }), [218, 218, 218], [250, 250, 250], 1);
}

// ---------------------------------------------------------------------------
// Feno/palha
// ---------------------------------------------------------------------------
function drawHay({ color, height, rough, size }) {
  const rand = makeRng(717);
  color.fillStyle = '#b2914d';
  color.fillRect(0, 0, size, size);

  for (let i = 0; i < 1500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const length = 6 + rand() * 26;
    const angle = rand() * Math.PI * 2;
    color.strokeStyle =
      rand() > 0.5
        ? `rgba(226, 200, 134, ${(0.25 + rand() * 0.4).toFixed(3)})`
        : `rgba(124, 94, 46, ${(0.2 + rand() * 0.35).toFixed(3)})`;
    color.lineWidth = 0.8 + rand() * 1.2;
    color.beginPath();
    color.moveTo(x, y);
    color.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    color.stroke();
  }

  addGrain(color, size, 12, 17);
  paintField(height, size, fbm(size, { grid: 40, octaves: 3, seed: 44 }), [120, 120, 120], [190, 190, 190], 1);
  paintField(rough, size, fbm(size, { grid: 8, octaves: 3, seed: 45 }), [222, 222, 222], [255, 255, 255], 1);
}

// ---------------------------------------------------------------------------
// Terra batida (estradas e canteiros)
// ---------------------------------------------------------------------------
function drawDirt({ color, height, rough, size }) {
  const rand = makeRng(313);
  paintField(color, size, fbm(size, { grid: 10, octaves: 4, seed: 55 }), [92, 72, 50], [148, 122, 88], 1);

  for (let i = 0; i < 800; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.8 + rand() * 3.4;
    color.fillStyle =
      rand() > 0.55
        ? `rgba(170, 158, 138, ${(0.2 + rand() * 0.4).toFixed(3)})`
        : `rgba(52, 38, 24, ${(0.2 + rand() * 0.4).toFixed(3)})`;
    color.beginPath();
    color.ellipse(x, y, r, r * 0.8, rand() * Math.PI, 0, Math.PI * 2);
    color.fill();
  }

  addGrain(color, size, 16, 18);
  paintField(height, size, fbm(size, { grid: 18, octaves: 4, seed: 56 }), [110, 110, 110], [190, 190, 190], 1);
  addGrain(height, size, 30, 57);
  paintField(rough, size, fbm(size, { grid: 12, octaves: 3, seed: 58 }), [222, 222, 222], [255, 255, 255], 1);
}

// ---------------------------------------------------------------------------
// Detalhe do terreno gramado (multiplicado pelas cores por vértice)
// ---------------------------------------------------------------------------
function drawGround({ color, height, rough, size }) {
  const rand = makeRng(99);
  const mottle = fbm(size, { grid: 10, octaves: 4, seed: 5 });
  paintField(color, size, mottle, [178, 186, 160], [242, 244, 226], 1);

  for (let i = 0; i < 2600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const length = 2 + rand() * 5;
    color.strokeStyle =
      rand() > 0.5
        ? `rgba(118, 140, 94, ${(0.25 + rand() * 0.3).toFixed(3)})`
        : `rgba(230, 236, 206, ${(0.2 + rand() * 0.25).toFixed(3)})`;
    color.lineWidth = 1;
    color.beginPath();
    color.moveTo(x, y);
    color.lineTo(x + (rand() - 0.5) * 3, y - length);
    color.stroke();
  }

  for (let i = 0; i < 520; i++) {
    color.fillStyle = `rgba(120, 96, 66, ${(0.12 + rand() * 0.2).toFixed(3)})`;
    color.beginPath();
    color.ellipse(rand() * size, rand() * size, 1 + rand() * 3, 1 + rand() * 2, 0, 0, Math.PI * 2);
    color.fill();
  }

  addGrain(color, size, 8, 19);
  paintField(height, size, mottle, [128, 128, 128], [198, 198, 198], 1);
  addGrain(height, size, 26, 20);
  paintField(rough, size, mottle, [220, 220, 220], [250, 250, 250], 1);
}

const BUILDERS = {
  stoneWall: { draw: drawStoneWall, size: 512, normalStrength: 2.6 },
  cobble: { draw: drawCobble, size: 512, normalStrength: 3.2 },
  wood: { draw: drawWood, size: 512, normalStrength: 1.8 },
  plaster: { draw: drawPlaster, size: 512, normalStrength: 1.2 },
  roofTiles: { draw: drawRoofTiles, size: 512, normalStrength: 3 },
  metal: { draw: drawMetal, size: 256, normalStrength: 1 },
  cloth: { draw: drawCloth, size: 256, normalStrength: 1.4 },
  hay: { draw: drawHay, size: 256, normalStrength: 2 },
  dirt: { draw: drawDirt, size: 256, normalStrength: 2.4 },
  ground: { draw: drawGround, size: 512, normalStrength: 1.8 },
};

export function surfaceSet(name) {
  const cached = cache.get(name);
  if (cached) return cached;

  const builder = BUILDERS[name];
  if (!builder) throw new Error(`Superfície desconhecida: ${name}`);

  const size = builder.size;
  const color = makeCanvas(size);
  const height = makeCanvas(size);
  const rough = makeCanvas(size);

  builder.draw({ color: color.ctx, height: height.ctx, rough: rough.ctx, size });

  const set = {
    map: toTexture(color.canvas, THREE.SRGBColorSpace),
    normalMap: toTexture(normalFromHeight(height.ctx, size, builder.normalStrength), THREE.NoColorSpace),
    roughnessMap: toTexture(rough.canvas, THREE.NoColorSpace),
  };

  cache.set(name, set);
  return set;
}

/** Cópia das texturas com repetição própria (para pisos grandes). */
export function repeatTextures(set, repeatX, repeatY) {
  const clone = (texture) => {
    const copy = texture.clone();
    copy.repeat.set(repeatX, repeatY);
    copy.needsUpdate = true;
    return copy;
  };
  return {
    map: clone(set.map),
    normalMap: clone(set.normalMap),
    roughnessMap: clone(set.roughnessMap),
  };
}

/** Textura de uma cor sólida com grão, para peças pequenas. */
export function grainyTexture(hex, size = 128, grain = 10, seed = 3) {
  const { canvas, ctx } = makeCanvas(size);
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  ctx.fillStyle = rgbString(r, g, b);
  ctx.fillRect(0, 0, size, size);
  addGrain(ctx, size, grain, seed);
  return toTexture(canvas, THREE.SRGBColorSpace);
}
