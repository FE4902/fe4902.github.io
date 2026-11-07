import { audio } from './audio/index.js';
import * as THREE from 'three';
import { onClear } from './flow.js';
import { arrivalSpace } from './arrival.js';

// ---------- 이세계 전송: GAME CLEAR 뒤 시스템 창 → 화면 속 통로 → 도착(상태창) ----------
// 세 테마 공통. 마지막 게임 화면을 한 장 굳혀 통로의 재질로 쓴다 (시안: portal-preview.js).
const SYSTEM_COPY = {
  ask: { status: '알림', log: ['게임을 클리어하셨습니다.'], title: '히든 스테이지에<br>입장하시겠습니까?' },
  idle: { status: '경고', log: ['응답 시간이 초과되었습니다.', '무응답은 수락으로 처리됩니다.'], title: '히든 스테이지에 입장합니다.' },
  forced: { status: '경고', log: ['거절할 수 없는 퀘스트입니다.', '강제 전송을 시작합니다.'], title: '플레이어의 의사는<br>반영되지 않습니다.' },
};
const PORTAL_IDLE = 20000, PORTAL_DURATION = 2.2;   // 무응답 강제 전송(ms) · 통로 길이(초, 움직임 줄이기는 0.7초 페이드)
const PORTAL_SHADER = `
  uniform sampler2D frame;uniform float amount,aspect,noise,glitch,glitchTime,reduced;uniform vec2 resolution;varying vec2 vUv;
  float random(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  vec3 sampleScene(vec2 p){return texture2D(frame,clamp(p,vec2(.001),vec2(.999))).rgb;}
  // 출발·도착에서 속도와 가속도가 0인 곡선.
  float ease(float a,float b,float t){float x=clamp((t-a)/(b-a),0.,1.);return x*x*x*(x*(x*6.-15.)+10.);}
  float radius(vec2 p){p=abs(p);return max(max(p.x,p.y),(p.x+p.y)*.707107);}
  // 게임 화면과 각진 통로가 하나의 표면을 공유한다.
  float funnelRadius(float z,float depth,float throat){
    float widening=max(depth/max(-z,.0001)-1.,0.);
    return throat+.04*widening*widening;
  }
  vec3 surfaceColor(vec3 hit,float depth,float t){
    vec2 imageUV=.5+hit.xy/(5.*vec2(aspect,1.));
    vec3 image=sampleScene(imageUV);
    float bend=clamp(-hit.z/max(depth,.001),0.,1.);
    // 화면 자체가 먼저 접혀 들어가고, 통과할 때만 도트 통로로 이어진다.
    float digitize=ease(.10,.6,bend)*ease(.24,.48,t);
    // 통로 안쪽은 웜홀처럼 소용돌이치고, 칸 열마다 다른 속도로 데이터가 흐른다.
    float stream=ease(.3,.56,t);
    float angle=fract(atan(hit.y,hit.x)/6.2831853+.5+stream*(hit.z*.01-t*.45));
    float column=random(vec2(floor(angle*48.),3.));
    vec2 wall=vec2(angle*48.,hit.z*1.6+stream*t*(30.+column*46.));
    vec2 tile=floor(wall),local=fract(wall);
    vec2 edge=min(local,1.-local);
    float seam=1.-smoothstep(.025,.075,min(edge.x,edge.y));
    // 새 색을 만들지 않고 원래 장면의 도트를 벽면에 이어 쓴다.
    float theta=(tile.x+.5)/48.*6.2831853-3.1415927;
    vec2 sourceUV=.5+vec2(cos(theta),sin(theta))*vec2(.40,.28)*(.86+.14*cos((tile.y+.5)/24.*6.2831853));
    vec3 mosaic=floor(sampleScene(sourceUV)*15.+.5)/15.;
    mosaic*=.86-seam*.08;
    // 게임 타일이 한 칸씩 오로라빛 데이터 칸으로 바뀐다.
    vec3 aurora=vec3(.1,.55,.62)+vec3(.12,.42,.36)*cos(6.2831853*(angle*2.+hit.z*.03+t)+vec3(2.2,0.,1.));
    float bit=step(.52,random(tile));
    float spark=step(.94,random(tile+vec2(7.,13.)));
    vec3 data=vec3(.01,.04,.09)+aurora*(.1+bit*.8)+vec3(.6,.75,.7)*spark;
    data=floor(data*(1.-seam*.6)*15.+.5)/15.;
    mosaic=mix(mosaic,data,step(random(tile+vec2(31.,5.)),ease(.34,.62,t)));
    float shade=1.-bend*.12;
    return mix(image,mosaic,digitize)*shade;
  }
  vec3 travelThroughScreen(vec2 point,float t){
    // 중심을 먼저 깊게 당긴 뒤 카메라가 뒤따라 빨려 들어간다.
    float depth=18.*ease(0.,.30,t);
    float throat=.002+ease(.06,.66,t)*.85;
    // 중심이 꺼지는 만큼 카메라도 따라가 화면 가장자리가 물러나지 않게 하고, 클릭 직후 먼저 당겨진다.
    float cameraZ=4.-depth*.1-1.6*ease(0.,.22,t)-34.4*ease(.14,.94,t);
    vec3 ray=normalize(vec3(point,-1.6));
    float nearDistance=max(0.,(cameraZ+.0001)/(-ray.z));
    float farDistance=nearDistance+160.;
    vec3 farHit=vec3(0.,0.,cameraZ)+ray*farDistance;
    // 중심은 빛나는 출구를 보고, 나머지 광선은 벽면에 닿는다.
    if(radius(farHit.xy)<funnelRadius(farHit.z,depth,throat)){
      return mix(sampleScene(vec2(.5)),vec3(.72,1.,.94),ease(.2,.5,t));
    }
    // 연속된 곡면과의 교차점을 구한다.
    float lo=nearDistance,hi=farDistance;
    for(int i=0;i<22;i++){
      float distance=(lo+hi)*.5;
      vec3 hit=vec3(0.,0.,cameraZ)+ray*distance;
      if(radius(hit.xy)>funnelRadius(hit.z,depth,throat))hi=distance;
      else lo=distance;
    }
    vec3 hit=vec3(0.,0.,cameraZ)+ray*((lo+hi)*.5);
    return surfaceColor(hit,depth,t);
  }
  void main(){
    float t=amount;
    vec2 point=(vUv-.5)*vec2(aspect,1.)*2.;
    vec3 color=(t<.0001||reduced>.5)?sampleScene(vUv):travelThroughScreen(point,t);
    float beat=floor(glitchTime*12.);
    // 팝업 뒤 게임 화면만 짧게 어긋난다. 움직임 줄이기는 정적인 색 분리만 남긴다.
    if(glitch>0.){
      float band=floor(vUv.y*32.);
      float burst=step(.82,random(vec2(beat,17.)));
      float tear=step(.78,random(vec2(band,beat)))*burst*(1.-reduced);
      vec2 uv=vUv+vec2((random(vec2(band,beat+9.))-.5)*8.*glitch*tear/resolution.x,0.);
      float split=(reduced>.5?1.:(1.+2.*burst)*glitch)/resolution.x;
      vec3 broken=vec3(sampleScene(uv+vec2(split,0.)).r,sampleScene(uv).g,sampleScene(uv-vec2(split,0.)).b);
      color=mix(color,broken,reduced>.5?.35*glitch:1.);
    }
    float snow=random(floor(vUv*resolution)+vec2(beat*19.,beat*7.));
    color=mix(color,vec3(snow*.7),noise*.34);
    color*=1.-noise*step(.985,snow)*.7;
    // 출구의 빛이 각진 문처럼 번져 화면을 채운 뒤 다음 장면의 어둠으로 이어진다.
    if(reduced<.5){
      color+=vec3(.3,.8,.72)*exp(-dot(point,point)*14.)*ease(.4,.7,t);
      color=mix(color,vec3(.72,1.,.94),step(radius(point),ease(.72,.92,t)*3.));
    }
    float exit=reduced>.5?ease(0.,1.,t):ease(.92,1.,t);
    color=mix(color,vec3(.025,.027,.035),exit);
    gl_FragColor=vec4(color,1.);
  }`;
