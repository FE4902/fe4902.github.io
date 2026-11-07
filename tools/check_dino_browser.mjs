// 전용 headless Chrome의 9334 포트로 실제 입력·렌더 상태를 검수한다.
import {writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {devServer, qaNavigator} from './dev-server.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const server=await devServer();
const qa=`window.__qa={get:()=>({reduce,z:camera.position.z,y:camera.position.y,forwardZ:camera.getWorldDirection(new THREE.Vector3()).z,score:+scoreEl.textContent,cake:+flagsEl.textContent,bonus:fx.bonus,dinoFlip:runners[0].flip,dinoY:runners[0].spr.position.y,dinoScaleY:runners[0].spr.scale.y/runners[0].h,dinoRotation:runners[0].spr.material.rotation,birdFlip:birds[0].flip,birdY:birds[0].spr.position.y,birdX:birds[0].spr.position.x,birdZ:birds[0].spr.position.z,stegoFlip:stego.flip,stegoHead:stegoClickState(stego.flip>0?1-stego.flip:0).head,stegoFoot:stegoClickState(stego.flip>0?1-stego.flip:0).foot,stegoStomp:stegoClickState(stego.flip>0?1-stego.flip:0).stomp,stegoTail:stegoClickState(stego.flip>0?1-stego.flip:0).tail,stegoX:stego.spr.position.x,birdBase:birds[0].baseY,birdRotation:birds[0].spr.material.rotation,pose:playerPose,bodyVisible:playerBody.visible,bodyY:playerBody.position.y,bodyZ:playerBody.position.z,eyeError:camera.position.distanceTo(playerModels[playerPose].userData.eyeAnchor.getWorldPosition(new THREE.Vector3())),wipe:post.uniforms.wipe.value,sunY:sun.position.y,moonY:moon.position.y,clouds:clouds.length,stars:stars.length,obstacles:obstacles.length,tumbleX:tumbleweeds[0].position.x,tumbleRotation:tumbleweeds[0].material.rotation,handsVisible:offeredHands.visible,handCount:offeredHands.children.length,flowerVisible:offeredFlower.visible,flowerOffer:storyState(sp).offer,ribbon:runners[0].spr.material.map===endingGirlfriendTex,chapter:storyState(sp).chapter,contact:storyState(sp).contact,rivalVisible:rival.visible,coupleGap:rival.position.x-runners[0].spr.position.x,night:post.uniforms.night.value}),step:n=>{for(let i=0;i<n;i++)LOOP();},dust:()=>dustPos[1],dinoPoint:()=>scr(runners[0].spr.position.clone().add(new THREE.Vector3(0,1,0))),occludedBirdPoint:()=>{t=.25;LOOP();const p=scr(birds[0].spr.position.clone().add(new THREE.Vector3((34.5/48-.5)*2.8,(1-28.5/32)*1.86,0).applyQuaternion(camera.quaternion))),r=renderer.domElement.getBoundingClientRect();return{clientX:r.left+p.clientX/innerWidth*r.width,clientY:r.top+p.clientY/innerHeight*r.height};},birdWingPoint:()=>{t=.25;LOOP();return scr(birds[0].spr.position.clone().add(new THREE.Vector3((30/48-.5)*2.8,(1-27/32)*1.86,0).applyQuaternion(camera.quaternion)));},stegoPoint:()=>scr(stego.spr.position.clone().add(new THREE.Vector3(-.2,.85,0))),tumblePoint:()=>scr(tumbleweeds[0].position.clone()),rivalPoint:()=>scr(rival.position.clone().add(new THREE.Vector3(0,1,0))),propPoint:()=>scr(obstacles[0].position.clone().add(new THREE.Vector3(0,1,0)))};`;

const targets=await (await fetch('http://127.0.0.1:9334/json/list')).json();
const target=targets.find(t=>t.type==='page');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const a=pending.get(m.id);pending.delete(m.id);m.error?a?.reject(m.error):a?.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+' '+(m.params.exceptionDetails.exception?.description||''));});
const call=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async(expression,ms=20000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,250));}throw Error('timeout: '+expression);};
const out=join(root,'_artifacts/dino');mkdirSync(out,{recursive:true});
const screen=async name=>{const r=await call('Page.captureScreenshot',{format:'webp',quality:100,captureBeyondViewport:false});writeFileSync(out+'/'+name+'.webp',Buffer.from(r.data,'base64'));};
// reduce·motion: 움직임 줄이기를 켠 그대로 / 끈 상태로 강제, 둘 다 프레임 2개를 돌린 뒤 window.__qa 를 연다
const toQA=qaNavigator(call,{reduce:{steps:2,js:qa},motion:{steps:2,js:qa,motion:true}});
const goto=async url=>{const target=new URL(url);target.searchParams.set('theme','dino');await call('Page.navigate',{url:await toQA(target.href)});await wait('document.getElementById("start")?.disabled === false',45000);};
const size=async(w,h)=>call('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<600});
const motion=async reduced=>call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
await call('Runtime.enable');await call('Page.enable');await size(1280,720);await motion(true);
await goto(server.url);
assert.equal(await evaluate('document.getElementById("intro").hidden'),false);
await screen('title-desktop');
await size(430,800);await screen('title-mobile');await size(1280,720);
await evaluate('localStorage.setItem("arcade-visited", JSON.stringify(["circus","antarctic"]))');
await goto(server.url);
await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
assert.equal(await evaluate('document.getElementById("ready").hidden'),false);
assert.equal(await evaluate('localStorage.getItem("arcade-visited")'),null,'이전 방문 기록을 제거하고 다시 저장하지 않음');
await screen('ready');await wait('document.getElementById("ready").hidden && !document.body.classList.contains("waiting")');
await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:600,y:400,deltaX:0,deltaY:900});
await wait('scrollY > 0 && Number(document.getElementById("score").textContent)>0');
console.log('PASS 실제 Enter 시작·READY·휠 주행·프로젝트 전체 3개');
await motion(true);await size(1280,720);await goto(server.url+'__qa/reduce'+'?p=0.14');await wait('!!window.__qa');
const blockedBird=await evaluate('__qa.occludedBirdPoint()');
await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:blockedBird.clientX,y:blockedBird.clientY});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:blockedBird.clientX,y:blockedBird.clientY});await evaluate('__qa.step(1)');
assert.equal((await evaluate('__qa.get()')).bonus,0,'선인장에 가려진 익룡은 클릭하지 않음');console.log('PASS 불투명 소품 뒤 캐릭터 클릭 차단');
if(process.argv.includes('--occlusion')){ws.close();process.exit(0);}

