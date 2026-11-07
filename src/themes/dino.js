import { audio } from '../audio/index.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, ease, hash } from '../core/math.js';
import { createRenderer, fitStage } from '../core/stage.js';
import { pixTex } from '../core/textures.js';
import { createInteraction } from '../core/interaction.js';
import { slicer, prewarm, reveal } from '../core/schedule.js';
import { qa } from '../core/qa.js';
import { started, ready, initialProgress, activateStage } from '../flow.js';
import { dinoHUD } from '../hud.js';
import { enterPortal } from '../portal.js';
import { DINO_ROWS } from '../sprites.js';
import { START, CAKES, CACTI, BIRDS, TUMBLEWEEDS, trackZ, stageState, DINO_UNIT, bodyState, skyState, cactusLayout, tumbleweedState, storyState, trexClickState, birdClickState, stegoClickState } from './dino-model.js';

// ---------- 크롬 공룡: 티렉스 눈높이로 사막을 달리는 1인칭 트랙 ----------
export async function run() {
const step = slicer();                             // 장면 생성을 짧은 조각으로 나눠 사이마다 양보
const PIXEL = 3, LEVELS = 64;
const GOAL = -132, pathX = z => 0;
const mq = matchMedia('(prefers-reduced-motion: reduce)');
let reduce = import.meta.env.DEV && qa?.motion ? false : mq.matches;
mq.addEventListener('change', e => reduce = e.matches);
const PAL = { K:'#535353', W:'#f7f7f7', Y:'#bcbcbc' };

await step();
// ---------- 저해상도 무대와 본편의 CRT ----------
const renderer = createRenderer();
const scene = new THREE.Scene(); scene.background = new THREE.Color('#f7f7f7');
scene.fog = new THREE.Fog('#f7f7f7', 48, 165);
const camera = new THREE.PerspectiveCamera(60, 1, .05, 350); scene.add(camera);
const look = new THREE.Vector3(), lookS = new THREE.Vector3(0, 1.65, -16);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// 자기 몸은 별도 깊이 버퍼에서 그려 길·소품에 덮이지 않게 한다.
const selfScene=new THREE.Scene(),selfPass=new RenderPass(selfScene,camera);
selfPass.clear=false;selfPass.clearDepth=true;composer.addPass(selfPass);composer.addPass(new OutputPass());
const post = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, levels: { value: LEVELS }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) }, wipe: { value: 0 }, motion: { value: 1 }, night: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse, hudMap; uniform float levels, time, wipe, motion, night; uniform vec2 res; varying vec2 vUv;
    float b2(vec2 a) { a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
    float b4(vec2 a) { return b2(.5 * a) * .25 + b2(a); }
    float rnd(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv * 2. - 1.; uv *= 1. + dot(uv, uv) * .04; uv = uv * .5 + .5;
      if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) { gl_FragColor = vec4(0., 0., 0., 1.); return; }
      uv = (floor(uv * res) + .5) / res;
      vec2 ca = vec2(0.);
      vec3 c = vec3(texture2D(tDiffuse, uv + ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - ca).b);
      vec4 hud = texture2D(hudMap, uv); c = mix(c, hud.rgb, hud.a);
      c += (rnd(gl_FragCoord.xy + fract(time * 7.) * 100.) - .5) * .002;
      c *= 1. - .002 * motion * (.5 + .5 * sin(time * 50.));
      // 꽃다발과 엔딩 하트는 밤에도 고유 색을 유지한다.
      vec3 flowerColor=c;float flowerRed=smoothstep(.045,.12,max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b)));
      // 하늘은 연속으로 어두워지고 잉크는 대비를 유지하는 쪽으로 바뀐다.
      float mark = clamp((.97 - dot(c, vec3(.299,.587,.114))) / .645, 0., 1.);
      float paperTone = mix(.97,.12,night), inkTone = night < .5 ? .325 : .83;
      c = vec3(mix(paperTone,inkTone,mark));
      c=mix(c,flowerColor,flowerRed);
      if (b4(floor(gl_FragCoord.xy / 4.)) < wipe) c = vec3(0.);
      gl_FragColor = vec4(floor(c * levels + .5) / levels, 1.);
    }`,
});
composer.addPass(post); const updateHUD = dinoHUD(post);
const rect = (c, color, x, y, w, h) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
// 정수 격자만 사용해 원작처럼 번짐 없는 도트로 찍는다.
function pixelStamp(c,rows,palette,x=0,y=0){
  rows.forEach((row,dy)=>[...row].forEach((v,dx)=>{if(palette[v])rect(c,palette[v],x+dx,y+dy,1,1);}));
}
function poly(c, color, points) {
  c.fillStyle = color; c.beginPath(); points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath(); c.fill();
}
function oval(c, color, x, y, rx, ry) { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
const pickSurfaces=[];
function plate(map, w, h, x, y, z, billboard = true) {
  const mat = billboard ? new THREE.SpriteMaterial({ map, alphaTest: .5 }) : new THREE.MeshBasicMaterial({ map, alphaTest: .5, side: THREE.DoubleSide });
  const obj = billboard ? new THREE.Sprite(mat) : new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0,.5,0), mat);
  if (billboard) obj.center.set(.5, 0);
  obj.scale.set(w, h, 1); obj.position.set(x, y, z); scene.add(obj); pickSurfaces.push(obj); return obj;
}
function box(w, h, d, x, y, z, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material); mesh.position.set(x,y,z); scene.add(mesh); return mesh;
}
const basic = color => new THREE.MeshBasicMaterial({ color });

await step();
// ---------- 사막: 원작처럼 낮은 지평선·선인장·자갈·선으로 그린 구름 ----------
const ink='#535353',paper='#f7f7f7';
// 길 아래에 넓은 바닥을 겹치지 않아 먼 거리에서도 깊이 충돌이 없다.
const shoulderMat=basic('#ebebeb');
for(const sign of [-1,1])box(246.6,.12,540,sign*126.7,-.09,-100,shoulderMat);
// 중앙은 밝게 비우고 가장자리만 도트처럼 조금씩 어긋나게 만든다.
const pathVertices=[];
for(let z=30;z>-190;z-=2){
  const left=-3.4-hash(z+501)*.2,right=3.4+hash(z+801)*.2;
  pathVertices.push(left,-.02,z,right,-.02,z,left,-.02,z-2,right,-.02,z,left,-.02,z-2,right,-.02,z-2);
}
const pathGeo=new THREE.BufferGeometry();pathGeo.setAttribute('position',new THREE.Float32BufferAttribute(pathVertices,3));
scene.add(new THREE.Mesh(pathGeo,new THREE.MeshBasicMaterial({color:paper,side:THREE.DoubleSide})));
await step();
const pebbleGeo=new THREE.BoxGeometry(1,1,1), pebbleMat=basic('#a0a0a0');
const pebbles=new THREE.InstancedMesh(pebbleGeo,pebbleMat,1500),stamp=new THREE.Object3D();
for(let i=0;i<1500;i++){
  const side=i%2?1:-1,inside=i%10===0;
  const x=inside?(hash(i*7)-.5)*5.5:side*(3.9+hash(i*7)*60);
  stamp.position.set(x,.002,18-hash(i*13)*230);
  stamp.scale.set(.06+hash(i+90)*.3,.008,.025+hash(i+33)*.07);stamp.updateMatrix();pebbles.setMatrixAt(i,stamp.matrix);
}
scene.add(pebbles);
await step();
const cactusTex=pixTex(40,60,c=>{
  rect(c,ink,17,2,8,58);rect(c,ink,15,6,12,54);
  rect(c,ink,3,18,7,25);rect(c,ink,5,15,3,3);rect(c,ink,8,36,11,8);
  rect(c,ink,30,11,7,24);rect(c,ink,32,8,3,3);rect(c,ink,23,28,11,8);
  rect(c,paper,20,7,1,45);rect(c,paper,6,22,1,13);rect(c,paper,33,15,1,12);
});
const smallCactusTex=pixTex(26,38,c=>{
  rect(c,ink,10,1,7,37);rect(c,ink,9,3,9,35);
  rect(c,ink,1,12,5,16);rect(c,ink,5,23,7,5);
  rect(c,ink,21,6,5,16);rect(c,ink,16,18,8,5);rect(c,paper,13,6,1,25);
});
const obstacles=CACTI.flatMap((_,i)=>cactusLayout(i).map(o=>plate(o.small?smallCactusTex:cactusTex,o.w,o.h,o.x,0,o.z)));
await step();
// 회전초는 소품이므로 클릭 대상에 넣지 않는다.
function tumbleTexture(seed){
  return pixTex(22,22,c=>{
    // 성긴 한 색 가지와 큰 빈칸. 원형 테두리·가는 곡선·명암은 넣지 않는다.
    const rows=[
      '......................','.........#............','.....#...#....##......',
      '.....##..##..##.......','..#...#...####....#...', '..##..##..#..#...##...',
      '...####..##..#####....','....#...##......#.....','..###...#...##..##....',
      '.##.##..#####....###..','..#..####...##...#....','..#....#.....#####....',
      '..###..##....#...###..','....#...######...#....','..####..#....##.##....',
      '...#.#.##.....###.....','.....###..###..##.....','.....#...##.####......',
      '.....##..#....#.......','......####....##......','.........#............',
      '......................'
    ];
    const variant=Math.round((seed-17)/29)%3;
    if(variant===1){c.translate(22,0);c.scale(-1,1);}
    if(variant===2){c.translate(0,22);c.rotate(-Math.PI/2);}
    pixelStamp(c,rows,{'#':ink});
  });
}
const tumbleShadowTex=pixTex(24,10,c=>{
  rect(c,ink,5,2,14,6);rect(c,ink,2,3,20,4);rect(c,ink,0,4,24,2);
});
const tumbleweeds=TUMBLEWEEDS.map((_,i)=>{
  const map=tumbleTexture(17+i*29),size=[1.12,1.2,1.02][i];
  const o=plate(map,size,size,0,size*.5,TUMBLEWEEDS[i]);o.center.set(.5,.5);
  const n=map.image.width,pixels=map.image.getContext('2d').getImageData(0,0,n,n).data,support=[];
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(pixels[(y*n+x)*4+3]>127)support.push([(x-(n-1)/2)/n*size,((n-1)/2-y)/n*size]);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:tumbleShadowTex,transparent:true,opacity:.15,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.scale.set(size*.95,size*.42,1);scene.add(shadow);
  o.userData={support,shadow};return o;
});
for(let i=0;i<10;i++)for(const sign of [-1,1]){
  const z=8-i*16-hash(i*19+sign)*5,x=sign*(6+hash(i*9+sign)*7+(sign===1&&z>-82&&z<-48?4:0)),h=1.2+hash(i*13+sign)*1.3;
  plate(i%3?cactusTex:smallCactusTex,h*.66,h,x,0,z);
}
await step();
const cloudTex=pixTex(64,22,c=>{
  const points=[[1,18],[1,12],[9,12],[9,7],[18,7],[18,3],[31,3],[31,1],[42,1],[42,6],[50,6],[50,12],[58,12],[58,17],[63,17],[63,20],[1,20]];
  poly(c,'#bcbcbc',points);poly(c,paper,points.map(([x,y])=>[x===1?3:x===63?61:x,y===20?18:y+2]));
  rect(c,'#bcbcbc',1,19,62,1);
});
const clouds=[];
for(let i=0;i<3;i++){
  const o=plate(cloudTex,14+i*2,5,(i-1)*48,16+i*4,-140);o.material.fog=false;clouds.push(o);
}
await step();
// 해·달은 불투명 지면 뒤로 자연스럽게 가려진다.
const sunTex=pixTex(28,28,c=>{
  const ring=[[9,1],[19,1],[19,3],[23,3],[23,6],[26,6],[26,10],[28,10],[28,18],[26,18],[26,22],[23,22],[23,25],[19,25],[19,27],[9,27],[9,25],[5,25],[5,22],[2,22],[2,18],[0,18],[0,10],[2,10],[2,6],[5,6],[5,3],[9,3]];
  poly(c,ink,ring);poly(c,paper,ring.map(([x,y])=>[14+(x-14)*.72,14+(y-14)*.72]));
});
const sun=plate(sunTex,5.5,5.5,-26,26,-140);sun.material.fog=false;
const moonTex=pixTex(24,28,c=>{
  // 오른쪽이 밝은 초승달. 안쪽을 투명하게 비워 하늘색이 그대로 보인다.
  for(let y=0;y<28;y++)for(let x=0;x<24;x++){
    const dy=y-13.5,outer=(x-11)**2+dy**2<=144,inner=(x-6.5)**2+dy**2<=156.25;
    if(outer&&!inner)rect(c,ink,x,y,1,1);
  }
});
const moon=plate(moonTex,5,6,24,-8,-140);moon.material.fog=false;moon.material.transparent=true;moon.material.alphaTest=.02;moon.material.opacity=0;
const stars=[];const starTex=pixTex(5,5,c=>{rect(c,ink,2,0,1,5);rect(c,ink,0,2,5,1);});
for(let i=0;i<2;i++){const o=plate(starTex,.8,.8,i===0?-32:40,29+i*9,-140);o.material.fog=false;o.material.transparent=true;o.material.alphaTest=.02;stars.push(o);}

await step();
// 보너스는 기념판의 케이크 세 개. 설명은 엔딩에서만 보여 준다.
const cakeTex=pixTex(28,30,c=>{
  rect(c,ink,5,15,18,13);rect(c,paper,7,18,14,3);rect(c,paper,7,24,14,2);
  rect(c,ink,2,27,24,3);rect(c,ink,7,12,14,4);rect(c,ink,13,5,2,8);rect(c,ink,12,0,4,3);
});
const cakes=CAKES.map(z=>plate(cakeTex,.75,.83,0,.24,z));

// ---------- 클릭은 캐릭터만 ----------
const fx = { bonus: 0 };
const { clickables, clickable, pick, updateInteraction } = createInteraction({ renderer, scene, camera, PAL, playing: () => started && ready.hidden, reduced: () => reduce, surfaces: pickSurfaces });



await step();
// ---------- T-Rex와 익룡: 원작 실루엣을 Canvas 도트로 ----------
function dinoTexture(frame=0,raised=false){return pixTex(44,48,c=>{
  rect(c,ink,23,1,19,16);rect(c,ink,21,3,23,11);rect(c,paper,27,4,2,2);
  rect(c,paper,31,13,13,2);rect(c,ink,21,14,10,15);
  rect(c,ink,17,20,11,17);rect(c,ink,12,25,13,14);rect(c,ink,8,23,9,12);
  rect(c,ink,5,20,6,12);rect(c,ink,2,16,4,12);rect(c,ink,0,raised?6:12,3,raised?16:10);
  rect(c,ink,10,32,12,9);rect(c,ink,14,37,7,6);
  if(raised){rect(c,ink,28,20,7,3);rect(c,ink,33,16,2,7);}
  else{rect(c,ink,28,23,7,3);rect(c,ink,33,24,2,5);}
  if(frame===0){rect(c,ink,13,41,4,6);rect(c,ink,13,46,8,2);rect(c,ink,23,37,4,7);rect(c,ink,25,42,5,2);}
  else{rect(c,ink,14,39,4,5);rect(c,ink,16,42,6,2);rect(c,ink,22,39,4,8);rect(c,ink,22,46,8,2);}
});}
const dinoFrames=[dinoTexture(),dinoTexture(1)],dinoJumpTex=dinoTexture(1,true);
document.querySelector('.title-penguin').style.backgroundImage=`url(${dinoFrames[0].image.toDataURL()})`;
await step();
// 초반 티렉스는 원작의 장식 없는 그림을 사용한다.
const girlfriendFrames=dinoFrames;
// 리본은 마지막 커플 중 한 마리에게만 붙인다.
const endingGirlfriendTex=pixTex(48,56,c=>{
  c.drawImage(dinoFrames[0].image,2,8);
  poly(c,ink,[[29,3],[22,0],[22,8],[29,6],[36,8],[36,0]]);
  poly(c,paper,[[27,4],[24,2],[24,6]]);poly(c,paper,[[31,4],[34,2],[34,6]]);rect(c,paper,28,3,3,3);
});
const mirrorFrames=frames=>frames.map(map=>pixTex(map.image.width,map.image.height,c=>{c.translate(map.image.width,0);c.scale(-1,1);c.drawImage(map.image,0,0);}));
const rivalFrames=mirrorFrames(dinoFrames);
const runners=[[-3.5,-12]].map(([x,z])=>{
  const spr=plate(girlfriendFrames[0],11/6,2,x,0,z),runner={spr,x,z,w:11/6,h:2,flip:0};
  clickable(spr,()=>{if(spr.userData.clickEnabled!==false&&runner.flip<=0){runner.flip=1;audio.sfx('click','dino');fx.bonus+=1000;}});return runner;
});
const rival=plate(rivalFrames[0],11/6,2,1.08,0,-126.5);rival.visible=false;
const heartTexture=color=>pixTex(9,8,c=>{
  ['.##...##.','####.####','#########','#########','.#######.','..#####..','...###...','....#....'].forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='#')rect(c,color,x,y,1,1);}));
});
const endHeartTex=heartTexture('#ee4266');
const endHeart=plate(endHeartTex,.4,.35,0,2.65,-126.5);
endHeart.material.fog=false;endHeart.visible=false;
await step();
// 양손으로 내미는 장미꽃다발.
const offeredFlowerTex=pixTex(32,44,c=>{
  // 무채색 포장과 잎, 붉은 꽃 두 색만 남긴다.
  for(let y=20;y<43;y++){
    const inset=Math.floor((y-20)/2),left=2+inset,right=30-inset;
    rect(c,ink,left,y,right-left,1);
    if(y<40)rect(c,paper,left+1,y,right-left-2,1);
  }
  pixelStamp(c,[
    '##..........................##','###........................###',
    '.###......................###.','..###....................###..',
    '...####................####...','.....###..............###.....'
  ],{'#':ink},1,14);
  // 9×9 장미: 계단 윤곽과 한 줄 말린 꽃잎으로 읽히게 한다.
  const rose=[
    '..rrrrr..','.rrrrrrrr','rrrdddrrr','rrdrrrdrr','rrdrdrrdr',
    'rrdrrrddr','rrrdddrrr','.rrrrrrr.','..rrrrr..'
  ];
  [[7,0],[17,2],[0,8],[11,9],[23,10],[5,17],[16,19]].forEach(([x,y])=>
    pixelStamp(c,rose,{r:'#d32945',d:'#8d1830'},x,y));
  rect(c,ink,16,29,1,7);rect(c,ink,17,34,1,4);
  rect(c,ink,11,37,10,2);rect(c,ink,9,36,3,3);rect(c,ink,20,36,3,3);
  rect(c,ink,13,39,2,4);rect(c,ink,18,39,2,4);
});
const offeredFlower=new THREE.Sprite(new THREE.SpriteMaterial({map:offeredFlowerTex,transparent:true,alphaTest:.5,depthTest:false,depthWrite:false}));
offeredFlower.center.set(.5,0);offeredFlower.renderOrder=100;offeredFlower.visible=false;selfScene.add(offeredFlower);
await step();
// 양쪽 짧은 공룡 팔은 아래에서 모여 포장지를 두 손가락으로 잡는다.
const offeredHands=new THREE.Group();selfScene.add(offeredHands);offeredHands.visible=false;
const handMaterials=['#666666','#404040','#777777','#393939','#535353','#454545'].map(color=>new THREE.MeshBasicMaterial({color,depthTest:false,depthWrite:false}));
function handBlock(parent,x,y,z,w,h,d,order=90){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),handMaterials);mesh.position.set(x,y,z);mesh.renderOrder=order;parent.add(mesh);return mesh;
}
for(const sign of [-1,1]){
  const hand=new THREE.Group();offeredHands.add(hand);
  const forearm=handBlock(hand,sign*.35,-.1,.12,.15,.6,.14);forearm.rotation.z=sign*.75;
  handBlock(hand,sign*.16,.15,.14,.2,.19,.18);
  handBlock(hand,sign*.075,.19,.25,.18,.06,.14,110);
  handBlock(hand,sign*.09,.105,.25,.16,.06,.14,110);
}
const flowerLocal=new THREE.Vector3();let flowerExit=0;

await step();
function birdTexture(down){return pixTex(48,32,c=>{
  poly(c,ink,[[0,17],[12,10],[15,10],[15,14],[31,14],[38,18],[48,18],[40,22],[27,24],[16,21],[10,17]]);
  if(down)poly(c,ink,[[22,17],[30,17],[34,25],[38,30],[24,27]]);
  else poly(c,ink,[[20,16],[21,7],[17,1],[23,3],[32,14]]);
  rect(c,paper,13,12,1,1);
});}
const birdFrames=[birdTexture(false),birdTexture(true)];
const birds=BIRDS.map((z,i)=>{
  const baseY=2.1+(i%2)*.15,spr=plate(birdFrames[0],2.8,1.86,0,baseY,z),bird={spr,z,baseY,flip:0};
  clickable(spr,()=>{if(bird.flip<=0){bird.flip=1;audio.sfx('spin','dino');fx.bonus+=1000;}});return bird;
});
await step();
// ---------- 길 옆 스테고: 네 발·엇갈린 등판·꼬리 가시 ----------
const stegoFrames=new Map();
function stegoTexture(head,foot,tail,walk){
  const key=[head,foot,tail,walk].join(':');if(stegoFrames.has(key))return stegoFrames.get(key);
  const map=pixTex(64,40,c=>{
    const lift=Math.round(foot/2),wag=Math.round(tail/2);
    // 넓은 오각형 등판: 깊은 골로 나누되 밑동은 몸통에 붙인다.
    const plateWidths=[2,4,6,8,10,10,8,6];
    [[16,26,7,6],[25,24,11,8],[36,23,14,10],[46,26,11,8],[53,29,6,5]].forEach(([x,base,h,w])=>{
      for(let y=0;y<h;y++){
        const width=Math.max(2,Math.round(plateWidths[Math.floor(y*8/h)]*w/10));
        rect(c,ink,x-Math.floor(width/2),base-h+y,width,1);
      }
    });
    // 작은 머리와 낮은 목, 둥근 몸통, 분리된 네 발.
    rect(c,ink,23,22,15,11);rect(c,ink,18,24,24,9);
    rect(c,ink,15,26,30,5);rect(c,ink,19,32,22,2);
    rect(c,ink,23,31,3,7-walk);rect(c,ink,22,37-walk,4,2);
    rect(c,ink,41,29,3,8+walk);rect(c,ink,40,36+walk,5,2);
    rect(c,ink,17,30,4,9-lift);rect(c,ink,15,38-lift,6,2);
    rect(c,ink,35,31,4,8-walk);rect(c,ink,34,38-walk,6,2);
    rect(c,ink,11,27,6,4);rect(c,ink,6,29,8,3);
    if(head===0){
      rect(c,ink,1,28,7,5);rect(c,ink,0,29,2,3);
      rect(c,paper,5,29,1,1);rect(c,paper,0,32,4,1);
    }else{
      const dx=head===1?-1:0;rect(c,ink,3+dx,27,6,6);rect(c,ink,2+dx,29,8,3);
      rect(c,paper,4+dx,28,1,1);rect(c,paper,8+dx,28,1,1);rect(c,paper,5+dx,32,3,1);
    }
    // 긴 꼬리 끝의 위·아래 가시 두 쌍.
    rect(c,ink,43,27,6,5);rect(c,ink,48,28+Math.round(wag/2),6,3);
    rect(c,ink,53,28+wag,6,2);rect(c,ink,58,27+wag,6,2);
    [[55,28+wag],[60,27+wag]].forEach(([x,y])=>{
      rect(c,ink,x,y-3,2,4);rect(c,ink,x-1,y-5,1,3);
      rect(c,ink,x+1,y+1,2,3);rect(c,ink,x+3,y+3,1,2);
    });
  });stegoFrames.set(key,map);return map;
}
const stego={x:5.8,z:-65,w:4.37,flip:0};
stego.spr=plate(stegoTexture(0,0,0,0),stego.w,stego.w*40/64,stego.x,0,stego.z);
clickable(stego.spr,()=>{if(stego.flip<=0){stego.flip=1;audio.sfx('click','dino');fx.bonus+=1000;}});
await step();
// ---------- 검토 화면과 같은 전신·눈높이. 머리 안쪽은 카메라에서 숨긴다. ----------
// 원작 옆 실루엣: Chromium Authors, BSD-style. 깊이와 양팔 배치는 이 시안의 해석이다.
const PROFILES=DINO_ROWS;
const playerBody=new THREE.Group();selfScene.add(playerBody);
const cube=new THREE.BoxGeometry(1,1,1);
function depthAt(x,y,duck){
  if(duck){if(x>=37)return 8;if(x<=9)return 2;if(y>=36)return 4;return 10;}
  if(x>=20&&y<=18)return 8;if(x<10)return Math.max(2,x*.6);if(y>=37)return 4;return 10;
}
async function buildModel(rows,duck=false){
  const model=new THREE.Group(),parts={head:[],body:[],arms:[]};
  rows.forEach((row,y)=>[...row].forEach((p,x)=>{
    if(p!== '#')return;
    const wy=(44-y)*DINO_UNIT,wz=(22-x)*DINO_UNIT,depth=depthAt(x,y,duck)*DINO_UNIT;
    const head=duck?x>=36&&y<=34:x>=17&&y<=20;
    const arm=duck?x>=31&&x<=34&&y>=36&&y<=39:x>=30&&y>=21&&y<=24;
    if(arm){for(const sign of [-1,1])parts.arms.push([sign*6.1*DINO_UNIT,wy,wz,2*DINO_UNIT,DINO_UNIT,DINO_UNIT]);}
    else{
      // 양쪽 다리의 깊이를 나누고 옆 실루엣은 참고 프레임을 유지한다.
      const leg=y>=(duck?36:37),sign=x<(duck?26:19)?1:-1;
      const wx=leg?sign*3.7*DINO_UNIT:0;
      parts[head?'head':'body'].push([wx,wy,wz,depth,DINO_UNIT,DINO_UNIT]);
    }
  }));
  // 서로 맞닿은 내부 면을 없애 사선에서도 도트 면이 깜빡이지 않게 한다.
  const normals=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const colors=['#535353','#535353','#747474','#454545','#5d5d5d','#505050'].map(c=>new THREE.Color(c));
  for(const [name,blocks] of Object.entries(parts)){
    await step();
    const occupied=new Set();
    blocks.forEach(([x,y,z,w])=>{
      const count=Math.max(1,Math.round(w/DINO_UNIT));
      const center=Math.round(x/DINO_UNIT),lo=center-(count-1)/2,hi=lo+count;
      for(let vx=lo;vx<hi;vx++)occupied.add([vx,Math.round(y/DINO_UNIT),Math.round(z/DINO_UNIT)].join(','));
    });
    const positions=[],shades=[];
    for(const key of occupied){
      const xyz=key.split(',').map(Number);
      normals.forEach((n,face)=>{
        if(occupied.has(xyz.map((v,i)=>v+n[i]).join(',')))return;
        const axis=n.findIndex(v=>v!==0),u=(axis+1)%3,v=(axis+2)%3;
        const points=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([a,b])=>{
          const point=[...xyz];point[axis]+=n[axis]*.5;point[u]+=a;point[v]+=b;return point;
        });
        const order=n[axis]>0?[0,1,2,0,2,3]:[0,2,1,0,3,2];
        order.forEach(i=>{positions.push(...points[i].map(p=>p*DINO_UNIT));shades.push(colors[face].r,colors[face].g,colors[face].b);});
      });
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(shades,3));
    const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true}));
    mesh.renderOrder=15;
    mesh.name=name;if(name==='head')mesh.layers.set(2);model.add(mesh);
  }
  // 옆면의 작은 눈은 1인칭 카메라에서 숨기는 머리에 속한다.
  const ex=duck?41.5:26.5,ey=duck?23.5:5.5;
  for(const sign of [-1,1]){
    const eye=new THREE.Mesh(cube,new THREE.MeshBasicMaterial({color:paper}));
    eye.scale.set(.012,DINO_UNIT*1.5,DINO_UNIT*1.5);eye.position.set(sign*DINO_UNIT*4.03,(44-ey)*DINO_UNIT,(22-ex)*DINO_UNIT);eye.layers.set(2);model.add(eye);
  }
  model.userData.eye=new THREE.Vector3(0,(44-ey)*DINO_UNIT,(22-ex)*DINO_UNIT);
  // 머리와 눈 표식을 같이 움직여 숙이기 중간 자세에서도 눈높이가 일치한다.
  const headRig=new THREE.Group();headRig.name='head-pose';
  [...model.children].filter(obj=>obj.layers.mask===4).forEach(obj=>headRig.add(obj));model.add(headRig);
  const eyeAnchor=new THREE.Object3D();eyeAnchor.position.copy(model.userData.eye);headRig.add(eyeAnchor);
  Object.assign(model.userData,{headRig,eyeAnchor,eyeRest:model.userData.eye.clone()});
  model.visible=false;playerBody.add(model);return model;
}
const playerModels={idle:await buildModel(PROFILES.idle),run0:await buildModel(PROFILES.run0),run1:await buildModel(PROFILES.run1),duck0:await buildModel(PROFILES.duck0,true),duck1:await buildModel(PROFILES.duck1,true)};

let playerPose='idle';
function setPlayerPose(pose){
  if(pose===playerPose&&playerModels[pose].visible)return;
  Object.entries(playerModels).forEach(([key,model])=>model.visible=key===pose);playerPose=pose;
}
await step();
// 상시 먼지: 가까운 좌우에 넓게 놓아 첫 프레임부터 보인다.
const dustCount=64,dustPos=new Float32Array(dustCount*3);
for(let i=0;i<dustCount;i++)dustPos.set([(hash(i*7)-.5)*30,hash(i*11)*7,-2-hash(i*17)*28],i*3);
const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));
const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:'#a0a0a0',size:.04,transparent:true,opacity:.55,depthWrite:false}));dust.frustumCulled=false;scene.add(dust);
function resize(){
  fitStage({ renderer, composer, post, camera, pixel: PIXEL, portraitFov: 73 });
}
addEventListener('resize',resize);resize();

await step();
// ---------- 엔딩: GAME CLEAR 뒤 공통 이세계 전송, 게임 중에는 정보 없음 ----------
const clearEl=document.getElementById('clear'),clearScore=document.getElementById('clearScore');let portalTimer,revealTimer;
const toPortal=()=>enterPortal({renderer,composer,post,reduced:()=>reduce});
const ptr={x:0,y:0,tx:0,ty:0};
addEventListener('pointermove',e=>{
  if(e.pointerType==='touch')return;
  ptr.tx=clamp(e.clientX/innerWidth)-.5;ptr.ty=clamp(e.clientY/innerHeight)-.5;
});
const centerLook=()=>{ptr.tx=0;ptr.ty=0;};
addEventListener('pointerout',e=>{if(!e.relatedTarget)centerLook();});
addEventListener('blur',centerLook);
const ride=document.querySelector('.ride'),scoreEl=document.getElementById('score'),distanceEl=document.getElementById('distance'),flagsEl=document.getElementById('flags');
const clock=new THREE.Timer();let t=0,sp=0,shown=null,speed=0,prevZ=START,bobAmp=0,wipeT=1;
const p0=Number.isFinite(initialProgress)?clamp(initialProgress):0;
if(started){
  if (!(import.meta.env.DEV && qa)) scrollTo(0, p0 * (ride.offsetHeight - innerHeight)); sp=p0;
  const initialZ=stageState(p0).z;
  lookS.set(pathX(initialZ-22),bodyState(p0,false,reduce).eyeY,initialZ-22);
}
await prewarm({ renderer, composer, camera, scenes: [scene, selfScene], step });   // 텍스처·셰이더를 첫 프레임 전에 나눠서
const rideSfx = audio.ride('dino', CACTI.map(z => z + 4), CAKES, BIRDS.map(z => ['duck', z + 3.5]));
let heartHeard = false, droopHeard = false;
activateStage();
const LOOP = () => {
  clock.update();const dt=Math.min(clock.getDelta(),.1);t+=dt;
  const target = (import.meta.env.DEV ? qa?.progress(p0) : undefined) ?? clamp(scrollY / Math.max(1, ride.offsetHeight - innerHeight));
  sp+=((started&&ready.hidden?target:0)-sp)*(reduce?1:1-Math.exp(-dt*3));
  const state=stageState(sp);let z=state.z;
  const rideForward=started&&ready.hidden&&rideSfx(z,trackZ(target));
  if(!started)z=START-(reduce?0:(t*.9)%11);
  const moving=Math.abs(z-prevZ)>.0001;
  speed+=(Math.abs(z-prevZ)/Math.max(dt,.001)-speed)*(1-Math.exp(-dt*6));prevZ=z;
  bobAmp+=((reduce?0:clamp(speed/8))*(1-state.finish)-bobAmp)*(1-Math.exp(-dt*5));
  const gait=z*2,bob=Math.sin(gait)*.025*bobAmp,rigState=bodyState(sp,moving,reduce);
  const ending=document.body.classList.contains('portal-mode');
  // 작은 마우스 시선은 모션 감소에서도 부드럽게 따라간다.
  const pointerEase=1-Math.exp(-dt*5);
  ptr.x+=(ptr.tx-ptr.x)*pointerEase;ptr.y+=(ptr.ty-ptr.y)*pointerEase;
  const swayX=ptr.x*1.6,swayY=ptr.y*.9;
  playerBody.visible=started&&ready.hidden&&!ending&&rigState.visible;
  if(!started){
    // 타이틀도 실제 주행과 같은 눈높이·진행 방향으로 보여 준다.
    camera.layers.disable(2);camera.position.set(pathX(z),rigState.eyeY,z);
    lookS.set(pathX(z-22)+swayX,rigState.eyeY-swayY,z-22);camera.lookAt(lookS);
  }else{
    setPlayerPose(rigState.pose);playerBody.rotation.y=0;
    playerBody.position.set(pathX(z),rigState.bodyY+bob,rigState.bodyZ);
    const active=playerModels[playerPose],restEye=active.userData.eyeRest;
    active.userData.headRig.position.set(0,rigState.eyeLocalY-restEye.y,rigState.eyeLocalZ-restEye.z);
    active.userData.eye.copy(restEye).add(active.userData.headRig.position);
    camera.layers.disable(2);active.userData.eyeAnchor.getWorldPosition(camera.position);
    camera.position.y+=state.finish*3.2;
    look.set(pathX(z-22)+swayX,rigState.eyeY+bob-swayY,rigState.eyeZ-22);
    if(reduce)lookS.copy(look);else lookS.lerp(look,1-Math.exp(-dt*10));
    camera.lookAt(lookS);camera.rotateZ(Math.sin(gait)*.006*bobAmp);
  }
  const sky=skyState(sp);
  clouds.forEach(o=>o.position.z=z-140);
  sun.position.set(sky.sunX,sky.sunY,z-140);
  moon.position.set(sky.moonX,sky.moonY,z-140);moon.material.opacity=sky.night;
  stars.forEach(o=>{o.position.z=z-140;o.material.opacity=sky.night;});
  document.body.dataset.night=String(state.night>.5);
  cakes.forEach((o,i)=>{o.visible=z>CAKES[i];o.position.y=.24+(reduce?0:Math.sin(t*2+i)*.05);});
  tumbleweeds.forEach((o,i)=>{
    const at=tumbleweedState(sp,i),angle=at.rotation+i*1.7,cs=Math.cos(angle),sn=Math.sin(angle);
    const floor=-Math.min(...o.userData.support.map(([x,y])=>x*sn+y*cs));
    o.position.set(at.x,floor-.025,at.z);o.material.rotation=angle;
    o.userData.shadow.position.set(at.x,-.018,at.z);
  });
  const story=storyState(sp),girl=runners[0],romance=started&&story.chapter==='reveal';
  if(story.contact>.7&&!heartHeard){heartHeard=true;if(rideForward)audio.sfx('heart','dino');}
  if(story.droop>0&&!droopHeard){droopHeard=true;if(rideForward)audio.sfx('droop','dino');}
  runners.forEach(r=>{
    r.flip=Math.max(0,r.flip-dt/1.05);const reaction=trexClickState(r.flip>0?1-r.flip:0);
    r.spr.visible=!started||story.chapter==='together'||romance;
    r.spr.userData.clickEnabled=started&&story.chapter==='together';
    r.spr.position.set(r.x,reaction.y,r.z);r.spr.material.rotation=reaction.tilt;
    r.spr.material.map=reaction.pose==='jump'?dinoJumpTex:girlfriendFrames[Math.floor(t*7)%2];
    r.spr.scale.set(r.w*reaction.scaleX,r.h*reaction.scaleY,1);
  });
  rival.visible=romance&&!ending;
  endHeart.visible=romance&&story.contact>.7&&!ending&&!clearEl.classList.contains('on');
  if(romance){
    girl.spr.visible=!ending;girl.spr.material.map=endingGirlfriendTex;girl.spr.scale.set(2,7/3,1);
    girl.spr.position.set(story.girlX,0,story.z);girl.spr.material.rotation=-story.contact*.04;
    rival.position.set(story.rivalX,0,story.z);rival.material.rotation=story.contact*.04;
    endHeart.position.set(0,2.65+(reduce?0:Math.sin(t*2)*.035),story.z);
  }
  flowerExit=clearEl.classList.contains('on')?Math.min(1,flowerExit+dt*2.8):0;
  offeredFlower.visible=romance&&story.offer>0&&!ending&&flowerExit<1;
  offeredHands.visible=offeredFlower.visible;
  if(offeredFlower.visible){
    const reach=story.offer*(1-ease(flowerExit)),distance=1.45-.18*reach;
    const halfH=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*distance;
    flowerLocal.set(0,halfH*(-1.6+.62*reach-.14*story.droop),-distance);
    offeredFlower.position.copy(camera.localToWorld(flowerLocal));offeredFlower.scale.set(halfH*.54,halfH*.72,1);
    offeredFlower.material.rotation=0;
    offeredHands.position.copy(offeredFlower.position);offeredHands.quaternion.copy(camera.quaternion);offeredHands.scale.setScalar(halfH);
  }
  birds.forEach((b,i)=>{
    b.flip=Math.max(0,b.flip-dt/1.35);const active=b.flip>0,reaction=birdClickState(active?1-b.flip:0),sign=i%2?-1:1;
    b.spr.position.set(reaction.x*sign,b.baseY+(reduce?0:Math.sin(t*3+i)*.08)+reaction.y,b.z+reaction.z);
    b.spr.material.map=birdFrames[active?reaction.flap:Math.floor(t*5+i)%2];b.spr.material.rotation=reaction.bank*sign;
  });
  const stegoBefore=stego.flip;
  stego.flip=Math.max(0,stego.flip-dt/1.7);
  if(stegoBefore>.5&&stego.flip<=.5)audio.sfx('stomp','dino');
  const stegoActive=stego.flip>0,stegoPose=stegoClickState(stegoActive?1-stego.flip:0);
  const stroll=reduce||stegoActive?0:Math.sin(t*.4)*.4,walk=reduce||stegoActive?0:Math.floor(t*1.8)%2;
  stego.spr.position.set(stego.x,0,stego.z+stroll);stego.spr.scale.set(stego.w,stego.w*40/64*(1-stegoPose.stomp*.08),1);
  stego.spr.material.rotation=stegoPose.stomp*.025;
  stego.spr.material.map=stegoTexture(Math.round(stegoPose.head*2),Math.round(stegoPose.foot*6),Math.round(stegoPose.tail*7),walk);
  updateInteraction(dt);
  dust.position.set(camera.position.x,0,z);
  for(let i=0;i<dustCount;i++){
    const j=i*3;dustPos[j]+=dt*(.1+hash(i+9)*.13);dustPos[j+1]-=dt*(.08+hash(i+51)*.14);
    if(dustPos[j+1]<-.3)dustPos[j+1]+=7.3;if(dustPos[j]>15)dustPos[j]-=30;
  }
  dustGeo.attributes.position.needsUpdate=true;
  scoreEl.textContent=String(Math.max(0,Math.floor((START-z)*10)*10)+state.collected*5000+fx.bonus).padStart(6,'0');
  if(clearEl.classList.contains('on'))clearScore.textContent=scoreEl.textContent;
  distanceEl.textContent=String(Math.round((1-state.progress)*124)).padStart(3,'0');flagsEl.textContent=state.collected;
  document.getElementById('speedbar').style.opacity=.35+clamp(speed/8)*.65;
  const cleared=started&&state.cleared;
  if(cleared!==shown){
    clearTimeout(portalTimer);clearTimeout(revealTimer);clearEl.classList.remove('on');clearEl.setAttribute('aria-hidden','true');
    if(cleared){
      // 반전 장면을 먼저 보여 준 뒤 클리어·전송 순서를 잇는다.
      wipeT=0;
      revealTimer=setTimeout(()=>{
        clearScore.textContent=scoreEl.textContent;clearEl.classList.add('on');clearEl.setAttribute('aria-hidden','false');
        portalTimer=setTimeout(toPortal,1500);
      },2800);
    }
    shown=cleared;
  }
  const u=post.uniforms;wipeT+=dt;u.time.value=t;u.wipe.value=reduce||wipeT>=.5?0:Math.sin(Math.PI*wipeT/.5)*.7;u.motion.value=reduce?0:1;u.night.value=state.night;
  updateHUD();
  composer.render();
};
// 검수 훅이 있으면 프레임을 직접 돌린다 (eval 은 이 함수 안의 변수를 쓰기 위함, 개발 서버 전용)
if (import.meta.env.DEV && qa) qa.attach({ LOOP, run: code => eval(code), renderer, composer }); else renderer.setAnimationLoop(LOOP);
reveal(renderer.domElement, reduce || (import.meta.env.DEV && !!qa));
}
