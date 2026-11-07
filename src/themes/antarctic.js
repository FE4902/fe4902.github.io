import { audio } from '../audio/index.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { clamp, ease, hash, noise } from '../core/math.js';
import { createRenderer, crtPass, fitStage } from '../core/stage.js';
import { pixTex, art, dotKit } from '../core/textures.js';
import { createInteraction } from '../core/interaction.js';
import { slicer, prewarm, reveal } from '../core/schedule.js';
import { qa } from '../core/qa.js';
import { started, ready, initialProgress, activateStage } from '../flow.js';
import { gameHUD } from '../hud.js';
import { enterPortal } from '../portal.js';
import { PENGUIN, PENTA_BACK } from '../sprites.js';

// ---------- 남극탐험: 펭귄 날개로 얼음길을 달리는 1인칭 트랙 ----------
export async function run() {
const step = slicer();                             // 장면 생성을 짧은 조각으로 나눠 사이마다 양보
const PIXEL = 3;                                   // 화면 도트 크기 (모바일은 2)
const LEVELS = 14;                                 // 채널당 색 단계 (낮출수록 거친 도트 그라데이션)
const START = 6, FLAGS = [-28, -59, -91], CRACKS = [-18, -43, -74, -104], GOAL = -128, STOP = -118;
const LEN = 300;
const pathX = z => Math.sin(-z * .032) * 3 + Math.sin(-z * .083) * .7;
const mq = matchMedia('(prefers-reduced-motion: reduce)');
let reduce = import.meta.env.DEV && qa?.motion ? false : mq.matches;
mq.addEventListener('change', e => reduce = e.matches);

// ---------- 원작 팔레트 + 스프라이트 ----------
const PAL = { K:'#000000', W:'#ffffff', P:'#d84060', C:'#60d0e0', S:'#ffc8b8', O:'#e05000', Y:'#e8d020', N:'#c07000', G:'#50a000', E:'#bcbcbc' };

await step();
// ---------- 렌더러: 저해상도 + 색 단계 제한 + 베이어 디더링 ----------
const renderer = createRenderer();
const scene = new THREE.Scene();
scene.background = new THREE.Color('#43cde6');
scene.fog = new THREE.Fog('#bceffc', 65, 180);   // 밝은 낮, 먼 얼음만 옅게
const camera = new THREE.PerspectiveCamera(60, 1, .05, 400);
scene.add(camera);
const look = new THREE.Vector3();

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), .08, .1, 2.));   // 흰 설원이 번지지 않게 문턱을 높임
composer.addPass(new OutputPass());
const post = crtPass(LEVELS);
composer.addPass(post);
const updateHUD = gameHUD(post);

const { drawRows, rowsTex, sprite, box, boxes } = dotKit(scene, PAL);

// ---------- 클릭: 물범·물고기만, 투명한 도트는 통과 ----------
const fx = { bonus: 0 };
const { clickables, clickable, pick, updateInteraction } = createInteraction({ renderer, scene, camera, PAL, playing: () => started && ready.hidden, reduced: () => reduce });