for(const p of [.48,.83]){
  await goto(server.url+'__qa/reduce'+'?p='+p);await wait('!!window.__qa');
  const name='transition-'+p;await screen(name);
  const range=JSON.parse(execFileSync('python3',['-c','from PIL import Image; import json,sys; print(json.dumps(Image.open(sys.argv[1]).convert("L").crop((80,150,1200,600)).getextrema()))',out+'/'+name+'.webp'],{encoding:'utf8'}));
  assert.ok(range[1]-range[0]>60,'밤 전환 중간에도 무대 명암 대비 유지: '+range);
}
for(const reduced of [true,false]) {
  await motion(reduced);await size(1280,720);
  await goto(server.url+'__qa/'+(reduced?'reduce':'motion')+'?p=0.08');
  await wait('!!window.__qa');
  const before=await evaluate('__qa.get()');
  const point=await evaluate('__qa.dinoPoint()');
  await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:point.clientX,y:point.clientY});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:point.clientX,y:point.clientY});
  await evaluate('__qa.step(1)');
  const after=await evaluate('__qa.get()');
  assert.equal(after.bonus-before.bonus,1000,'공룡 실제 클릭');assert.ok(after.dinoFlip>0,'클릭 모션');
  const dustBefore=await evaluate('__qa.dust()');await evaluate('__qa.step(2)');
  assert.ok((await evaluate('__qa.get()')).dinoScaleY<.9,'점프 준비 압축');if(reduced)await screen('dino-prep');
  await evaluate('__qa.step(10)');const hop=await evaluate('__qa.get()');assert.ok(hop.dinoY>.9,'티라노 점프 정점');assert.ok(Math.abs(hop.dinoRotation)<.07,'티라노 작은 기울기만');await screen('dino-hop-'+(reduced?'reduce':'motion'));
  await evaluate('__qa.step(11)');const landing=await evaluate('__qa.get()');assert.equal(landing.dinoY,0,'티라노 착지는 바닥');assert.ok(landing.dinoScaleY<.9,'착지 압축');if(reduced)await screen('dino-land');
  await evaluate('__qa.step(15)');assert.equal((await evaluate('__qa.get()')).dinoScaleY,1,'티라노 완전 복원');assert.notEqual(await evaluate('__qa.dust()'),dustBefore,'앰비언트 시간 진행');
  await screen('desktop-'+(reduced?'reduce':'motion'));
  console.log('PASS '+(reduced?'reduce':'motion')+' 실제 클릭 +1000·모션·앰비언트',after);
}
await motion(true);await goto(server.url+'__qa/reduce'+'?p=0.08');await wait('!!window.__qa');
assert.ok((await evaluate('__qa.get()')).eyeError<.000001,'같은 모형의 눈과 카메라 위치 일치');
assert.equal(await evaluate('document.getElementById("look-down")'),null,'LOOK 버튼 제거');
const forwardBefore=(await evaluate('__qa.get()')).forwardZ;
await call('Input.dispatchKeyEvent',{type:'keyDown',key:'v',code:'KeyV',windowsVirtualKeyCode:86});
await call('Input.dispatchKeyEvent',{type:'keyUp',key:'v',code:'KeyV',windowsVirtualKeyCode:86});await evaluate('__qa.step(1)');
assert.equal((await evaluate('__qa.get()')).forwardZ,forwardBefore,'V 키로 수동 시점이 바뀌지 않음');
for(const p of [.32903225806,.33241935484,.339,.359]){
  await evaluate(`window.__qaProgress=${p};__qa.step(1)`);
  assert.ok((await evaluate('__qa.get()')).eyeError<.000001,'숙이기 전환에서도 모형의 눈과 카메라 일치: '+p);
}
await evaluate('window.__qaProgress=.08;__qa.step(1)');
const originalBodyZ=(await evaluate('__qa.get()')).bodyZ;
await evaluate('window.__qaProgress=.10;__qa.step(1)');assert.match((await evaluate('__qa.get()')).pose,/^run/);
await evaluate('__qa.step(1)');assert.equal((await evaluate('__qa.get()')).pose,'idle','스크롤 정지 시 발걸음 정지');
await evaluate('window.__qaProgress=.08;__qa.step(1)');assert.ok(Math.abs((await evaluate('__qa.get()')).bodyZ-originalBodyZ)<1e-8,'역스크롤 시 몸 위치 복원');
const initialSky=await evaluate('__qa.get()');
for(const [p,name] of [[.08,'sky-day'],[.46,'sky-dusk'],[.6,'sky-moonrise'],[.8,'sky-night']]){
  await evaluate(`window.__qaProgress=${p};__qa.step(1)`);await screen(name);
  const sky=await evaluate('__qa.get()');assert.equal(sky.clouds,3);assert.equal(sky.stars,2);
  await evaluate('__qa.step(12)');const still=await evaluate('__qa.get()');assert.ok(Math.abs(still.sunY-sky.sunY)<1e-8);assert.ok(Math.abs(still.moonY-sky.moonY)<1e-8);
}
await evaluate('window.__qaProgress=.08;__qa.step(1)');
const returnedSky=await evaluate('__qa.get()');assert.ok(Math.abs(returnedSky.sunY-initialSky.sunY)<1e-8);assert.ok(Math.abs(returnedSky.moonY-initialSky.moonY)<1e-8);assert.equal(returnedSky.night,0,'역스크롤 시 낮으로 복귀');
for(const reduced of [false,true]){
  await motion(reduced);await goto(server.url+'__qa/'+(reduced?'reduce':'motion')+'?p=0.08');await wait('!!window.__qa');
  for(const p of [.32903225806,.33241935484,.339,.359]){
    await evaluate(`window.__qaProgress=${p};__qa.step(1)`);
    assert.ok((await evaluate('__qa.get()')).eyeError<.000001,'모션 설정과 숙이기 중간 자세에서도 실제 눈높이 일치');
  }
}
await motion(true);
await size(1280,720);
await goto(server.url+'__qa/reduce'+'?p=0.20');await wait('!!window.__qa');
const weedBefore=await evaluate('__qa.get()');assert.equal(weedBefore.obstacles,6,'단독 2개와 두 개 묶음 2개');
await evaluate('window.__qaProgress=.26;__qa.step(1)');assert.notEqual((await evaluate('__qa.get()')).tumbleRotation,weedBefore.tumbleRotation);
await evaluate('window.__qaProgress=.20;__qa.step(1)');assert.ok(Math.abs((await evaluate('__qa.get()')).tumbleX-weedBefore.tumbleX)<1e-7,'역스크롤하면 회전초 위치 복원');
const weed=await evaluate('__qa.tumblePoint()');await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:weed.clientX,y:weed.clientY});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:weed.clientX,y:weed.clientY});await evaluate('__qa.step(1)');
assert.equal((await evaluate('__qa.get()')).bonus,0,'회전초는 클릭 대상 아님');await screen('tumbleweed');
await size(430,800);await goto(server.url+'__qa/reduce'+'?p=0.14');await wait('!!window.__qa');await screen('tumbleweed-refined-mobile');await size(1280,720);
await goto(server.url+'__qa/reduce'+'?p=0.36');await wait('!!window.__qa');await screen('paired-cacti');
await goto(server.url+'__qa/reduce'+'?p=0.94');await wait('!!window.__qa');
const reveal=await evaluate('__qa.get()');assert.equal(reveal.flowerVisible,true);assert.equal(reveal.handsVisible,true);assert.equal(reveal.handCount,2);assert.equal(reveal.flowerOffer,1);assert.equal(reveal.ribbon,true);assert.equal(reveal.chapter,'reveal');assert.equal(reveal.contact,1);assert.equal(reveal.rivalVisible,true);assert.ok(reveal.coupleGap<2);await screen('girlfriend-reveal-desktop');
const rivalPoint=await evaluate('__qa.rivalPoint()');await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:rivalPoint.clientX,y:rivalPoint.clientY});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:rivalPoint.clientX,y:rivalPoint.clientY});await evaluate('__qa.step(1)');
assert.equal((await evaluate('__qa.get()')).bonus,0,'결승 상대 공룡은 클릭 반응 없음');
const coupleGirl=await evaluate('__qa.dinoPoint()');await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:coupleGirl.clientX,y:coupleGirl.clientY});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:coupleGirl.clientX,y:coupleGirl.clientY});await evaluate('__qa.step(1)');assert.equal((await evaluate('__qa.get()')).bonus,0,'결승 리본 공룡도 클릭 반응 없음');
await size(430,800);await goto(server.url+'__qa/reduce'+'?p=0.94');await wait('!!window.__qa');await screen('girlfriend-reveal-mobile');await size(1280,720);
await goto(server.url+'__qa/reduce'+'?p=0.08');await wait('!!window.__qa');
const prop=await evaluate('__qa.propPoint()');
await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:prop.clientX,y:prop.clientY});
await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:prop.clientX,y:prop.clientY});await evaluate('__qa.step(1)');
assert.equal((await evaluate('__qa.get()')).bonus,0,'선인장은 클릭 대상 아님');
await motion(true);await size(430,800);
await goto(server.url+'__qa/reduce'+'?p=0.30');await wait('!!window.__qa');
assert.equal(await evaluate('innerWidth'),430);assert.equal((await evaluate('__qa.get()')).cake,1);await screen('mobile');
await goto(server.url+'__qa/reduce'+'?p=0.08');await wait('!!window.__qa');
const touchPoint=await evaluate('__qa.dinoPoint()');
await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchPoint.clientX,y:touchPoint.clientY}]});
await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await evaluate('__qa.step(1)');
assert.equal((await evaluate('__qa.get()')).bonus,1000,'모바일 터치로 캐릭터 클릭');
await size(1280,720);await goto(server.url+'__qa/reduce'+'?p=0.1896774193548387');await wait('!!window.__qa');
assert.ok((await evaluate('__qa.get()')).y>2);await screen('jump');
await goto(server.url+'__qa/reduce'+'?p=0.30');await wait('!!window.__qa');
const birdPoint=await evaluate('__qa.birdWingPoint()');
await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:birdPoint.clientX,y:birdPoint.clientY});
await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:birdPoint.clientX,y:birdPoint.clientY});await evaluate('__qa.step(1)');
assert.equal((await evaluate('__qa.get()')).bonus,1000,'내려친 날개의 보이는 도트도 클릭 가능');assert.ok((await evaluate('__qa.get()')).birdFlip>0);
await evaluate('__qa.step(12)');const ascent=await evaluate('__qa.get()');assert.ok(ascent.birdY>ascent.birdBase+2.3,'익룡 급상승');assert.ok(Math.abs(ascent.birdRotation)<.28,'익룡은 작은 기울기만');await screen('bird');
await evaluate('__qa.step(10)');const bank=await evaluate('__qa.get()');assert.ok(Math.abs(bank.birdX)>.25,'익룡 곡선 복귀');await screen('bird-bank');
await evaluate('__qa.step(40)');const landedBird=await evaluate('__qa.get()');assert.equal(landedBird.birdY,landedBird.birdBase,'익룡 원래 높이로 복귀');assert.equal(landedBird.birdX,0);assert.equal(landedBird.birdZ,-38);
for(const reduced of [true,false]){
  await motion(reduced);await size(1280,720);await goto(server.url+'__qa/'+(reduced?'reduce':'motion')+'?p=0.43');await wait('!!window.__qa');
  assert.ok((await evaluate('__qa.get()')).stegoX-1.9>3.6,'스테고는 길 밖');if(reduced)await screen('stego-desktop');
  const at=await evaluate('__qa.stegoPoint()');assert.ok(at.clientX>0&&at.clientX<1280,'스테고 실제 화면 위치');
  for(let n=0;n<2;n++){await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:at.clientX,y:at.clientY});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:at.clientX,y:at.clientY});}
  await evaluate('__qa.step(10)');assert.equal((await evaluate('__qa.get()')).bonus,1000,'스테고 클릭 +1000 및 반응 도중 중복 방지');assert.ok((await evaluate('__qa.get()')).stegoHead>.8);if(reduced)await screen('stego-look');
  await evaluate('__qa.step(9)');assert.ok((await evaluate('__qa.get()')).stegoFoot>.8);if(reduced)await screen('stego-foot');
  await evaluate('__qa.step(9)');assert.ok((await evaluate('__qa.get()')).stegoStomp>.7);if(reduced)await screen('stego-stomp');
  await evaluate('__qa.step(11)');assert.ok(Math.abs((await evaluate('__qa.get()')).stegoTail)>.3);if(reduced)await screen('stego-tail');
  await evaluate('__qa.step(20)');const restored=await evaluate('__qa.get()');assert.equal(restored.stegoFlip,0);assert.equal(restored.stegoHead,0);assert.equal(restored.stegoFoot,0);assert.equal(restored.stegoTail,0);
}
await motion(true);await size(430,800);await goto(server.url+'__qa/reduce'+'?p=0.36');await wait('!!window.__qa');await screen('stego-mobile');
const stegoTouch=await evaluate('__qa.stegoPoint()');assert.ok(stegoTouch.clientX>0&&stegoTouch.clientX<430);
await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:stegoTouch.clientX,y:stegoTouch.clientY}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await evaluate('__qa.step(28)');assert.equal((await evaluate('__qa.get()')).bonus,1000,'모바일 스테고 터치');assert.ok((await evaluate('__qa.get()')).stegoStomp>.7);await screen('stego-mobile-stomp');await size(1280,720);

