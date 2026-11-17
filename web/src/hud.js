import { KINGDOM, GATE, RIFTS, MAP_MARKERS } from './world/layout.js';

const RANGE = 165;

function drawStatic(ctx, size) {
  const scale = size / (RANGE * 2);
  const px = (x) => (x + RANGE) * scale;
  const pz = (z) => (z + RANGE) * scale;

  ctx.fillStyle = '#11190f';
  ctx.fillRect(0, 0, size, size);

  // floresta densa em volta do reino
  let seed = 991;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 520; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 84 + random() * 72;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x) < 22 && z > 50) continue;
    ctx.fillStyle = i % 3 === 0 ? '#1b2c1c' : '#162415';
    ctx.beginPath();
    ctx.arc(px(x), pz(z), 1.8 + random() * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // estrada e trilhas
  ctx.strokeStyle = '#5d4b35';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(px(GATE.x), pz(GATE.z));
  ctx.lineTo(px(GATE.x), pz(196));
  ctx.stroke();

  ctx.strokeStyle = '#3f3348';
  ctx.lineWidth = 2;
  for (const rift of RIFTS) {
    ctx.beginPath();
    ctx.moveTo(px(rift.x), pz(rift.z));
    ctx.lineTo(px(GATE.x), pz(GATE.z));
    ctx.stroke();
  }

  // pátio do reino
  ctx.fillStyle = '#6f6a5f';
  ctx.fillRect(px(KINGDOM.minX + 2), pz(KINGDOM.minZ + 2), (KINGDOM.maxX - KINGDOM.minX - 4) * scale, (KINGDOM.maxZ - KINGDOM.minZ - 4) * scale);

  // muralha
  ctx.strokeStyle = '#cfc3a3';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(px(KINGDOM.minX), pz(KINGDOM.minZ), (KINGDOM.maxX - KINGDOM.minX) * scale, (KINGDOM.maxZ - KINGDOM.minZ) * scale);

  // castelo
  ctx.fillStyle = '#9d9a90';
  ctx.fillRect(px(-21), pz(-45), 42 * scale, 26 * scale);

  // brechas
  for (const rift of RIFTS) {
    ctx.fillStyle = 'rgba(162, 72, 214, 0.35)';
    ctx.beginPath();
    ctx.arc(px(rift.x), pz(rift.z), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b268e6';
    ctx.beginPath();
    ctx.arc(px(rift.x), pz(rift.z), 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // locais do reino
  for (const marker of MAP_MARKERS) {
    ctx.fillStyle = marker.color;
    ctx.fillRect(px(marker.x) - 2.5, pz(marker.z) - 2.5, 5, 5);
  }
}

export function createHud() {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const size = canvas.width;

  const layer = document.createElement('canvas');
  layer.width = size;
  layer.height = size;
  drawStatic(layer.getContext('2d'), size);

  const locationLabel = document.getElementById('location');
  const scale = size / (RANGE * 2);

  return {
    update(state) {
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(layer, 0, 0);

      const x = (state.x + RANGE) * scale;
      const z = (state.z + RANGE) * scale;

      ctx.save();
      ctx.translate(x, z);
      ctx.rotate(-state.facing);
      ctx.fillStyle = '#ffe9ad';
      ctx.strokeStyle = 'rgba(20, 16, 10, 0.85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(-4.2, -4.2);
      ctx.lineTo(4.2, -4.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const inside =
        state.x > KINGDOM.minX && state.x < KINGDOM.maxX && state.z > KINGDOM.minZ && state.z < KINGDOM.maxZ;
      if (inside) locationLabel.textContent = 'Reino de Vaelsgard';
      else if (state.z > GATE.z) locationLabel.textContent = 'Floresta Sombria';
      else locationLabel.textContent = 'Arredores do reino';
    },
  };
}
