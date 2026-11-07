// shot.py 전용 Chrome. 검수 설정은 이 프로세스의 디버깅 파이프로만 전달한다.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const [chrome, profile, url, width, height, output] = process.argv.slice(2);
const config = JSON.parse(readFileSync(0, 'utf8'));

const browser = spawn(chrome, [
  '--headless=new', '--remote-debugging-pipe', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--hide-scrollbars', '--log-level=3', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + profile,
], { stdio: ['ignore', 'ignore', 'inherit', 'pipe', 'pipe'] });
let id = 0, sessionId, received = '';
const pending = new Map();
const call = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject });
  browser.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
});
let budgetExpired;
const elapsed = new Promise(resolve => { budgetExpired = resolve; });
browser.stdio[4].setEncoding('utf8').on('data', chunk => {
  received += chunk;
  let end;
  while ((end = received.indexOf('\0')) >= 0) {
    const message = JSON.parse(received.slice(0, end));
    received = received.slice(end + 1);
    if (message.method === 'Emulation.virtualTimeBudgetExpired') budgetExpired();
    const request = pending.get(message.id);
    if (!request) continue;
    pending.delete(message.id);
    if (message.error) request.reject(Error(message.error.message));
    else request.resolve(message.result);
  }
});
const closed = new Promise((_, reject) => {
  browser.once('error', reject);
  browser.once('exit', code => reject(Error('검수용 Chrome 종료: ' + code)));
});
async function capture() {
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  ({ sessionId } = await call('Target.attachToTarget', { targetId, flatten: true }));
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: false,
  });
  await call('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__arcadeQAConfig = ${JSON.stringify(config)};`,
  });
  const nav = await call('Page.navigate', { url });
  if (nav.errorText) throw Error(nav.errorText);
  // 장면·검수 코드까지 실행된 뒤 가상 시간을 흘려 예약된 연출을 찍는다.
  const ready = await call('Runtime.evaluate', { awaitPromise: true, expression: `new Promise((resolve, reject) => {
    const check = () => {
      if (document.querySelector('canvas.shown,canvas.shown-now')) resolve();
      else if (document.querySelector('#intro-help:not([hidden])')) reject(Error(document.querySelector('#intro-help').textContent));
      else setTimeout(check, 50);
    };
    check();
  })` });
  if (ready.exceptionDetails) throw Error(ready.exceptionDetails.exception?.description || ready.exceptionDetails.text);
  await call('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: 20000 });
  await elapsed;
  // 캡처 프레임에서 실행되는 rAF가 전송 창을 열 수 있어 먼저 한 프레임을 그린다.
  await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  // 가상 시간이 끝난 직후에는 Chrome이 창의 CSS 등장 효과를 아직 그리지 않을 수 있다.
  await call('Runtime.evaluate', { expression: `document.querySelectorAll('dialog[open]').forEach(dialog => {
    for (const animation of dialog.getAnimations({ subtree: true })) animation.finish();
  })` });
  const { data } = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(output, Buffer.from(data, 'base64'));
}
const timeout = setTimeout(() => browser.kill(), 60000);
try {
  await Promise.race([capture(), closed]);
} finally {
  clearTimeout(timeout);
  browser.kill();
}