// 노이즈 0.7초 → 시스템 창(수락 / 거절·20초 무응답은 붉은 경고 3초 뒤 강제) → 통로 → 도착 화면
export function enterPortal({ renderer, composer, post, reduced }) {
  if (document.body.classList.contains('portal-mode')) return;
  onClear();
  // 디더 전환·HUD 없이 마지막 화면을 굳힌다 (검은 점이 통로에 남지 않게).
  const empty = new THREE.DataTexture(new Uint8Array(4), 1, 1); empty.needsUpdate = true;
  post.uniforms.hudMap.value = empty; post.uniforms.wipe.value = 0; composer.render();
  const still = document.createElement('canvas');
  still.width = renderer.domElement.width; still.height = renderer.domElement.height;
  still.getContext('2d').drawImage(renderer.domElement, 0, 0);
  const frame = new THREE.CanvasTexture(still);
  frame.magFilter = frame.minFilter = THREE.NearestFilter; frame.generateMipmaps = false;
  const material = new THREE.ShaderMaterial({
    uniforms: { frame: { value: frame }, amount: { value: 0 }, noise: { value: 1 }, glitch: { value: .8 }, glitchTime: { value: 0 }, reduced: { value: 0 },
                aspect: { value: innerWidth / innerHeight }, resolution: { value: new THREE.Vector2(still.width, still.height) } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: PORTAL_SHADER,
  });
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), u = material.uniforms;
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  document.body.classList.add('portal-mode');
  document.getElementById('clear').classList.remove('on');

  const system = document.getElementById('system'), choices = system.querySelector('.system-choices');
  let logCount = 0;
  const setCopy = ({ status, log, title }) => {
    logCount = log.length;
    system.querySelector('.system-label b').textContent = status;
    system.querySelector('.system-log').innerHTML = log.map((line, i) => `<li class="system-line" style="--i:${i}">${line}</li>`).join('');
    document.getElementById('system-question').innerHTML = title;
  };
  setCopy(SYSTEM_COPY.ask);
  let phase, phaseAt, lineCursor = 0;
  const go = next => {
    const forced = phase === 'refusal';
    phase = next; phaseAt = performance.now(); lineCursor = 0; document.body.dataset.portal = next;
    audio.portal(next, reduced(), forced);
  };
  go('noise');
  // 거절하거나 오래 응답이 없으면 안내를 읽을 시간을 준 뒤 강제로 보낸다.
  const force = reason => {
    go('refusal'); system.dataset.status = 'forced'; setCopy(reason === 'idle' ? SYSTEM_COPY.idle : SYSTEM_COPY.forced);
    choices.hidden = true; system.tabIndex = -1; system.focus({ preventScroll: true });
  };
  const transfer = () => { go('playing'); if (system.open) system.close(); };
  const choose = choice => { if (phase === 'choice') choice === 'no' ? force('no') : transfer(); };
  system.querySelectorAll('[data-choice]').forEach(b => b.addEventListener('click', () => choose(b.dataset.choice)));
  system.addEventListener('cancel', e => { e.preventDefault(); choose('no'); });   // Esc = 거절
  // 클릭 없이 스크롤만 했으면 브라우저가 Esc 취소를 막지 못하고 창을 닫는다 → 다시 띄워 거절로 처리
  system.addEventListener('close', () => {
    if (phase !== 'choice' && phase !== 'refusal') return;
    system.showModal(); choose('no');
  });

  const resize = () => {
    const px = innerWidth < 600 ? 2 : 3, w = Math.round(innerWidth / px), h = Math.round(innerHeight / px);
    renderer.setSize(w, h, false); u.aspect.value = innerWidth / innerHeight; u.resolution.value.set(w, h);
  };
  addEventListener('resize', resize); resize();
  const draw = () => { renderer.setRenderTarget(null); renderer.render(scene, camera); };
  // tools/shot.py 가 테마 루프만 계측하도록 루프 머리 형태를 다르게 둔다
  const tick = () => {
    const now = performance.now(), elapsed = now - phaseAt, calm = reduced();
    // 지나간 로그는 몰아서 울리지 않는다. 감소 모션에서는 창과 함께 한 번만.
    if ((phase === 'choice' || phase === 'refusal') && !calm) {
      const visible = Math.min(logCount, Math.max(0, Math.floor((elapsed - 340) / 220) + 1));
      if (visible > lineCursor) {
        lineCursor = visible;
        if (elapsed - (340 + (visible - 1) * 220) < 150) audio.sfx('log', 'arrival');
      }
    }
    u.glitchTime.value = calm ? 0 : now / 1000; u.reduced.value = calm ? 1 : 0;
    if (phase === 'noise') {
      const k = Math.min(1, elapsed / 700);
      u.noise.value = 1 - k * .35;
      u.glitch.value = .8;
      if (k === 1) { go('choice'); system.showModal(); }
    } else if (phase === 'choice') {
      u.noise.value = .55;   // 팝업 뒤에도 도트 잡음을 선명하게 유지
      u.glitch.value = calm ? .65 : .22 + .45 * Math.exp(-elapsed / 250);
      if (elapsed >= PORTAL_IDLE) force('idle');
    } else if (phase === 'refusal') {
      u.noise.value = .65;
      u.glitch.value = .35;
      if (elapsed >= 3000) transfer();
    } else if (phase === 'playing') {
      const k = Math.min(1, elapsed / ((calm ? .7 : PORTAL_DURATION) * 1000));
      u.amount.value = k; u.noise.value = .18 * (1 - k);
      u.glitch.value = 0;
      if (k === 1) {
        go('ended'); removeEventListener('resize', resize);   // 통로의 마지막 어둠에서 디지털 공간이 이어진다
        arrivalSpace({ renderer, reduced });
        document.getElementById('ending').classList.add('on');
        document.querySelector('.orb').focus({ preventScroll: true });
        return;
      }
    }
    draw();
  };
  renderer.setAnimationLoop(tick);
  return tick;   // 검수 도구가 시계를 고정하고 한 프레임씩 돌릴 수 있게
}