await step();
// ---------- 원작 남극: 흰 얼음 대륙·푸른 바다·낮은 빙산 ----------
const A = { sky: '#43cde6', snow: '#f4f6f4', ice: '#a9eafa', blue: '#485bff', sea: '#183fc9', dark: '#06216c' };
scene.add(new THREE.AmbientLight('#ffffff', 2));
const groundMat = new THREE.MeshBasicMaterial({ color: A.sea });
const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), groundMat);
ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, -.3, -100); scene.add(ocean);
const iceTex = pixTex(64, 64, c => {
  c.fillStyle = A.snow; c.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 55; i++) { c.fillStyle = i % 3 ? '#e3f4f8' : '#ceeef5'; c.fillRect(hash(i) * 64, hash(i + 51) * 64, 1 + hash(i + 5) * 5, 1); }
}, [1, 38]);
const vertices = [], uvs = [], indices = [];
for (let i = 0; i <= 300; i++) {
  const z = 24 - i, x = pathX(z), width = 6.5 + Math.sin(i * .07) * .5;
  vertices.push(x - width, 0, z, x + width, 0, z); uvs.push(0, i / 300, 1, i / 300);
  if (i < 300) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
}
const roadGeo = new THREE.BufferGeometry();
roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); roadGeo.setIndex(indices); roadGeo.computeVertexNormals();
scene.add(new THREE.Mesh(roadGeo, new THREE.MeshBasicMaterial({ map: iceTex, side: THREE.DoubleSide })));
await step();
// 얼음 가장자리에 계단식 얇은 단면 (움직이지 않으니 한 덩어리로)
const edges = [];
for (let i = 0; i < 150; i++) {
  const z = 23 - i * 2, x = pathX(z), width = 6.5 + Math.sin(i * 2 * .07) * .5;
  [-1, 1].forEach(s => edges.push([[.35, .32, 2.1], [x + s * width, -.11, z], [A.blue, A.blue, A.ice, A.blue, A.blue, A.blue]]));
}
boxes(edges);
await step();
const skyline = new THREE.Sprite(new THREE.SpriteMaterial({ map: pixTex(512, 56, c => {
  for (let x = 0; x < 512; x++) {
    const h = Math.round(5 + noise(x * .075) * 18 + noise(x * .2) * 8);
    c.fillStyle = '#f4f6ff'; c.fillRect(x, 56 - h, 1, h);
    c.fillStyle = '#8bcfff'; c.fillRect(x, 56 - h + 3, 1, Math.max(1, h - 6));
    if (x % 7 < 3) { c.fillStyle = '#485bff'; c.fillRect(x, 55 - Math.floor(h * .4), 1, h * .4); }
    c.fillStyle = '#f4f6ff'; c.fillRect(x, 54, 1, 2);
  }
}), fog: false, depthWrite: false }));
skyline.center.set(.5, 0); skyline.scale.set(270, 17, 1); scene.add(skyline);
const cloudTex = pixTex(32, 8, c => { c.fillStyle = '#fff'; c.fillRect(6, 2, 17, 3); c.fillRect(0, 4, 30, 2); c.fillRect(10, 0, 9, 2); c.fillRect(10, 6, 12, 1); });
const clouds = [-1, -.45, .3, .85].map((x, i) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false }));
  s.scale.set(9 + i * 2, 2.2, 1); s.userData.off = x * 75; s.userData.y = 20 + (i % 2) * 9; scene.add(s); return s;
});
await step();
// 바다 위 낮은 유빙, 원작처럼 도트 덩어리
const floes = [];
for (let i = 0; i < 60; i++) {
  const z = 18 - i * 3.9, s = i % 2 ? -1 : 1, x = pathX(z) + s * (9 + hash(i * 4) * 25);
  floes.push([[1 + hash(i) * 3, .25, 1 + hash(i + 4) * 3], [x, -.12, z], [A.blue, A.blue, A.snow, A.blue, A.ice, A.ice]]);
}
boxes(floes);
await step();
function pool(x, z, w, d) {
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1, 12), new THREE.MeshBasicMaterial({ color: A.dark }));
  hole.rotation.x = -Math.PI / 2; hole.scale.set(w, d, 1); hole.position.set(pathX(z) + x, .025, z); scene.add(hole);
  const rim = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 12), new THREE.MeshBasicMaterial({ color: A.blue, side: THREE.DoubleSide }));
  rim.rotation.x = -Math.PI / 2; rim.scale.set(w, d, 1); rim.position.copy(hole.position); scene.add(rim); return hole;
}
// 크레바스는 길을 가로지르는 들쭉날쭉한 검푸른 틈
CRACKS.forEach((z, k) => {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 16; i++) { const x = -5.6 + i * .7, y = hash(i + k * 30) * .5; i ? shape.lineTo(x, y) : shape.moveTo(x, y); }
  for (let i = 16; i >= 0; i--) shape.lineTo(-5.6 + i * .7, 1 + hash(i + 40 + k * 30) * .5);
  shape.closePath();
  const hole = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: A.blue, side: THREE.DoubleSide }));
  hole.rotation.x = -Math.PI / 2; hole.position.set(pathX(z), .03, z); scene.add(hole);
});

