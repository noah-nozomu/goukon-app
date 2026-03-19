export function generateMatchId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join("_");
}

export function generateLikeId(from: string, to: string): string {
  return `${from}_${to}`;
}
