// 눈높이·점프·역스크롤·일몰/월출과 보너스 중복 회귀를 잡는다.
import assert from 'node:assert/strict';
// 주행 계산은 DOM 없는 모듈이라 그대로 불러온다
import {stageState, bodyState, skyState, tumbleweedState, cactusLayout, storyState, trexClickState, birdClickState, stegoClickState} from '../src/themes/dino-model.js';
const state=stageState, body=bodyState;
const events={tumble:tumbleweedState,cacti:cactusLayout,story:storyState};
const reactions={trex:trexClickState,bird:birdClickState,stego:stegoClickState};
assert.deepEqual(Object.values(reactions).map(fn=>typeof fn),['function','function','function'],'세 캐릭터의 단계별 클릭 상태 필요');
assert.ok(reactions.trex(.1).scaleY<1&&reactions.trex(.1).y===0,'티렉스 준비 압축');
assert.ok(reactions.trex(.43).y>.9,'티렉스 점프 정점');
assert.ok(reactions.trex(.78).scaleY<.9&&reactions.trex(.78).y===0,'착지는 바닥에서 압축');
assert.equal(reactions.trex(1).scaleY,1);assert.equal(reactions.trex(1).y,0);
assert.ok(reactions.bird(.32).y>2.3,'익룡 힘찬 상승');
assert.ok(Math.abs(reactions.bird(.55).x)>.25,'익룡 곡선 복귀');
assert.equal(reactions.bird(1).x,0);assert.equal(reactions.bird(1).y,0);assert.equal(reactions.bird(1).bank,0);
assert.ok(reactions.stego(.2).head>.8,'스테고 고개 돌리기');
assert.ok(reactions.stego(.4).foot>.8,'스테고 앞발 들기');
assert.ok(reactions.stego(.55).stomp>.7,'스테고 앞발 쿵');
assert.ok(Math.abs(reactions.stego(.72).tail)>.3,'스테고 꼬리 흔들기');
assert.deepEqual(reactions.stego(1),{head:0,foot:0,stomp:0,tail:0});
assert.equal(typeof events.tumble,'function','회전초 이동 상태 필요');
assert.equal(events.cacti(1).length,2,'두 번째 장애물은 두 선인장 묶음');
assert.equal(events.cacti(3).length,2);
assert.equal(events.cacti(1)[0].x,events.cacti(1)[1].x,'선인장 쌍은 같은 레인');
assert.ok(events.cacti(1)[0].z>events.cacti(1)[1].z,'진행 방향으로 앞뒤 배치');
const weedP=.247741935483871;
assert.equal(state(weedP).jump,0,'길 옆 회전초 때문에 점프하지 않음');
for(let p=0;p<=1;p+=.01)for(let i=0;i<3;i++)assert.ok(Math.abs(events.tumble(p,i).x)-.6>3.6,'회전초 전체가 길 밖에 있음');
assert.notEqual(events.tumble(.15,0).rotation,events.tumble(.30,0).rotation,'길 옆에서 굴러가는 장식');
assert.equal(events.story(0).chapter,'together');assert.equal(events.story(.5).chapter,'away');
assert.equal(events.story(.94).chapter,'reveal');assert.equal(events.story(.94).contact,1);
assert.equal(events.story(.5).contact,0,'역스크롤 시 결승 접촉 자세 해제');
assert.equal(events.story(.82).offer,0,'결승 접근 전 꽃이 나오지 않음');
assert.equal(events.story(.94).offer,1,'커플 앞에서 꽃을 완전히 내밈');
assert.equal(events.story(.5).offer,0,'역스크롤하면 꽃 내밀기도 복원');
assert.equal(typeof body,'function','전신과 눈높이를 함께 계산하는 주행 상태가 필요합니다.');
assert.equal(body(0,false).pose,'idle');
assert.equal(body(.08,true).pose,'run1','걸음 프레임은 이동 거리로 결정');
assert.equal(body(.08,false).pose,'idle','멈추면 자기 달리기도 정지');
assert.ok(Math.abs(body(0,false).eyeY-2.1175)<1e-8,'모형의 실제 눈높이');
const duck=body(.3493548387096774,true);
assert.match(duck.pose,/^duck/,'익룡 앞 자동 숙이기 복원');
assert.ok(Math.abs(duck.eyeY-1.1275)<1e-7);
assert.ok(Math.abs(body(.3493548387096774,true,true).eyeY-1.771)<1e-7,'모션 감소에서는 자동 숙이기 폭 축소');
assert.ok(Math.abs(body(.1896774193548387,true).eyeY-3.9175)<1e-7);
assert.ok(Math.abs(body(.1896774193548387,true,true).eyeY-2.4975)<1e-7,'모션 감소는 상승 폭을 줄임');
assert.equal(body(1,false).visible,false,'클리어 때 자기 몸이 화면에서 빠짐');
assert.equal(body(1,false).bodyY,-3.2);
for(const value of [-1,0,NaN,Infinity]) assert.equal(state(value).z,6,'잘못된 진행률은 출발 위치');
assert.equal(state(2).z,-118,'범위를 넘겨도 결승에서 정지');
assert.equal(state(.95).cleared,false);
assert.equal(state(.951).cleared,true);
assert.equal(state(0).collected,0);
assert.equal(state(.30).collected,1);
assert.equal(state(.55).collected,2);
assert.equal(state(1).collected,3);
assert.equal(state(.30).collected,1,'역스크롤은 획득 수 복원');
assert.ok(state(.1896774193548387).jump>.99,'첫 선인장 꼭대기에서 점프');

assert.equal(state(.03).jump,0);

assert.equal(state(1).jump,0);

assert.equal(state(1).finish,1,'클리어 전에 전경 하차 완료');
assert.equal(state(.3).night,0);
assert.equal(state(.7).night,1);
assert.equal(state(1).night,1,'후반은 달이 뜬 밤으로 유지');
for(let p=-.1;p<=1.1;p+=.003){
  const s=state(p);
  assert.ok(Number.isFinite(s.z)&&s.z>=-118&&s.z<=6);
  assert.ok(s.jump>=0&&s.jump<=1);
  assert.ok(s.collected>=0&&s.collected<=3&&s.night>=0&&s.night<=1);
}
const sky=skyState;
assert.equal(typeof sky,'function','스크롤 기반 해·달 상태 필요');
assert.equal(sky(0).sunY,26);assert.ok(sky(.55).sunY<0);
assert.ok(sky(0).moonY<0);assert.ok(sky(.9).moonY>20);
for(let p=0;p<1;p+=.01){
  assert.ok(sky(p+.01).sunY<=sky(p).sunY+1e-8,'스크롤할수록 해가 내려감');
  assert.ok(sky(p+.01).moonY>=sky(p).moonY-1e-8,'스크롤할수록 달이 올라감');
  assert.ok(sky(p+.01).night>=sky(p).night-1e-8);
}
assert.deepEqual(sky(.3),sky(.3),'역스크롤과 정지에서도 같은 진행률은 같은 하늘');
console.log('PASS 자동 숙이기·눈높이·걸음 정지·자동 점프·보너스·역스크롤·일몰/월출');