await step();
// ---------- 물범·물고기: 코드로 그린 원작풍 도트 ----------
const SNOWMAN = [
 '........KKKKKK..........', '......KKWWWWWWKK........', '.....KWWWWWWWWWWK.......', '....KWWKWWWWKWWWWK......',
 '....KWWKWWWWKWWWWK......', '....KWWWWKKWWWWWWK......', '.....KWWWKKWWWWWK.......', '...KKKWWWWWWWWWWKK......',
 '..KWWWWWWWWWWWWWWWK.....', '.KWWWWWWWWWWWWWWWWWK....', 'KWWWWWWWWWWWWWWWWWWWKK..', '.KKKKWWWWWWWWWWWWKKKKK..',
 '.....KKKKKKKKKKKK.......'];
// MSX 원작의 붉은 물범: 검은 수염·양옆 지느러미, 구멍에서 정면으로 등장
PAL.R = '#b02020';
const ORIGINAL_SEAL = [
 '..............RRRR..............', '............RRRRRRRR............',
 '..........RRRRRRRRRRRR..........', '.........RRRRRRRRRRRRRR.........',
 '.........RRRRRRRRRRRRRR.........', '........RRRRRKKRRKKRRRRR........',
 '........RRRRKKRRRRKKRRRR........', '........RRKRRRRRRRRRRKRR........',
 '........RRRKRRKKKKRRKRRR........', '........RRKRKRRKKRRKRKRR........',
 '........RRRKRRRKKRRRKRRR........', '........RRKRKRRKKRRKRKRR........',
 '........RRRRRKKRRKKRRRRR........', '.......R.RRRRRRRRRRRRRR.R.......',
 '.......RRRRRRRRRRRRRRRRRR.......', '......RRRRRRRRRRRRRRRRRRRR......',
 '....RR.RRRRRRRRRRRRRRRRRR.RR....', '...RRRR.RRRRRRRRRRRRRRRR.RRRR...',
 '..RRRRRRRRRRRRRRRRRRRRRRRRRRRR..', '..RRRRRRRRRRRRRRRRRRRRRRRRRRRR..',
 '..RRRRRRRRRRRRRRRRRRRRRRRRRRRRR.', '.RRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.',
 '.RRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.', '.RRRRRR.RRRRRRRRRRRRRRRR.RRRRRR.',
 'RRRRRRR.RRRRRRRRRRRRRRRR.RRRRRRR', 'RRRRRR....RRRRRRRRRRRR....RRRRRR',
 'RRRRRR....................RRRRRR', '.RRR........................RRR.',
 '..RR........................RR..'];
