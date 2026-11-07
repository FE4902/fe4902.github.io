// 브라우저 검사용: Vite 개발 서버를 잠깐 띄우고, 검수 훅(tools/qa-hook.js) 설정을 CDP 로 넣어 준다.
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));

export async function devServer() {
  const server = await createServer({ root, logLevel: 'silent', server: { host: '127.0.0.1', port: 5320 } });
  await server.listen();
  return { url: server.resolvedUrls.local[0], close: () => server.close() };
}

// 주소의 /__qa/<이름> 은 가짜 경로: 그 이름의 검수 설정을 넣고 본편(/)으로 연다.
//   예) `${url}__qa/reduce?p=0.14` → `${url}?p=0.14` + configs.reduce
// call 은 CDP 호출 함수. 반환값으로 Page.navigate 하면 된다.
export function qaNavigator(call, configs) {
  let injected = null;
  return async href => {
    if (injected) { await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected }); injected = null; }
    const target = new URL(href), match = target.pathname.match(/^\/__qa\/([^/]+)/);
    if (match) {
      target.pathname = '/';
      const source = `window.__arcadeQAConfig = ${JSON.stringify(configs[match[1]])};`;
      injected = (await call('Page.addScriptToEvaluateOnNewDocument', { source })).identifier;
    }
    return target.href;
  };
}
