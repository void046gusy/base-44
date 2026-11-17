// Colisores do mundo: caixas no plano XZ para o jogador e malhas que a câmera não deve atravessar.

export const boxes = [];
export const blockers = [];

export function addCollider(x, z, halfX, halfZ) {
  boxes.push({
    minX: x - halfX,
    maxX: x + halfX,
    minZ: z - halfZ,
    maxZ: z + halfZ,
  });
}

export function addBlocker(mesh) {
  if (mesh) blockers.push(mesh);
}

export function resetWorldColliders() {
  boxes.length = 0;
  blockers.length = 0;
}