const FISH = ['......OO........', '....OOOOOO......', '..OOOOOOOWK.....', 'OOOOOOOOOWKO....', '..OOOOOOOOOO....', '....OOOOOO......', '......OO........'];
// 타이틀은 원작 펜타 뒷모습
document.querySelector('.title-penguin').style.backgroundImage = `url(${rowsTex(PENTA_BACK).image.toDataURL()})`;
await step();
// 눈사람은 원래 평지에, 붉은 물범만 크레바스 안에 둔다.
const snowman = { spr: sprite(SNOWMAN, .105, [pathX(-10) + 3.5, .07, -10]), dive: 0, base: .07 };
snowman.w = snowman.spr.scale.x; snowman.h = snowman.spr.scale.y;
clickable(snowman.spr, () => { snowman.dive = 1; audio.sfx('click', 'antarctic'); fx.bonus += 1000; });
const seals = [[-3.7, CRACKS[2], ORIGINAL_SEAL, .08]].map(([x, crackZ, rows, size]) => {
  const z = crackZ - .75;
  const spr = sprite(rows, size, [pathX(crackZ) + x, .07, z]);
  const s = { spr, dive: 0, z, base: .07, w: spr.scale.x, h: spr.scale.y, rows: rows.length, reveal: 0 };
  spr.visible = false;
  clickable(spr, () => { s.dive = 1; audio.sfx('click', 'antarctic'); fx.bonus += 1000; }); return s;
});
await step();
// 물보라: 틈에서 위로 튀었다 물로 떨어지는 작은 파란 도트.
const waterCount = 42, waterPos = new Float32Array(waterCount * 3).fill(-1e3);
const waterColor = new Float32Array(waterCount * 3);
const waterDrops = Array.from({ length: waterCount }, () => ({ life: 0, vx: 0, vy: 0, vz: 0 }));
const waterGeo = new THREE.BufferGeometry();
waterGeo.setAttribute('position', new THREE.BufferAttribute(waterPos, 3));
waterGeo.setAttribute('color', new THREE.BufferAttribute(waterColor, 3));
const water = new THREE.Points(waterGeo, new THREE.PointsMaterial({ size: .15, vertexColors: true, depthWrite: false }));
water.frustumCulled = false; scene.add(water);
let waterCursor = 0, waterBursts = 0;
function splash(s) {
  waterBursts++;
  for (let i = 0; i < 14; i++) {
    const n = waterCursor++ % waterCount, j = n * 3, seed = i + waterBursts * 19, side = i % 2 ? -1 : 1;
    waterPos.set([s.spr.position.x + side * (s.w * .4 + hash(seed) * .2), .09, s.z + .25 + hash(seed + 7) * .25], j);
    Object.assign(waterDrops[n], { life: .8, vx: side * (1.2 + hash(seed + 11) * 2),
      vy: 3 + hash(seed + 23) * 2.2, vz: (hash(seed + 31) - .5) * 1.4 });
    new THREE.Color([A.ice, A.blue, A.sky][i % 3]).toArray(waterColor, j);
  }
  waterGeo.attributes.color.needsUpdate = true;
}
function updateWater(dt) {
  waterDrops.forEach((drop, i) => {
    if (drop.life <= 0) return;
    const j = i * 3;
    drop.life -= dt; drop.vy -= dt * 10;
    waterPos[j] += drop.vx * dt; waterPos[j + 1] += drop.vy * dt; waterPos[j + 2] += drop.vz * dt;
    if (drop.life <= 0 || waterPos[j + 1] < .04) { drop.life = 0; waterPos[j + 1] = -1e3; }
  });
  waterGeo.attributes.position.needsUpdate = true;
}
const fishes = [[-2.8, -34], [2.8, -98]].map(([x, z], i) => {
  pool(x, z, .66, .42);
  const spr = sprite(FISH, .085, [pathX(z) + x, 1.2, z]);
  spr.center.set(.5, .5);
  const f = { spr, flip: 0, z, phase: i * 2.1 };
  clickable(spr, () => { f.flip = 1; audio.sfx('jump', 'antarctic'); fx.bonus += 1000; }); return f;
});
await step();
// 깃발 세 개 = 프로젝트 세 개, 지나가면 획득
const flags = FLAGS.map((z, i) => {
  const group = new THREE.Group(); group.position.set(pathX(z), 0, z); scene.add(group);
  const pole = new THREE.Mesh(new THREE.BoxGeometry(.07, 2.5, .07), new THREE.MeshBasicMaterial({ color: '#263561' })); pole.position.y = 1.25; group.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .7).translate(.55, 0, 0), new THREE.MeshBasicMaterial({ color: ['#f04c40', '#f4dd32', '#36bd64'][i], side: THREE.DoubleSide }));
  flag.position.set(0, 2.08, 0); group.add(flag); return { group, flag };
});

await step();
// ---------- 목적지: 눈이 얹힌 빨간 기지와 상단 깃발 ----------
const baseX = pathX(GOAL), red = '#e84348', baseSnow = '#ffffff';
box([5.6, 2.7, 3.8], [baseX, 1.35, GOAL], [red, red, red, red, red, red]);
box([1.05, 1.9, .08], [baseX, .95, GOAL + 1.94], [A.dark, A.dark, A.dark, A.dark, A.dark, A.dark]);
[-1.8, 1.8].forEach(x => box([.88, .75, .09], [baseX + x, 1.7, GOAL + 1.95], [baseSnow, baseSnow, baseSnow, baseSnow, '#8ce7ff', baseSnow]));
// 평평한 상단에 얇은 눈층, 가장자리만 도트처럼 들쭉날쭉하게
const baseSnowFaces = Array(6).fill(new THREE.MeshBasicMaterial({ color: baseSnow }));
box([5.8, .18, 4], [baseX, 2.74, GOAL], baseSnowFaces);
for (let i = 0; i < 14; i++) {
  const x = baseX - 2.6 + i * .4, h = [.06, .12, .08, .04][i % 4];
  box([.4, h, 4], [x, 2.83 + h / 2, GOAL], baseSnowFaces);
  if (i % 3 !== 1) box([.28, .1, .14], [x, 2.61, GOAL + 1.95], baseSnowFaces);
}
const flagLow = 3.45, flagRise = 1.4;
const mast = new THREE.Mesh(new THREE.BoxGeometry(.09, 2.6, .09), new THREE.MeshBasicMaterial({ color: '#28304a' }));
mast.position.set(baseX + .25, 4.18, GOAL + .5); scene.add(mast);
const baseFlag = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.05).translate(.85, 0, 0), new THREE.MeshBasicMaterial({ map: pixTex(32, 20, c => {
  c.fillStyle = '#fff'; c.fillRect(0, 0, 32, 20); c.fillStyle = '#e84348'; c.fillRect(0, 0, 32, 3); c.fillRect(0, 17, 32, 3); drawRows(c, PENGUIN, 7, 3);
}), side: THREE.DoubleSide }));
baseFlag.position.set(mast.position.x, flagLow, mast.position.z); scene.add(baseFlag);

