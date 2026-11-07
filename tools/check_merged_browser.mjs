// 전용 Chrome 9334에서 세 테마 화면·공통 이세계 전송·도착 화면 메뉴를 검사한다.
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {devServer,qaNavigator} from './dev-server.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await devServer();
// 전송은 시계를 고정하고 한 프레임씩 진행한다 (헤드리스는 rAF가 드묾).
const qa='window.__mergedQA={step:n=>{for(let i=0;i<n;i++)LOOP();},portal:()=>{let T=performance.now();performance.now=()=>T;const tick=toPortal();window.__portalStep=ms=>{T+=ms;tick();};}};';
const targets=await(await fetch('http://127.0.0.1:9334/json/list')).json();
const target=targets.find(t=>t.type==='page');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{const end=Date.now()+45000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,200));}throw Error('timeout '+expression);};
const toQA=qaNavigator(call,{merged:{steps:10,js:qa}});
const goto=async url=>{await call('Page.navigate',{url:await toQA(url)});await wait('document.getElementById("start")?.disabled===false');};
const size=async(w,h)=>call('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<600});
const out=join(root,'_artifacts/merged');mkdirSync(out,{recursive:true});
const screen=async name=>{const result=await call('Page.captureScreenshot',{format:'webp',quality:100,captureBeyondViewport:false});writeFileSync(join(out,name+'.webp'),Buffer.from(result.data,'base64'));};
const base=server.url;
const fixture=server.url+'__qa/merged';
await call('Runtime.enable');await call('Page.enable');
await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
for(const theme of ['circus','antarctic','dino']){
  for(const [w,h,label] of [[1280,720,'desktop'],[430,800,'mobile']]){
    await size(w,h);await goto(base+'?theme='+theme);
    assert.equal(await evaluate('document.body.dataset.theme'),theme);
    assert.equal(await evaluate('document.querySelectorAll(".theme-select a").length'),0);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'가로 넘침 없음');
    const style=await evaluate('({body:getComputedStyle(document.body).backgroundColor,ride:getComputedStyle(document.querySelector(".ride")).height})');
    assert.equal(style.body,{circus:'rgb(0, 0, 0)',antarctic:'rgb(64, 180, 209)',dino:'rgb(247, 247, 247)'}[theme],'테마 바탕색(3D 뜨기 전)이 다른 테마로 새지 않음');
    await screen('three-'+theme+'-title-'+label);
    await goto(fixture+'?theme='+theme+'&p=.32');await wait('!!window.__mergedQA');
    assert.equal(await evaluate('document.getElementById("system").open||document.getElementById("ending").classList.contains("on")'),false,'달리는 중에는 전송 화면 없음');
    assert.equal(await evaluate('document.querySelectorAll("canvas").length'),1,'선택 테마 렌더러 하나만 생성');
    await screen('three-'+theme+'-ride-'+label);
  }
}
await size(1280,720);
await evaluate('sessionStorage.setItem("arcade-cleared",JSON.stringify(["circus","antarctic"]))');
await goto(base);
assert.equal(await evaluate('document.body.dataset.theme'),'dino','실제 브라우저에서도 미완료 공룡 선택');
const initialURL=await evaluate('location.href');
for(const n of [1,2,3]){
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:String(n),code:'Digit'+n,windowsVirtualKeyCode:48+n});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:String(n),code:'Digit'+n,windowsVirtualKeyCode:48+n});
  assert.equal(await evaluate('location.href'),initialURL,'숫자키로 테마를 선택할 수 없음');
}
await evaluate('sessionStorage.removeItem("arcade-cleared")');
const press=async selector=>{
  const point=await evaluate(`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
};
// 시스템 창 줄 나타내기 애니메이션은 헤드리스 시간이 거의 안 흘러 검수 사진에서만 끈다.
const settle='document.head.insertAdjacentHTML("beforeend","<style>.system-window[open],.system-window[open] .system-line{animation:none!important}.ending{transition:none!important}</style>")';
let commonText='';
for(const theme of ['circus','antarctic','dino']){
  for(const [w,h,label] of [[1280,720,'desktop'],[430,800,'mobile']]){
    await size(w,h);await goto(fixture+'?theme='+theme+'&p=.32');await wait('!!window.__mergedQA');await evaluate(settle);
    await evaluate('__mergedQA.portal();__portalStep(100)');
    assert.equal(await evaluate('document.body.classList.contains("portal-mode")&&!document.getElementById("system").open'),true,'노이즈 뒤에 시스템 창');
    await evaluate('__portalStep(700)');
    assert.equal(await evaluate('document.getElementById("system").open'),true);
    const text=(await evaluate('document.getElementById("system").textContent')).replace(/\s+/g,'');
    if(commonText)assert.equal(text,commonText,'모든 테마에서 같은 전송 문구');else commonText=text;
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'시스템 창 가로 넘침 없음');
    await screen('portal-'+theme+'-system-'+label);
    await press('[data-choice="yes"]');await evaluate('__portalStep(2300)');
    assert.equal(await evaluate('document.getElementById("system").open'),false,'수락하면 창을 닫고 전송');
    assert.equal(await evaluate('document.body.dataset.portal'),'ended');
    await wait('getComputedStyle(document.getElementById("ending")).opacity==="1"');
    assert.equal(await evaluate('document.activeElement.textContent'),'PROFILE','도착하면 첫 메뉴에 포커스');
    assert.equal(await evaluate('[...document.querySelectorAll(".orb")].map(o=>o.textContent).join()'),'PROFILE,PROJECTS,GITHUB,EMAIL','모든 테마 같은 메뉴');
    assert.equal(await evaluate('[...document.querySelectorAll(".orb")].every(o=>{const b=o.getBoundingClientRect();return b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight;})'),true,'메뉴가 화면 안');
    assert.equal(await evaluate('!document.getElementById("next-card")&&location.search.includes("theme="+document.body.dataset.theme)'),true,'다음 무대 카드·자동 이동 없음');
    await screen('portal-'+theme+'-arrival-'+label);
  }
}
await size(1280,720);
// 거절·Esc·무응답은 붉은 경고 3초 뒤 같은 전송으로 이어진다.
for(const way of ['no','escape','idle']){
  await goto(fixture+'?theme=circus&p=.32');await wait('!!window.__mergedQA');await evaluate(settle);
  await evaluate('__mergedQA.portal();__portalStep(800)');
  if(way==='no')await press('[data-choice="no"]');
  else if(way==='escape'){await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});}
  else await evaluate('__portalStep(20000)');
  await wait('document.getElementById("system").dataset.status==="forced"&&document.getElementById("system").open');   // 닫힘 이벤트는 비동기
  assert.equal(await evaluate('document.getElementById("system").dataset.status'),'forced',way+': 붉은 경고');
  assert.equal(await evaluate('document.querySelector(".system-choices").hidden'),true);
  assert.equal(await evaluate('document.getElementById("system").open'),true,way+': Esc로도 닫히지 않음');
  if(way==='no')await screen('portal-circus-refusal');
  await evaluate('__portalStep(3000);__portalStep(2300)');
  assert.equal(await evaluate('document.body.dataset.portal'),'ended',way+': 강제 전송 완료');
}
assert.deepEqual(JSON.parse(await evaluate('sessionStorage.getItem("arcade-cleared")')),['circus','antarctic','dino']);
// 도착 메뉴: PROFILE·PROJECTS 창은 열리고 Esc로 닫히며 포커스가 메뉴로 돌아온다.
await goto(fixture+'?theme=antarctic&p=.32');await wait('!!window.__mergedQA');await evaluate(settle);
await evaluate('__mergedQA.portal();__portalStep(800)');await press('[data-choice="yes"]');await evaluate('__portalStep(2300)');
await wait('getComputedStyle(document.getElementById("ending")).visibility==="visible"');
for(const [index,win] of [[0,'profile-window'],[1,'projects-window']]){
  await press('.orb[data-orb="'+index+'"]');
  await wait('document.getElementById("'+win+'").open');
  await screen('arrival-'+win);
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await wait('!document.getElementById("'+win+'").open');
  assert.equal(await evaluate('document.activeElement.dataset.orb'),String(index),win+' 닫으면 메뉴로 포커스 복귀');
}
// 외부 사이트는 열지 않고 실제 링크와 날아가는 반응을 확인한다.
assert.equal(await evaluate(`document.querySelector('[data-orb="2"]').href`), 'https://github.com/FE4902');
await evaluate(`document.querySelector('[data-orb="2"]').addEventListener('click', e => e.preventDefault(), { once: true })`);
await press('.orb[data-orb="2"]');
assert.equal(await evaluate('document.querySelector(\'.orb[data-orb="2"]\').classList.contains("away")'),true,'연락처 날아감');
assert.equal(await evaluate('location.hash'),'');
// 다시 들어오면 미완료 테마의 타이틀에서 시작한다.
await evaluate('sessionStorage.setItem("arcade-cleared",JSON.stringify(["circus","antarctic"]))');
await goto(fixture);
await wait('document.body.dataset.theme==="dino" && document.getElementById("start")?.disabled===false');
assert.equal(await evaluate('document.getElementById("intro").hidden'),false);
assert.equal(await evaluate('document.getElementById("ready").hidden'),true);
await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
assert.equal(await evaluate('document.getElementById("ready").hidden'),false,'PRESS START 후에만 READY 표시');
assert.deepEqual(await evaluate('Object.keys(sessionStorage).sort()'),['arcade-cleared']);
assert.deepEqual(errors,[]);
console.log('PASS 세 테마 데스크톱/모바일·CSS 격리·전송 문구 일치·수락/거절/Esc/무응답·도착 메뉴(창 열기/닫기·포커스·연락처)·미완료 우선 재진입·선택 UI/숫자키 제거·세 무대 완료·런타임 오류 0건');
ws.close();
await server.close();
