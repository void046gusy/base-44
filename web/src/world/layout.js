// Layout compartilhado do mundo: usado pelo mapa, pela floresta e pelo minimapa.

export const KINGDOM = { minX: -60, maxX: 60, minZ: -48, maxZ: 60 };

export const GATE = { x: 0, z: 60, width: 14 };

// Brechas de onde as criaturas saem da floresta, ao sul do reino.
export const RIFTS = [
  { x: -38, z: 104 },
  { x: 4, z: 122 },
  { x: 46, z: 100 },
];

// Locais marcados no minimapa.
export const MAP_MARKERS = [
  { x: 0, z: -32, label: 'Castelo', color: '#dcd6c2' },
  { x: -38, z: 2, label: 'Guilda', color: '#c9a35a' },
  { x: 38, z: 2, label: 'Ferreiro', color: '#d97a3a' },
  { x: 36, z: -20, label: 'Curandeiro', color: '#7fbf88' },
  { x: -38, z: -24, label: 'Taverna', color: '#b0793f' },
  { x: 0, z: 16, label: 'Praça', color: '#9fc6d8' },
];
