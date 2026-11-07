// 개발 서버의 검수 훅 (tools/qa-hook.js 가 켬). 배포 빌드에서는 늘 undefined
export const qa = import.meta.env.DEV ? window.__arcadeQA : undefined;
