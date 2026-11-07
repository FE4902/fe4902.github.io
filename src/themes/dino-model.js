import { clamp, ease } from '../core/math.js';

// ---------- 크롬 공룡 주행 계산: 진행률 하나로 위치·자세·하늘·연출을 정한다 (DOM 없이 node 로 검사) ----------
export const START = 6, STOP = -118;
export const CAKES = [-28, -59, -91], CACTI = [-16, -46, -78, -108], BIRDS = [-38, -68, -98], TUMBLEWEEDS=[-24,-56,-88];
export const trackZ = p => START + (STOP - START) * clamp((p - .03) / .9);
export function stageState(value) {
  const p = clamp(Number.isFinite(value) ? value : 0), progress = clamp((p - .03) / .9);
  const z = trackZ(p);
  const arc = (locations, width) => locations.reduce((height, at) => Math.max(height, Math.abs(z-at)<width ? Math.cos((z-at)/width*Math.PI/2) : 0), 0);
  const night = skyState(p).night;
  return { z, progress, jump: arc(CACTI,4), duck:arc(BIRDS,3.5), collected: CAKES.filter(at => z<=at).length,
    night, finish: ease(clamp((p-.9)/.05)), cleared: p>.95 };
}
export const DINO_UNIT=.055;
export const STANDING_EYE={y:38.5*DINO_UNIT,z:-4.5*DINO_UNIT},DUCK_EYE={y:20.5*DINO_UNIT,z:-19.5*DINO_UNIT};
export function bodyState(value,moving=false,reduced=false){
  const s=stageState(value),frame=Math.floor((START-s.z)*2)%2;
  const pose=s.duck>.3?'duck'+frame:s.jump>.01?'idle':moving?'run'+frame:'idle';
  const lift=s.jump*(reduced?.38:1.8),duck=s.duck*(reduced?.35:1);
  const eyeLocalY=STANDING_EYE.y+(DUCK_EYE.y-STANDING_EYE.y)*duck;
  const eyeLocalZ=STANDING_EYE.z+(DUCK_EYE.z-STANDING_EYE.z)*duck;
  return {pose,eyeLocalY,eyeLocalZ,eyeY:eyeLocalY+lift,eyeZ:s.z+eyeLocalZ-STANDING_EYE.z,
    bodyY:lift-s.finish*3.2,bodyZ:s.z-STANDING_EYE.z,visible:s.finish<1};
}
// 해·달도 시간 대신 같은 진행률을 사용해 정지·역스크롤에 맞춘다.
export function skyState(value){
  const p=clamp(Number.isFinite(value)?value:0),sun=ease(clamp(p/.55)),moon=ease(clamp((p-.4)/.5));
  return {sunX:-26+18*sun,sunY:26-34*sun,moonX:24-14*moon,moonY:-8+34*moon,night:ease(clamp((p-.36)/.3))};
}
export function cactusLayout(index){
  const z=CACTI[index];if(z===undefined)return[];
  const small=index%2===1,count=small?2:1;
  return Array.from({length:count},(_,i)=>({x:0,z:z-i*1.15,small,w:small?1.2:1.45,h:small?1.8:2.25}));
}
export function tumbleweedState(value,index){
  const z=TUMBLEWEEDS[index],playerZ=stageState(value).z,u=ease(clamp((z+12-playerZ)/24)),sign=index%2?-1:1;
  const x=sign*(4.8+1.6*u);return{x,z,y:.6,rotation:-x/.6};
}
export function storyState(value){
  // 꽃 내밀기 → 커플이 다가가 하트 → 꽃다발이 처짐 순서로 구간을 나눈다.
  const p=clamp(Number.isFinite(value)?value:0),contact=ease(clamp((p-.875)/.035));
  return{chapter:p<.22?'together':p>=.82?'reveal':'away',contact,offer:ease(clamp((p-.83)/.04)),droop:ease(clamp((p-.905)/.035)),girlX:-1.08+contact*.13,rivalX:1.08-contact*.13,z:-126.5};
}
// 클릭 반응의 준비·동작·복귀를 같은 진행값으로 계산한다.
export function trexClickState(value){
  const p=clamp(value);let y=0,squash=0,stretch=0,tilt=0,pose='idle';
  if(p>0&&p<.16)squash=.18*ease(p/.16);
  else if(p>=.16&&p<.7){const u=(p-.16)/.54;y=.95*Math.sin(u*Math.PI);stretch=Math.sin(u*Math.PI);tilt=-.06*stretch;pose='jump';}
  else if(p>=.7&&p<.86)squash=.18*Math.sin((p-.7)/.16*Math.PI);
  else if(p>=.86&&p<1)squash=-.04*Math.sin((p-.86)/.14*Math.PI);
  return{y,scaleX:1+squash*.6-stretch*.06,scaleY:1-squash+stretch*.1,tilt,pose};
}
export function birdClickState(value){
  const p=clamp(value);if(p===0||p===1)return{x:0,y:0,z:0,bank:0,flap:0};
  if(p<.32)return{x:0,y:2.4*ease(clamp((p-.06)/.26)),z:0,bank:-.06,flap:Math.floor(p/.08)%2};
  const u=(p-.32)/.68,curve=Math.sin(u*Math.PI),turn=Math.sin(u*Math.PI*2);
  return{x:1.25*turn*curve,y:2.4*(1-ease(u)),z:-.8*curve,bank:-.27*turn,flap:0};
}
export function stegoClickState(value){
  const p=clamp(value);if(p===0||p===1)return{head:0,foot:0,stomp:0,tail:0};
  const head=p<.25?ease(p/.25):1-ease(clamp((p-.85)/.15));
  const foot=p<.4?ease(clamp((p-.25)/.15)):1-ease(clamp((p-.4)/.1));
  const stomp=p>.48&&p<.68?Math.sin((p-.48)/.2*Math.PI):0,u=clamp((p-.62)/.38);
  return{head,foot,stomp,tail:p>.62?Math.sin(u*Math.PI*2)*Math.sin(u*Math.PI):0};
}
