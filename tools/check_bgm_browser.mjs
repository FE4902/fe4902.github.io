// 전용 Chrome 9335에서 실제 오디오 출력과 사용자 입력을 검사한다.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {devServer,qaNavigator} from './dev-server.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await devServer();
const port=process.env.PORTFOLIO_AUDIO_PORT||9335;
const target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{const end=Date.now()+30000;while(Date.now()<end){if(await ev(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('시간 초과: '+expression);};
const press=async selector=>{const p=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});};
const key=async(code,key)=>{const windowsVirtualKeyCode={Escape:27,Enter:13,Space:32,KeyM:77,ArrowRight:39}[code];await call('Input.dispatchKeyEvent',{type:'keyDown',code,key,windowsVirtualKeyCode});await call('Input.dispatchKeyEvent',{type:'keyUp',code,key,windowsVirtualKeyCode});};
const qa='window.__bgmQA={portal:()=>{let T=performance.now();performance.now=()=>T;const tick=toPortal();window.__portalStep=ms=>{T+=ms;tick();};}};';
const toQA=qaNavigator(call,{bgm:{steps:10,js:qa}});
const out=join(root,'_artifacts/bgm');mkdirSync(out,{recursive:true});
const screen=async name=>{const r=await call('Page.captureScreenshot',{format:'webp',quality:100,captureBeyondViewport:false});writeFileSync(join(out,name+'.webp'),Buffer.from(r.data,'base64'));};
const load=async(query='',withQA=false)=>{await call('Page.navigate',{url:await toQA(server.url+(withQA?'__qa/bgm':'')+query)});await wait('document.getElementById("start")?.disabled===false');};
try {
await call('Page.enable');await call('Runtime.enable');
await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
// 실제 출력 파형을 관찰하되 오디오 노드 구현은 브라우저 자체를 쓴다.
await call('Page.addScriptToEvaluateOnNewDocument',{source:`
window.__audioContexts=[]; window.__audioSources=[];
const NativeAudioContext=window.AudioContext;
window.AudioContext=class extends NativeAudioContext {
 constructor(...args){super(...args);window.__audioContexts.push(this);}
 createBufferSource(){const s=super.createBufferSource();window.__audioSources.push(s);return s;}
};
const nativeConnect=AudioNode.prototype.connect;
AudioNode.prototype.connect=function(dest,...args){
 if(dest===this.context.destination && this.context instanceof NativeAudioContext){
  const a=this.context.createAnalyser();a.fftSize=2048;window.__audioAnalyser=a;
  window.__masterGain=this.gain;nativeConnect.call(this,a);nativeConnect.call(a,dest);return dest;
 }
 return nativeConnect.call(this,dest,...args);
};
window.__rms=()=>{const a=window.__audioAnalyser;if(!a)return 0;const d=new Float32Array(a.fftSize);a.getFloatTimeDomainData(d);return Math.sqrt(d.reduce((s,x)=>s+x*x,0)/d.length);};`});
await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
await load('?theme=circus');
assert.equal(await ev('!!document.getElementById("sound-toggle")'),true,'음소거 버튼이 있어야 한다');
assert.equal(await ev('__audioContexts.length'),0,'타이틀 진입만으로 오디오를 만들지 않는다');
await screen('circus-title-desktop');
await press('#start');
await wait('__rms()>0.001');
assert.equal(await ev('__audioContexts.length'),1,'시작 후 오디오 컨텍스트 하나');
assert.equal(await ev('document.getElementById("sound-toggle").getAttribute("aria-pressed")'),'true');
await press('#sound-toggle');
await new Promise(r=>setTimeout(r,200));
assert.equal(await ev('__rms()<0.0001'),true,'음소거가 실제 출력도 끈다');
await key('KeyM','m');await wait('__rms()>0.001');
assert.equal(await ev('__audioContexts.length'),1,'토글해도 컨텍스트가 늘지 않는다');
assert.equal(await ev('!!document.getElementById("sound-volume")'),true,'인게임 볼륨 조절이 있어야 한다');
const sourceCount=await ev('__audioSources.length');
await ev(`const slider=document.getElementById('sound-volume');slider.value='25';slider.dispatchEvent(new Event('input',{bubbles:true}));`);
// 볼륨은 오디오 시계로 감쇠하므로 실제 게인이 목표에 도달할 때까지 기다린다.
await wait('Math.abs(__masterGain.value - .25) < .001');
assert.equal(await ev('__audioSources.length'),sourceCount,'볼륨을 바꿔도 곡을 재시작하지 않는다');
await ev(`document.getElementById('sound-volume').value='0';document.getElementById('sound-volume').dispatchEvent(new Event('input',{bubbles:true}));`);
await wait('__masterGain.value<.0001 && __rms()<.0001');
await ev(`document.getElementById('sound-volume').focus()`);await key('ArrowRight','ArrowRight');
await wait('__rms()>.0001');assert.equal(await ev('document.getElementById("sound-volume").value'),'5','방향키로 볼륨 한 단계 조절');
await press('#sound-toggle');await new Promise(r=>setTimeout(r,100));assert.equal(await ev('__rms()<.0001'),true);
await ev(`document.getElementById('sound-volume').value='40';document.getElementById('sound-volume').dispatchEvent(new Event('input',{bubbles:true}));`);
await new Promise(r=>setTimeout(r,100));assert.equal(await ev('__rms()<.0001'),true,'음소거 중 볼륨 변경은 음소거 유지');
await press('#sound-toggle');await wait('__rms()>.001');
assert.equal(await ev('document.getElementById("sound-volume").value'),'40','음소거 해제 후 선택 볼륨 유지');
await ev(`document.getElementById('sound-volume').focus()`);await key('KeyM','m');
assert.equal(await ev(`document.getElementById('sound-toggle').getAttribute('aria-pressed')`),'false','볼륨 포커스 상태에서도 M 음소거');

const audioReport=[];
for(const theme of ['circus','antarctic','dino']){
 await load('?theme='+theme);await press('#start');await wait('__audioSources.some(s=>s.loop) && __rms()>0.001');
 const info=await ev(`(()=>{const s=__audioSources.findLast(s=>s.loop),b=s.buffer,d=b.getChannelData(0);let peak=0,sum=0;for(const x of d){peak=Math.max(peak,Math.abs(x));sum+=x*x;}return{theme:document.body.dataset.theme,duration:b.duration,loop:s.loop,peak,rms:Math.sqrt(sum/d.length)};})()`);
 assert.equal(info.loop,true);assert.ok(info.duration>10 && info.duration<90,'의미 있는 길이의 반복곡');assert.ok(info.peak<0.95 && info.rms>0.01,'무음이나 클리핑 없는 합성');audioReport.push(info);
 // 동일한 합성 결과를 들어볼 수 있게 WAV 미리듣기를 남긴다.
 const wave=await ev(`(()=>{const b=__audioSources.findLast(s=>s.loop).buffer,d=b.getChannelData(0),n=Math.min(d.length,Math.floor(b.sampleRate*18)),a=new ArrayBuffer(44+n*2),v=new DataView(a);const str=(p,s)=>[...s].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt(0)));str(0,'RIFF');v.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,b.sampleRate,true);v.setUint32(28,b.sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.round(d[i]*.55*32767),true);let s='';const bytes=new Uint8Array(a);for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);})()`);
 writeFileSync(join(out,theme+'-preview.wav'),Buffer.from(wave,'base64'));
 await call('Emulation.setDeviceMetricsOverride',{width:430,height:800,deviceScaleFactor:1,mobile:true});
 await load('?theme='+theme);await screen(theme+'-title-mobile');
 await load('?theme='+theme+'&p=.32',true);await wait('!!window.__bgmQA');await screen(theme+'-sound-ride-mobile');
 const box=await ev(`(()=>{const r=document.getElementById('sound-controls').getBoundingClientRect();return {w:r.width,h:r.height,right:r.right,bottom:r.bottom,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
 assert.ok(box.w>=44&&box.h>=44&&box.right<=430&&box.bottom<=800&&!box.overflow,'모바일 컨트롤 전체 배치와 가로 넘침');
 assert.equal(await ev(`(()=>{const a=document.getElementById('sound-controls').getBoundingClientRect(),b=document.querySelector('.scroll').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;})()`),false,'주행 안내와 사운드 HUD가 겹치지 않는다');
 if(theme==='dino'){await ev(`document.body.dataset.night='true';document.body.classList.add('portal-mode')`);assert.equal(await ev(`getComputedStyle(document.getElementById('sound-controls')).getPropertyValue('--sound-ink').trim()`),'#6fd3ff','공룡 야간에서도 공통 도착 팔레트');}
 await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
}
await load('?theme=antarctic&p=.3');
assert.equal(await ev('__audioContexts.length'),0,'진행률 직행도 입력 전 무음');
await key('KeyM','m');await wait('__rms()>0.001');
// 실제 전송 흐름을 실행한다. 헤드리스에서는 전송 시계만 직접 진행한다.
await load('?theme=antarctic&p=.3',true);await wait('!!window.__bgmQA');
await key('KeyM','m');await wait('__rms()>0.001');
await ev(`document.getElementById('clear').classList.add('on')`);await wait('__audioSources.at(-1)?.loop===false');
await ev(`document.getElementById('clear').classList.remove('on')`);await wait('__audioSources.at(-1)?.loop===true && __rms()>0.001');
await press('#sound-toggle');
await ev(`__bgmQA.portal();__portalStep(800)`);
await wait('document.getElementById("system").open');
assert.equal(await ev('getComputedStyle(document.getElementById("sound-controls")).visibility'),'hidden','시스템 팝업에서는 사운드 HUD를 숨긴다');
await press('[data-choice="yes"]');await ev('__portalStep(2300)');
await wait('document.body.dataset.portal==="ended"');
await new Promise(r=>setTimeout(r,200));assert.equal(await ev('__rms()<0.0001'),true,'음소거 중 전송/도착으로 소리가 켜지지 않는다');
await key('KeyM','m');await wait('__rms()>0.001');
assert.ok(Math.abs(await ev('__audioSources.findLast(s=>s.loop).buffer.duration')-41.73913)<.001,'도착곡을 실제로 합성·재생한다');
await screen('arrival-desktop');
await ev(`document.getElementById('profile-window').showModal()`);
await wait('getComputedStyle(document.getElementById("sound-controls")).visibility==="hidden"');
assert.equal(await ev('document.querySelectorAll("dialog .sound-controls").length'),0,'팝업에 사운드 컨트롤이 없다');
await key('KeyM','m');await new Promise(r=>setTimeout(r,150));assert.equal(await ev('__rms()<0.0001'),true,'팝업에서도 M 단축키는 유지');
await call('Emulation.setDeviceMetricsOverride',{width:430,height:800,deviceScaleFactor:1,mobile:true});await screen('profile-sound-mobile');
await key('KeyM','m');await wait('__rms()>0.001');await key('Escape','Escape');
await wait('getComputedStyle(document.getElementById("sound-controls")).visibility==="visible"');
// 숨김 상태에서 오디오 시계가 멎고 복귀하면 같은 곡이 이어지는지 확인한다.
await ev(`Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))`);
await wait('__audioContexts[0].state==="suspended"');
const pausedTime=await ev('__audioContexts[0].currentTime');await new Promise(r=>setTimeout(r,120));
assert.equal(await ev('__audioContexts[0].currentTime'),pausedTime,'숨긴 탭의 오디오 시계가 멈춘다');
await ev(`Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))`);
await wait('__audioContexts[0].state==="running" && __rms()>0.001');
assert.ok(Math.abs(await ev('__audioSources.findLast(s=>s.loop).buffer.duration')-41.73913)<.001,'탭 복귀 후에도 도착곡 유지');
await press('#sound-toggle');
await ev(`Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))`);
await wait('__audioContexts[0].state==="suspended"');
await ev(`Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))`);
assert.equal(await ev('document.getElementById("sound-toggle").getAttribute("aria-pressed")'),'false','복귀해도 음소거 유지');
await key('KeyM','m');await wait('__rms()>0.001');
for(let i=0;i<8;i++)await key('KeyM','m');
await wait('__rms()>0.001');assert.equal(await ev('__audioContexts.length'),1,'연속 토글에도 컨텍스트 하나');
await load('?theme=circus');
await ev(`window.renderAttempts=0;
 const render=OfflineAudioContext.prototype.startRendering;
 OfflineAudioContext.prototype.startRendering=function(){
   renderAttempts++;
   return this.length>44100 ? Promise.reject(new Error('검수용 테마곡 합성 실패')) : render.call(this);
 };`);
await press('#start');
await wait('document.getElementById("sound-toggle").disabled');
const attempts=await ev('renderAttempts');
await ev('document.getElementById("clear").classList.add("on")');
await new Promise(r=>setTimeout(r,100));
assert.equal(await ev('renderAttempts'),attempts,'재생 불가 상태에서 다음 곡을 시작하지 않는다');
assert.deepEqual(errors,[],'런타임 예외 없음');
writeFileSync(join(out,'audio-report.json'),JSON.stringify(audioReport,null,2)+'\n');
console.log('PASS 타이틀 무음·실제 오디오 출력·음소거/M·중복 방지·세 테마 합성·모바일·직행·클리어/전송/도착');
console.log(JSON.stringify(audioReport));
} finally {ws.close();await server.close();}