await goto(server.url+'__qa/reduce'+'?p=0.3493548387096774');await wait('!!window.__qa');
assert.ok(Math.abs((await evaluate('__qa.get()')).y-1.771)<1e-7,'모션 감소에서도 익룡 앞 자동 숙이기 복원');await screen('auto-duck-desktop');
assert.match((await evaluate('__qa.get()')).pose,/^duck/);assert.ok((await evaluate('__qa.get()')).eyeError<.000001,'숙인 모형의 실제 눈과 카메라 일치');
await size(430,800);await evaluate('__qa.step(1)');await screen('auto-duck-mobile');await size(1280,720);await evaluate('__qa.step(1)');
await goto(server.url+'__qa/reduce'+'?p=0.7');await wait('!!window.__qa');
assert.equal((await evaluate('__qa.get()')).night,1);await screen('night-desktop');
await size(430,800);await goto(server.url+'__qa/reduce'+'?p=0.7');await wait('!!window.__qa');await screen('night-mobile');
await size(1280,720);
await goto(server.url+'__qa/reduce'+'?p=1');await wait('!!window.__qa');
const finish=await evaluate('__qa.get()');assert.equal(finish.y,2.1175,"결승 정지 뒤에는 추가 점프하지 않음");assert.equal(finish.cake,3);assert.equal(finish.wipe,0);assert.equal(finish.bodyVisible,false);assert.equal(finish.flowerVisible,true);
await wait('document.getElementById("clear").classList.contains("on")');
const clearRival=await evaluate('__qa.rivalPoint()');
await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:clearRival.clientX,y:clearRival.clientY});
await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:clearRival.clientX,y:clearRival.clientY});await evaluate('__qa.step(1)');
assert.equal((await evaluate('__qa.get()')).bonus,0,'클리어 중에도 커플 클릭 반응 없음');
assert.equal(await evaluate('document.getElementById("clearScore").textContent'),await evaluate('document.getElementById("score").textContent'),'클리어 점수 일치');
await wait('document.body.classList.contains("portal-mode")');
assert.ok(JSON.parse(await evaluate('sessionStorage.getItem("arcade-cleared")')).includes('dino'),'클리어는 현재 탭에만 저장');
assert.equal(await evaluate('location.search.includes("cleared")'),false,'클리어 기록을 URL로 전달하지 않음');
// 움직임 줄이기: 시스템 창 수락 → 0.7초 페이드 → 도착 화면
await wait('document.getElementById("system").open');
await evaluate('document.querySelector(\'[data-choice="yes"]\').click()');
await wait('document.getElementById("ending").classList.contains("on")');
assert.equal(await evaluate('document.body.dataset.portal'),'ended');
assert.equal(await evaluate('[...document.querySelectorAll(".orb")].map(o=>o.textContent).join()'),'PROFILE,PROJECTS,GITHUB,EMAIL','도착 화면 메뉴 4개');
await motion(false);await goto(server.url+'__qa/motion'+'?p=1');await wait('!!window.__qa');assert.ok((await evaluate('__qa.get()')).forwardZ<0,'진행률 직접 진입에서도 앞을 바라봄');await evaluate('__qa.step(20)');await wait('getComputedStyle(document.getElementById("clear")).opacity === "1"');await screen('clear');
await wait('document.body.classList.contains("portal-mode")');
await wait('document.getElementById("system").open');

await motion(true);await goto(server.url+'__qa/reduce'+'?p=1');await wait('!!window.__qa');
await evaluate('window.__qaProgress=.30;__qa.step(1)');
await new Promise(r=>setTimeout(r,4700));
assert.equal(await evaluate('document.body.classList.contains("portal-mode")||document.getElementById("clear").classList.contains("on")'),false,'역스크롤하면 반전 장면 뒤 클리어·전송 예약 모두 취소');
assert.equal((await evaluate('__qa.get()')).cake,1);assert.equal((await evaluate('__qa.get()')).flowerVisible,false);assert.equal((await evaluate('__qa.get()')).handsVisible,false);assert.equal((await evaluate('__qa.get()')).ribbon,false);
console.log('PASS 본편 클리어 목록 보존·결승 정지·역스크롤 예약 취소');
assert.deepEqual(errors,[]);console.log('PASS 회전초·선인장 묶음·반전 장면·캐릭터 반응·정확한 모바일 크기·점프·익룡 클릭·케이크 3개·하차·이세계 전송·오류 0건');
ws.close();
await server.close();
