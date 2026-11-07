// 진행률·도트 무늬에 쓰는 작은 수학 도우미 (세 테마 공통)
export const clamp = v => Math.min(1, Math.max(0, v));
export const ease = v => v * v * (3 - 2 * v);
export const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export function noise(x, y = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), u = ease(x - xi), v = ease(y - yi), h = (a, b) => hash(a + b * 57);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}
export const fbm = (x, y = 0) => noise(x, y) * .5 + noise(x * 2.03, y * 2.03) * .25 + noise(x * 4.1, y * 4.1) * .125 + noise(x * 8.3, y * 8.3) * .0625;
