import * as THREE from 'three';

// ---------- 텍스처 도우미 ----------
export const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
export function pixTex(w, h, draw, repeat) {
  const c = canvas(w, h);
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
// 교체 그림: src/assets/<name>.webp 가 있으면 그 일러스트로 바꾼다. 목록은 빌드 때 정해지므로 없는 파일은 요청하지 않는다 (404 없음)
const ART = import.meta.glob('../assets/*.webp', { eager: true, query: '?url', import: 'default' });
export function art(name, w, h, draw) {
  const tex = pixTex(w, h, draw), url = ART[`../assets/${name}.webp`];
  if (url) {
    const img = new Image();
    img.onload = () => { tex.image = img; tex.needsUpdate = true; };
    img.src = url;
  }
  return tex;
}
export const lit = map => new THREE.MeshLambertMaterial({ map, alphaTest: .5 });

// 팔레트 글자로 그린 도트 → 텍스처 · 무대에 세우는 스프라이트 · 상자 (서커스·남극)
export function dotKit(scene, PAL) {
  const drawRows = (c, rows, ox = 0, oy = 0) => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (PAL[ch]) { c.fillStyle = PAL[ch]; c.fillRect(ox + x, oy + y, 1, 1); } }));
  const rowsTex = rows => pixTex(Math.max(...rows.map(r => r.length)), rows.length, c => drawRows(c, rows));
  // 항상 나를 바라보는 도트 판 (둠 방식), 아래 가운데 기준
  function sprite(rows, s, [x, y, z]) {
    const map = rowsTex(rows), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, alphaTest: .5 }));
    sp.center.set(.5, 0);
    sp.scale.set(map.image.width * s, map.image.height * s, 1);
    sp.position.set(x, y, z);
    scene.add(sp);
    return sp;
  }
  // 입체 무대: faces 순서 [+x, -x, +y, -y, +z, -z]
  // 같은 색 면·같은 크기 상자는 재질·형태를 같이 쓴다 (남극 얼음 단면 수백 개 → 첫 프레임 준비 비용 감소, 그림은 같음)
  const faceMats = new Map(), faceMat = color => faceMats.get(color) || faceMats.set(color, new THREE.MeshLambertMaterial({ color })).get(color);
  const boxGeos = new Map(), boxGeo = (w, h, d) => boxGeos.get(`${w},${h},${d}`) || boxGeos.set(`${w},${h},${d}`, new THREE.BoxGeometry(w, h, d)).get(`${w},${h},${d}`);
  function box([w, h, d], [x, y, z], faces) {
    const m = new THREE.Mesh(boxGeo(w, h, d), faces.map(f => f.isMaterial ? f : faceMat(f)));
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }
  // 움직이지 않는 상자 여러 개를 면 색별 한 덩어리로 합친다 (그리기 호출 수백 → 색 수만큼, 그림은 box() 와 같음)
  // GPU 없는 환경(소프트웨어 렌더링)에선 그리기 호출 수가 곧 프레임 비용이다. list: [[크기], [위치], faces(색)]
  function boxes(list) {
    const parts = new Map();   // 색 → { pos, nor, idx }
    for (const [[w, h, d], [x, y, z], faces] of list) {
      const g = boxGeo(w, h, d), p = g.attributes.position, n = g.attributes.normal, index = g.index.array;
      g.groups.forEach(({ start, count }, i) => {
        const part = parts.get(faces[i]) || parts.set(faces[i], { pos: [], nor: [], idx: [] }).get(faces[i]);
        const base = part.pos.length / 3, first = index[start];
        for (let v = first; v < first + 4; v++) {   // BoxGeometry 의 한 면 = 꼭짓점 4개·삼각형 2개
          part.pos.push(p.getX(v) + x, p.getY(v) + y, p.getZ(v) + z);
          part.nor.push(n.getX(v), n.getY(v), n.getZ(v));
        }
        for (let k = start; k < start + count; k++) part.idx.push(index[k] - first + base);
      });
    }
    for (const [color, { pos, nor, idx }] of parts) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setIndex(idx);
      scene.add(new THREE.Mesh(geo, faceMat(color)));
    }
  }
  return { drawRows, rowsTex, sprite, box, boxes };
}