await step();
// ---------- 전경: 몸 아래까지 이어지는 펭귄의 검은 날개 ----------
const fg = new THREE.Group(); camera.add(fg);
const fgMat = map => new THREE.MeshBasicMaterial({ map, alphaTest: .5, transparent: true, depthTest: false, depthWrite: false, fog: false });
const wingTex = art('penguin-wing', 64, 112, c => {
  c.fillStyle = '#101018'; c.beginPath();
  [[0,112],[0,78],[14,57],[30,28],[48,8],[56,5],[58,13],[51,37],[43,64],[48,112]].forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.fill();
  c.fillStyle = '#222738'; c.beginPath(); c.moveTo(50,16); c.lineTo(39,56); c.lineTo(33,68); c.lineTo(43,30); c.fill();
});
const wingL = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fgMat(wingTex)), wingR = new THREE.Mesh(wingL.geometry, fgMat(wingTex));
wingL.renderOrder = wingR.renderOrder = 11; fg.add(wingL, wingR);
const lay = {};
function layoutForeground() {
  const hh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hw = hh * camera.aspect;
  const wh = hh * 1.23, ww = Math.min(wh * 64 / 112, hw * .7);
  Object.assign(lay, { hh, wh, ww, x: Math.min(hw * .73, hw - ww * .25), y: -hh * .96 });
  wingL.scale.set(ww, wh, 1); wingR.scale.set(-ww, wh, 1);
}

await step();
// ---------- 상시 눈: 첫 프레임부터 카메라 주변 전체에 ----------
const snowCount = 360, snowPos = new Float32Array(snowCount * 3);
for (let i = 0; i < snowCount; i++) snowPos.set([(hash(i * 5) - .5) * 36, hash(i * 9 + 1) * 16 - 2, -2 - hash(i * 13) * 35], i * 3);
const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#fff', size: .1, transparent: true, opacity: .85, depthWrite: false }));
snow.frustumCulled = false; scene.add(snow);

function resize() {
  fitStage({ renderer, composer, post, camera, pixel: PIXEL, portraitFov: 75 });
  layoutForeground();
}
addEventListener('resize', resize);
resize();

await step();
// ---------- 엔딩: GAME CLEAR 1.5초 뒤 공통 이세계 전송 ----------
const clearEl = document.getElementById('clear'), clearScore = document.getElementById('clearScore');
let portalTimer;
const toPortal = () => enterPortal({ renderer, composer, post, reduced: () => reduce });

// ---------- 루프: 스크롤 = 달리기 ----------
const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', e => {
  ptr.tx = e.clientX / innerWidth - .5; ptr.ty = e.clientY / innerHeight - .5;
});
const ride = document.querySelector('.ride'), scoreEl = document.getElementById('score');
const distanceEl = document.getElementById('distance'), flagsEl = document.getElementById('flags');
const clock = new THREE.Timer();
let t = 0, sp = 0, shown = null, speed = 0, prevZ = START, bobAmp = 0, wipeT = 1;
const lookS = new THREE.Vector3(pathX(START - 20), 1.65, START - 20);
// ?p=0.5 → 타이틀을 건너뛰고 해당 진행률로 이동
const p0 = Number.isFinite(initialProgress) ? clamp(initialProgress) : 0;
if (started) { if (!(import.meta.env.DEV && qa)) scrollTo(0, p0 * (ride.offsetHeight - innerHeight)); sp = clamp(p0); }
await prewarm({ renderer, composer, camera, scenes: [scene], step });   // 텍스처·셰이더를 첫 프레임 전에 나눠서

