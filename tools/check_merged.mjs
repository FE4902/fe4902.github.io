// 세 테마의 진입·최소 저장 상태·미완료 우선 진입을 검사한다.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
// 공통 흐름 모듈을 가짜 DOM 위에서 매번 새로 실행한다 (import/export 를 떼고 오디오 경계만 대체)
const flow=readFileSync(new URL('../src/flow.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
function setup(query,{cleared=[],blocked=false,raw}={}){
  const elements=new Map(),events={};
  const element=id=>{
    if(!elements.has(id))elements.set(id,{id,hidden:id!=='intro',disabled:true,dataset:{},textContent:'',innerHTML:'',setAttribute(){},addEventListener(){},classList:{remove(){}}});
    return elements.get(id);
  };
  const storage=entries=>{
    const data=new Map(entries);
    return {data,getItem(k){if(blocked)throw Error('blocked');return data.get(k)??null;},setItem(k,v){if(blocked)throw Error('blocked');data.set(k,v);},removeItem(k){if(blocked)throw Error('blocked');data.delete(k);}};
  };
  const localStorage=storage([['arcade-visited','["circus","antarctic"]']]);
  const sessionStorage=storage([['arcade-cleared',raw??JSON.stringify(cleared)]]);
  const document={body:{dataset:{},classList:{remove(){}}},getElementById:element,querySelectorAll:()=>[]};
  const location=new URL('https://local/index.html'+query);
  const history={scrollRestoration:'auto',replaceState(state,title,url){location.href=new URL(url,location.href).href;}};
  const context=vm.createContext({audio:{start(){}},URL,URLSearchParams,location,document,window:{localStorage,sessionStorage},history,Math:Object.assign(Object.create(Math),{random:()=>0}),addEventListener:(type,fn)=>events[type]=fn,scrollTo(){},setTimeout(){}});
  vm.runInContext(flow+'\nglobalThis.flow={theme,keys,completed,activateStage,startRide,onClear};',context);
  return {flow:context.flow,element,events,localStorage,sessionStorage,context};
}
// 공유 주소만 열어서는 검수 훅을 켤 수 없다.
const hook=readFileSync(new URL('./qa-hook.js',import.meta.url),'utf8');
const linked={window:{},location:{search:'?qa='+encodeURIComponent(JSON.stringify({js:'window.fromLink=true'}))},URLSearchParams};
vm.runInNewContext(hook,linked);
assert.equal(linked.window.__arcadeQA,undefined,'URL에서 검수 훅을 활성화하지 않음');
const dino=setup('?theme=dino');
assert.equal(dino.flow.theme,'dino');
assert.equal(dino.element('theme-title').textContent,'PORTFOLIO');
dino.flow.activateStage();dino.flow.startRide();
assert.deepEqual([...dino.localStorage.data],[],'방문 기록을 제거하고 다시 저장하지 않음');
assert.deepEqual([...dino.sessionStorage.data.keys()],['arcade-cleared'],'클리어 목록만 유지');
assert.equal(dino.element('ready').hidden,false,'READY는 시작 버튼의 일시적 화면');
let cleared=[];
for(const [theme,next,stage] of [['circus','antarctic','STAGE-01'],['antarctic','dino','STAGE-02'],['dino','circus','STAGE-03']]){
  const s=setup('?theme='+theme,{cleared});
  assert.equal(s.element('stage-number').textContent,stage);
  s.flow.onClear();s.flow.onClear();
  cleared=JSON.parse(s.sessionStorage.getItem('arcade-cleared'));
  assert.equal(new Set(cleared).size,cleared.length,'중복 클리어 저장 없음');
  // 도착 화면에 다음 무대 카드는 없다. 다시 들어오면 미완료 테마가 먼저 나온다 (모두 깼으면 처음부터)
  const destination=setup('',{cleared});
  assert.equal(destination.flow.theme,next,'재진입은 미완료 테마 우선');
  destination.flow.activateStage();
  assert.equal(destination.element('intro').hidden,false,'재진입은 타이틀에서 시작');
  assert.equal(destination.element('ready').hidden,true,'READY 상태를 복원하지 않음');
}
assert.deepEqual(cleared,['circus','antarctic','dino']);
const legacy=setup('?theme=dino&stage=99&cleared=circus,antarctic&ready=1#credits');
legacy.flow.activateStage();
assert.equal(legacy.context.location.search,'?theme=dino','불필요한 기존 URL 상태 제거');
assert.equal(legacy.context.location.hash,'#credits');
assert.equal(legacy.element('intro').hidden,false,'기존 ready 파라미터로 자동 시작하지 않음');
assert.equal(legacy.element('stage-number').textContent,'STAGE-01');
assert.equal(legacy.flow.completed.length,0,'URL로 클리어 기록을 주입하지 않음');
assert.equal(setup('',{cleared:['circus','antarctic']}).flow.theme,'dino','미완료 테마 우선');
assert.equal(setup('').flow.theme,'circus','과거 방문 기록은 선택에 영향 없음');
for(const raw of ['{invalid','{}','null','["circus","circus","invalid"]']){
 const s=setup('?theme=dino',{raw});s.flow.onClear();
 assert.deepEqual(JSON.parse(s.sessionStorage.getItem('arcade-cleared')),raw.startsWith('[')?['circus','dino']:['dino']);
}
const blocked=setup('?theme=invalid',{blocked:true});
assert.ok(blocked.flow.keys.includes(blocked.flow.theme));
blocked.flow.activateStage();blocked.flow.startRide();blocked.flow.onClear();
assert.ok(blocked.flow.completed.includes(blocked.flow.theme),'저장소 차단 시에도 현재 무대 완료');
const keyboard=setup('?theme=circus');
for(const code of ['Digit1','Digit2','Digit3'])keyboard.events.keydown({code,target:{closest:()=>null}});
assert.equal(keyboard.context.location.search,'?theme=circus');
assert.equal(html.includes('class="theme-select"'),false);
console.log('PASS 클리어 목록만 저장·방문 기록 제거·URL 정리·READY 비복원·미완료 우선 재진입·전체 완료·손상/차단 저장소');
