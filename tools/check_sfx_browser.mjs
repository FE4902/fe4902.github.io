// 별도 Chrome 9336에서 실제 Web Audio 출력·중복·음소거를 검사한다.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {devServer,qaNavigator} from './dev-server.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await devServer();
const instrument=`
const Native=AudioContext;window.sources=[];
window.AudioContext=class extends Native{constructor(...a){super(...a);window.ctx=this;}createBufferSource(){const s=super.createBufferSource();sources.push(s);return s;}};
const stop=AudioBufferSourceNode.prototype.stop;
AudioBufferSourceNode.prototype.stop=function(...args){this.stopped=true;return stop.apply(this,args);};
const connect=AudioNode.prototype.connect;
AudioNode.prototype.connect=function(dest,...a){if(dest===this.context.destination&&this.context instanceof Native){window.meter=this.context.createAnalyser();meter.fftSize=512;connect.call(this,meter);connect.call(meter,dest);return dest;}return connect.call(this,dest,...a);};
window.rms=()=>{const d=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(d);return Math.sqrt(d.reduce((s,x)=>s+x*x,0)/d.length);};`;
const target=(await(await fetch('http://127.0.0.1:9336/json/list')).json()).find(t=>t.type==='page');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async expression=>{for(let i=0;i<150;i++){if(await ev(expression))return;await sleep(200);}throw Error('시간 초과: '+expression);};
const pressM=async()=>{await call('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyM',key:'m',windowsVirtualKeyCode:77});await call('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyM',key:'m',windowsVirtualKeyCode:77});};
try {
 await call('Page.enable');
 await call('Runtime.enable');
 await call('Page.addScriptToEvaluateOnNewDocument',{source:instrument});
 await call('Page.navigate',{url:server.url+'?theme=circus&p=.03'});await wait('document.getElementById("start")?.disabled===false');
 assert.equal(await ev('!!document.getElementById("sound-controls")'),true,'본편 사운드 컨트롤');
 await ev('import("/src/audio/index.js").then(m=>window.arcadeBgm=m.audio)');
 if(!process.argv.includes('--integration')) {
 assert.equal(await ev('typeof arcadeBgm.sfx'),'function','동작 효과음 API가 있어야 한다');
 assert.equal(await ev('arcadeBgm.sfx("jump","circus")'),false,'입력 전 무음');
 await call('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyM',key:'m',windowsVirtualKeyCode:77});
 await call('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyM',key:'m',windowsVirtualKeyCode:77});await sleep(500);
 await ev('arcadeBgm.scene("silent")');await sleep(100);
 const preview=[],newPreview=[];
 const newEffects=[['start','circus',.24],['fire','circus',.32],['land','circus',.2],['splash','antarctic',.3],['flag','antarctic',.42],['duck','dino',.16],['heart','dino',.24],['droop','dino',.48],['noise','arrival',.7],['prompt','arrival',.18],['log','arrival',.045],['accept','arrival',.2],['refuse','arrival',.36],['force','arrival',.3],['travel','arrival',2.2],['travel-short','arrival',.7],['arrive','arrival',.54]];
 for(const [kind,theme,duration] of newEffects){
   assert.equal(await ev(`arcadeBgm.sfx('${kind}','${theme}')`),true,kind+' 새 효과음');
   await sleep(25);assert.ok(await ev('rms()')>.0001,kind+' 실제 출력');
   const rendered=await ev('({rate:ctx.sampleRate,data:Array.from(sources.at(-1).buffer.getChannelData(0))})');
   assert.ok(Math.abs(rendered.data.length/rendered.rate-duration)<.002,kind+' 연출 길이');
   assert.ok(rendered.data.every(Number.isFinite)&&rendered.data.every(v=>Math.abs(v)<.5),kind+' 유효 파형·피크');
   newPreview.push(rendered);await sleep(duration*1000+40);
 }

 for(const theme of ['circus','antarctic','dino','arrival']){
  for(const kind of ['jump','click','bonus','spin','open','close','send','select','stomp']){
   assert.equal(await ev(`arcadeBgm.sfx('${kind}','${theme}')`),true);
   await sleep(25);assert.ok(await ev('rms()')>.001,`${theme}/${kind} 실제 소리`);
   const info=await ev(`(()=>{const b=sources.at(-1).buffer,d=b.getChannelData(0);let peak=0;for(const x of d)peak=Math.max(peak,Math.abs(x));return {duration:b.duration,peak};})()`);
   assert.ok(info.peak<.5&&info.duration<.7,'짧고 클리핑 없는 소리');await sleep(650);
   if((theme==='arrival'?['open','close','send']:['jump','click','bonus']).includes(kind))preview.push(await ev('({rate:ctx.sampleRate,data:Array.from(sources.at(-1).buffer.getChannelData(0))})'));
  }
 }
 for(const [name,clips] of [['sfx-preview',preview],['sfx-new-preview',newPreview]]){
 const sampleRate=clips[0].rate, samples=clips.flatMap(p=>[...p.data,...new Array(Math.round(sampleRate*.25)).fill(0)]);
 const wav=Buffer.alloc(44+samples.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);samples.forEach((v,i)=>wav.writeInt16LE(Math.round(v*.55*.7*32767),44+i*2));
 mkdirSync(join(root,'_artifacts/bgm'),{recursive:true});writeFileSync(join(root,'_artifacts/bgm',name+'.wav'),wav);
 }
 assert.equal(await ev('arcadeBgm.sfx("jump","circus");arcadeBgm.sfx("jump","circus")'),false,'연타 제한');
 await ev('document.getElementById("sound-toggle").click()');await sleep(100);
 assert.equal(await ev('arcadeBgm.sfx("bonus","dino")'),false,'음소거 중 새 효과음 금지');
 for(const [kind,theme] of newEffects)assert.equal(await ev(`arcadeBgm.sfx('${kind}','${theme}')`),false,kind+' 음소거');
 assert.ok(await ev('rms()')<.0001,'재생 중 효과음도 음소거');
 await ev('document.getElementById("sound-toggle").click()');await sleep(120);
 await ev('arcadeBgm.scene("silent");window.setTestVolume=v=>{const el=document.getElementById("sound-volume");el.value=v;el.dispatchEvent(new Event("input"));};setTestVolume(0)');
 assert.equal(await ev('arcadeBgm.sfx("jump","dino")'),false,'음량 0에서는 효과음도 없음');
 for(const [kind,theme] of newEffects)assert.equal(await ev(`arcadeBgm.sfx('${kind}','${theme}')`),false,kind+' 음량 0');
 await ev('setTestVolume(55)');await sleep(150);
 await ev('window.track=arcadeBgm.ride("circus",[-14,-32],[-20]);track(6)');
 const count=await ev('sources.length');
 await ev('track(-13);track(-15)');assert.equal(await ev('sources.length'),count+1,'점프 진입 한 번');
 await sleep(120);await ev('track(-15);track(-13);track(-15)');assert.equal(await ev('sources.length'),count+1,'정지·역스크롤은 재생 안 함');
 await ev('track(-19);track(-21)');assert.equal(await ev('sources.length'),count+2,'보너스 통과 한 번');
 await sleep(120);await ev('track(-100)');assert.equal(await ev('sources.length'),count+2,'큰 스크롤 이동은 효과음 몰아 재생 안 함');
 await ev('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))');await sleep(100);
 assert.equal(await ev('arcadeBgm.sfx("jump","dino")'),false,'숨김 탭 무음');
 assert.equal(await ev('ctx.state'),'suspended');
 for(const [kind,theme] of newEffects)assert.equal(await ev(`arcadeBgm.sfx('${kind}','${theme}')`),false,kind+' 숨김 탭');
 await ev('Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"))');
 await wait('ctx.state==="running"');await sleep(120);
 await ev('arcadeBgm.scene("limit-test")');
 assert.deepEqual(await ev('[arcadeBgm.sfx("travel"),arcadeBgm.sfx("noise"),arcadeBgm.sfx("travel-short"),arcadeBgm.sfx("arrive"),arcadeBgm.sfx("fire")]'),[true,true,true,true,false],'동시 4개 제한');
 await ev('arcadeBgm.scene("silent")');await sleep(80);assert.ok(await ev('rms()')<.0001,'장면 전환에 긴 효과음도 즉시 정지');
 }
 // 실제 테마 루프·캐릭터 콜백·도착 메뉴와 소리의 연결도 확인한다.
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const qa=`window.__sfxQA={coast:p=>{window.__qaProgress=p;for(let i=0;i<40;i++)LOOP();},step:p=>{sp=p;window.__qaProgress=p;LOOP();},react:i=>clickables[i].userData.onClick(),portal:()=>{let T=performance.now();performance.now=()=>T;const tick=toPortal();window.portalStep=ms=>{T+=ms;tick();};}};`;
 const toQA=qaNavigator(call,{sfx:{steps:1,js:qa}});
 for(const [theme,before,after,reward] of [['circus',.19,.21,.255],['antarctic',.17,.18,.28],['dino',.15,.17,.28]]){
  await call('Page.navigate',{url:await toQA(server.url+'__qa/sfx?theme='+theme+'&p=.03')});await wait('!!window.__sfxQA');
  await pressM();await wait('window.ctx?.state==="running"');await sleep(250);
  await ev('window.effectCount=()=>sources.filter(s=>s.buffer?.duration<.7).length');
  let n=await ev('effectCount()');await ev('__sfxQA.react(0)');assert.equal(await ev('effectCount()'),n+1,theme+' 캐릭터 반응에 효과음 연결');
  await sleep(150);await ev(`__sfxQA.step(${before})`);n=await ev('effectCount()');
  await ev(`__sfxQA.step(${after})`);assert.equal(await ev('effectCount()'),n+1,theme+' 실제 점프 시작');
  await sleep(150);await ev(`__sfxQA.step(${before});__sfxQA.step(${after})`);assert.equal(await ev('effectCount()'),n+1,theme+' 역스크롤 무음');
  await ev(`__sfxQA.step(${(after+reward)/2});__sfxQA.step(${reward})`);assert.equal(await ev('effectCount()'),n+(theme==='circus'?3:2),theme+' 실제 보너스 통과(서커스는 불꽃 포함)');
 }
 // 새 효과음은 실제 주행 경계에서 한 번만 나야 한다.
 const loadRide=async(theme,p=.03,motion=false,width=1280)=>{
  await call('Emulation.setDeviceMetricsOverride',{width,height:width<600?800:720,deviceScaleFactor:1,mobile:width<600});
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:motion?'no-preference':'reduce'}]});
  await call('Page.navigate',{url:await toQA(server.url+'__qa/sfx?theme='+theme+'&p='+p)});await wait('!!window.__sfxQA');
  await ev('import("/src/audio/index.js").then(m=>window.arcadeBgm=m.audio)');
  await pressM();await wait('window.ctx?.state==="running"');await sleep(150);
  await ev('window.effectCount=()=>sources.filter(s=>s.buffer?.duration<3).length');
 };
 const since=async(code)=>{await ev('window.sourceMark=sources.length');await ev(code);return ev('sources.slice(sourceMark).filter(s=>s.buffer).map(s=>s.buffer.duration)');};
 const hasDuration=(values,duration,label)=>assert.ok(values.some(d=>Math.abs(d-duration)<.002),label+' '+JSON.stringify(values));
 const edgeFailures=[];
 await loadRide('circus',.94);
 const landing=await since('__sfxQA.step(.97)');
 hasDuration(landing,.2,'클리어와 같은 프레임에 착지');
 if(await ev('sources.slice(sourceMark).find(s=>Math.abs(s.buffer?.duration-.2)<.002)?.stopped'))edgeFailures.push('팡파르가 착지음을 즉시 중단');
 for(const theme of ['circus','antarctic','dino']){
  await loadRide(theme,.03,true);
  if((await since('__sfxQA.coast(.89)')).some(d=>d<3))edgeFailures.push(theme+' 관성 중 큰 스크롤 효과음');
 }
 assert.deepEqual(edgeFailures,[],'착지음 보존 및 큰 스크롤 무음');
 // 시작 입력은 BGM 준비와 경쟁해도 유실되지 않아야 한다.
 await call('Page.navigate',{url:server.url+'?theme=circus'});await wait('document.getElementById("start")?.disabled===false');
 assert.equal(await ev('!!window.ctx'),false,'타이틀에서 오디오 준비 없음');
 await call('Input.dispatchKeyEvent',{type:'keyDown',code:'Enter',key:'Enter',windowsVirtualKeyCode:13});
 await call('Input.dispatchKeyEvent',{type:'keyUp',code:'Enter',key:'Enter',windowsVirtualKeyCode:13});
 await wait('window.ctx?.state==="running"');await sleep(250);
 hasDuration(await ev('sources.filter(s=>s.buffer).map(s=>s.buffer.duration)'),.24,'PRESS START');
 for(const input of ['click','Space','touch','wheel']){
  await call('Emulation.setDeviceMetricsOverride',{width:input==='touch'?430:1280,height:800,deviceScaleFactor:1,mobile:input==='touch'});
  await call('Page.navigate',{url:await toQA(server.url+'?theme=circus')});await wait('document.getElementById("start")?.disabled===false');
  const point=await ev('(()=>{const r=document.getElementById("start").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  if(input==='click'){
   await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
   await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  }else if(input==='Space'){
   await call('Input.dispatchKeyEvent',{type:'keyDown',code:'Space',key:' ',windowsVirtualKeyCode:32});
   await call('Input.dispatchKeyEvent',{type:'keyUp',code:'Space',key:' ',windowsVirtualKeyCode:32});
  }else if(input==='touch'){
   await call('Emulation.setTouchEmulationEnabled',{enabled:true});
   await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:210,y:600}]});
   await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:210,y:540}]});
   await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await call('Emulation.setTouchEmulationEnabled',{enabled:false});
  }else await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:600,y:400,deltaX:0,deltaY:100});
  await wait('document.getElementById("intro").hidden');await sleep(250);
  const count=await ev('sources.filter(s=>Math.abs((s.buffer?.duration||0)-.24)<.002).length');
  if(input==='click'||input==='Space')assert.equal(count,1,input+' 시작음 한 번');
  else {
   // 휠·쓸어올리기는 브라우저 오디오 정책에 따라 잠길 수 있다. 나중에 시작음을 몰아 재생하지 않는다.
   assert.ok(count<=1,input+' 시작음 중복 없음');
   await pressM();await sleep(250);
   assert.equal(await ev('sources.filter(s=>Math.abs((s.buffer?.duration||0)-.24)<.002).length'),count,input+' 늦은 시작음 없음');
  }
 }
 for(const width of [1280,430]){
  for(const [theme,before,after,duration,label] of [
   ['circus',.23,.24,.32,'불고리 화르륵'],['circus',.955,.96,.2,'시상대 착지'],
   ['antarctic',.42,.46,.3,'물범 물보라'],['antarctic',.899,.901,.42,'국기 게양'],
   ['dino',.32,.325,.16,'익룡 숙임'],['dino',.895,.9,.24,'커플 하트'],['dino',.904,.91,.48,'꽃다발 처짐']]){
   await loadRide(theme,before,false,width);
   hasDuration(await since(`__sfxQA.step(${after})`),duration,label);
   assert.equal((await since(`__sfxQA.step(${before});__sfxQA.step(${after})`)).length,0,label+' 역스크롤 재생 없음');
  }
 }
 await loadRide('dino');
 const noise=await since('__sfxQA.portal()');hasDuration(noise,.7,'전송 노이즈');
 const prompt=await since('portalStep(800)');hasDuration(prompt,.18,'시스템 창');
 const accepted=await since('document.querySelector("[data-choice=yes]").click()');
 hasDuration(accepted,.2,'수락');hasDuration(accepted,.7,'감소 모션 통로');
 hasDuration(await since('portalStep(800)'),.54,'도착');
 for(const motion of [false,true]){
  for(const reason of ['no','escape','idle']){
   await loadRide('circus',.03,motion,motion?1280:430);
   await ev('__sfxQA.portal();portalStep(800)');
   if(motion){
    hasDuration(await since('portalStep(350)'),.045,'첫 로그 줄');
    await sleep(120);assert.deepEqual(await since('portalStep(220)'),[],'질문 표시에는 로그음 없음');
   }
   let rejected;
   if(reason==='escape'){
    await ev('window.sourceMark=sources.length');
    await call('Input.dispatchKeyEvent',{type:'keyDown',code:'Escape',key:'Escape',windowsVirtualKeyCode:27});
    await call('Input.dispatchKeyEvent',{type:'keyUp',code:'Escape',key:'Escape',windowsVirtualKeyCode:27});
    rejected=await ev('sources.slice(sourceMark).filter(s=>s.buffer).map(s=>s.buffer.duration)');
   }else rejected=await since(reason==='idle'?'portalStep(20000)':'document.querySelector("[data-choice=no]").click()');
   hasDuration(rejected,.36,reason+' 붉은 경고');
   assert.equal((await since('portalStep(0)')).length,0,'경고 매 프레임 중복 없음');
   if(motion){
    for(const [ms,expectLog] of [[350,true],[220,true],[220,false],[220,false]]){
     await sleep(120);
     const sounds=await since(`portalStep(${ms})`);
     if(expectLog)hasDuration(sounds,.045,'경고 로그');
     else assert.deepEqual(sounds,[],'경고 로그 뒤 추가 소리 없음');
    }
   }
   const transfer=await since('portalStep(3000)');
   hasDuration(transfer,.3,reason+' 강제 전송');hasDuration(transfer,motion?2.2:.7,'모션에 맞는 통로 길이');
   hasDuration(await since(`portalStep(${motion?2200:700})`),.54,'디지털 공간 도착');
  }
 }
 // 새 주행 소리도 직행·대폭 이동·음소거 뒤에 밀려 나오지 않는다.
 await loadRide('dino',.92);
 assert.equal((await since('__sfxQA.step(.93)')).length,0,'직행한 하트·처짐 재생 없음');
 await loadRide('circus');
 assert.equal((await since('__sfxQA.step(.8)')).length,0,'큰 이동에서 불꽃·보너스 몰아 재생 없음');
 await loadRide('circus',.23);await pressM();
 assert.equal((await since('__sfxQA.step(.24)')).length,0,'음소거 중 불꽃 없음');
 await pressM();await sleep(100);
 assert.equal((await since('__sfxQA.step(.23);__sfxQA.step(.24)')).length,0,'음소거 때 지나간 불꽃 재생 없음');
 await loadRide('dino');
 await ev('__sfxQA.portal();portalStep(800)');await wait('document.getElementById("system").open');
 await ev('document.querySelector("[data-choice=yes]").click();portalStep(2300)');await wait('document.body.dataset.portal==="ended"');await sleep(250);
 await ev(`document.querySelector('[data-orb="2"]').addEventListener('click', e => e.preventDefault(), { once: true })`);
 for(const selector of ['[data-orb="0"]','#profile-window .window-close','[data-orb="1"]','.slot[data-item="1"]','#projects-window .window-close','[data-orb="2"]']){
  const n=await ev('effectCount()');await ev(`document.querySelector(${JSON.stringify(selector)}).click()`);await sleep(150);
  assert.equal(await ev('effectCount()'),n+1,'도착 메뉴 효과음: '+selector);
 }
 assert.deepEqual(errors,[],'브라우저 런타임 예외 없음');
 console.log('PASS 필수 연출·시작 입력·수락/거절/Esc/무응답·감소/일반 모션·데스크톱/모바일·직행/큰 이동');
 if(!process.argv.includes('--integration'))console.log('PASS 테마별 실제 효과음 출력·피크·연타 제한·음소거·점프/보너스 경계·정지/역스크롤·숨김 탭');
 console.log('PASS 세 테마 루프·캐릭터 콜백·도착 메뉴 연결');
} finally {ws.close();await server.close();}