const trackZ = p => START + (STOP - START) * clamp((p - .03) / .9);
const rideSfx = audio.ride('antarctic', CRACKS.map(z => z + 4), FLAGS, [['flag', trackZ(.9)]]);
activateStage();
const LOOP = () => {
  clock.update();
  const dt = Math.min(clock.getDelta(), .1);
  t += dt;   // 눈과 클릭 반응은 움직임 줄이기 상태에서도 항상 진행
  const target = (import.meta.env.DEV ? qa?.progress(p0) : undefined) ?? clamp(scrollY / Math.max(1, ride.offsetHeight - innerHeight));
  sp += ((started && ready.hidden ? target : 0) - sp) * (reduce ? 1 : 1 - Math.exp(-dt * 3));
  const progress = clamp((sp - .03) / .9);
  let z = START + (STOP - START) * progress;
  // 타이틀 뒤에서는 짧은 구간만 천천히 데모 주행
  if (!started) z = START - (reduce ? 0 : (t * .8) % 12);
  let jump = 0;
  CRACKS.forEach(r => { const d = z - r; if (Math.abs(d) < 4) jump = Math.max(jump, Math.cos(d / 4 * Math.PI / 2)); });
  const finish = ease(clamp((sp - .9) / .05));
  const cleared = started && sp > .95;
  if (cleared && !shown) audio.scene('clear');
  const rideForward = started && ready.hidden && rideSfx(z, trackZ(target));
  speed += (Math.abs(z - prevZ) / Math.max(dt, .001) - speed) * (1 - Math.exp(-dt * 6)); prevZ = z;
  bobAmp += ((reduce ? 0 : clamp(speed / 6)) * (1 - finish) - bobAmp) * (1 - Math.exp(-dt * 5));
  const gait = z * 1.8, bob = Math.abs(Math.sin(gait)) * .055 * bobAmp;
  camera.position.set(pathX(z), 1.65 + bob + jump * (reduce ? .45 : 1.1), z);
  // 길의 앞을 바라봄. 움직임 줄이기에서는 마우스 시차도 끔
  look.set(pathX(z - 18) + (reduce ? 0 : ptr.x * 1.2), 1.7 + jump * .2 - (reduce ? 0 : ptr.y * .8), z - 18);
  if (reduce) lookS.copy(look); else lookS.lerp(look, 1 - Math.exp(-dt * 8));
  camera.lookAt(lookS); camera.rotateZ(Math.sin(gait) * .018 * bobAmp);
  const flap = Math.sin(gait) * .09 * bobAmp;
  fg.visible = started && ready.hidden;
  wingL.position.set(-lay.x, lay.y + flap - finish * lay.wh, -1);
  wingR.position.set(lay.x, lay.y - flap - finish * lay.wh, -1);
  wingL.rotation.z = -.15 + flap; wingR.rotation.z = .15 + flap;
  skyline.position.set(camera.position.x * .3, -.35, z - 135);
  clouds.forEach(s => s.position.set(camera.position.x * .4 + s.userData.off, s.userData.y, z - 120));
  ptr.x += (ptr.tx - ptr.x) * Math.min(1, dt * 3); ptr.y += (ptr.ty - ptr.y) * Math.min(1, dt * 3);

  updateInteraction(dt);
  // 눈사람은 처음의 납작해졌다 튀어오르는 모션 그대로.
  snowman.dive = Math.max(0, snowman.dive - dt * .75);
  const snowPhase = 1 - snowman.dive;
  const snowDip = snowman.dive > 0 ? Math.sin(Math.min(1, snowPhase / .6) * Math.PI) : 0;
  const snowPop = snowman.dive > 0 && snowPhase > .6 ? Math.sin((snowPhase - .6) / .4 * Math.PI) * .6 : 0;
  snowman.spr.scale.set(snowman.w * (1 + snowDip * .22), snowman.h * (1 - snowDip * .94), 1);
  snowman.spr.position.y = snowman.base + snowPop;
  seals.forEach(s => {
    s.dive = Math.max(0, s.dive - dt * .75);
    const phase = 1 - s.dive;
    // 잠깐 완전히 숨은 뒤 머리부터 다시 올라온다.
    const dip = s.dive <= 0 ? 0 : phase < .3 ? ease(phase / .3) : phase < .6 ? 1 : 1 - ease((phase - .6) / .4);
    const distance = z - s.z;
    const emerge = ease(clamp((26 - distance) / 10)) * ease(clamp((distance + 3) / 4));
    // 아래쪽 도트를 잘라 실제로 얼음 속에 잠기게 한다. 그림을 찌그러뜨리지 않는다.
    const visibleRows = Math.round(s.rows * .88 * emerge * (1 - dip));
    const reveal = visibleRows / s.rows, map = s.spr.material.map;
    if (reveal > .08 && s.reveal <= .08) {
      splash(s);
      if (rideForward && !s.sounded) audio.sfx('splash', 'antarctic');
      s.sounded = true;
    }
    s.reveal = reveal;
    map.repeat.y = reveal; map.offset.y = 1 - reveal;
    s.spr.visible = visibleRows > 0;
    s.spr.scale.set(s.w, s.h * reveal, 1);
    s.spr.position.y = s.base;
  });
  updateWater(dt);
  fishes.forEach(f => {
    f.flip = Math.max(0, f.flip - dt * .8);
    f.spr.position.y = f.flip > 0 ? .8 + Math.sin((1 - f.flip) * Math.PI) * 3 : .9 + Math.abs(Math.sin(t * 1.6 + f.phase)) * .65;
    f.spr.material.rotation = f.flip > 0 ? ease(1 - f.flip) * Math.PI * 4 : -.2 + Math.sin(t * 1.6 + f.phase) * .2;
  });
  flags.forEach((f, i) => { f.group.visible = z > FLAGS[i]; f.flag.rotation.y = Math.sin(t * 3 + i) * .17; });
  baseFlag.position.y = flagLow + finish * flagRise;
  baseFlag.rotation.y = Math.sin(t * 2) * .12;
  // 눈은 카메라 주변에 유지하되 수직·좌우로 고르게 흩날림
  snow.position.set(camera.position.x, 0, z);
  for (let i = 0; i < snowCount; i++) {
    const j = i * 3;
    snowPos[j] += Math.sin(t * .7 + i) * dt * .1;
    snowPos[j + 1] -= dt * (.65 + hash(i + 41) * .6);
    if (snowPos[j + 1] < -2) snowPos[j + 1] += 16;
  }
  snowGeo.attributes.position.needsUpdate = true;
  const got = FLAGS.filter(r => z <= r).length;
  scoreEl.textContent = String(Math.max(0, Math.floor((START - z) * 10) * 10) + got * 5000 + fx.bonus).padStart(6, '0');
  distanceEl.textContent = String(Math.round((1 - progress) * 1200)).padStart(4, '0'); flagsEl.textContent = got;
  document.getElementById('speedbar').style.opacity = .35 + clamp(speed / 8) * .65;
  if (cleared !== shown) {
    clearEl.classList.toggle('on', cleared); clearEl.setAttribute('aria-hidden', String(!cleared));
    clearScore.textContent = scoreEl.textContent; clearTimeout(portalTimer);
    if (cleared) { wipeT = 0; portalTimer = setTimeout(toPortal, 1500); }
    shown = cleared;
  }
  if (shown) clearScore.textContent = scoreEl.textContent;
  const u = post.uniforms;
  wipeT += dt; u.time.value = t;
  u.wipe.value = reduce || wipeT >= .5 ? 0 : Math.sin(Math.PI * wipeT / .5) * .7;
  u.motion.value = reduce ? 0 : 1;
  updateHUD();
  composer.render();
};
// 검수 훅이 있으면 프레임을 직접 돌린다 (eval 은 이 함수 안의 변수를 쓰기 위함, 개발 서버 전용)
if (import.meta.env.DEV && qa) qa.attach({ LOOP, run: code => eval(code), renderer, composer }); else renderer.setAnimationLoop(LOOP);
reveal(renderer.domElement, reduce || (import.meta.env.DEV && !!qa));
}
