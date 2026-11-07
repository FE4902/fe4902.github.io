"""헤드리스 Chrome 으로 pov 계열 페이지를 찍는다.

헤드리스의 함정(스크롤하면 빈 화면, 초당 1~2프레임, '움직임 줄이기' 켜짐)을 피하려고
진행률 고정·움직임 강제·고정 간격 프레임 진행을 한 뒤 찍는다.
- 본편 index.html (Vite): 개발 서버를 띄우고 검수용 Chrome에 CDP로 설정을 넘긴다.
  --server 를 주면 이미 떠 있는 개발 서버를 쓴다. --seed 로 Math.random 을 고정한다.
- 단일 HTML (index-bgm.html 등): 예전처럼 테스트 사본의 문자열을 바꿔 찍는다 (build()).

예) 저장소 루트에서
  python -I tools/shot.py index.html --theme circus --p 0.32 --out shot.webp
  python -I tools/shot.py index.html --p 0.03 --motion --steps 45 --out step.webp
  python -I tools/shot.py index.html --p 0.03 --motion --steps 45 --js "click(sideCharlie.position)" --after 15 --out click.webp

단일 HTML 은 아래 줄들을 그대로 가지고 있어야 동작한다 (AGENTS.md 6장): TARGET, SCROLL, reduce 선언, 렌더 루프 앞뒤.
--theme 으로 실행할 테마를 고른다.

--js 안에서 쓸 수 있는 도우미: scr(월드 좌표) → 화면 좌표, click(월드 좌표) → 그 위치를 클릭
--motion 은 JS 의 reduce 와 CSS 의 움직임 줄이기 규칙을 둘 다 끈다. 시간 애니메이션을 보려면 --steps N 과 함께.
이세계 전송: --p 1 --steps 10 이면 GAME CLEAR 1.5초 뒤 시스템 창까지 진행된 화면 (가상 시간 20초 안에서)
  수락 후 도착 화면: --js "setTimeout(() => document.querySelector('[data-choice=yes]').click(), 3000)"
  통로 중간: --motion 과 함께 수락 직후 performance.now 를 고정 (_docs/ARCHITECTURE.md 참고)
"""
import argparse
import contextlib
import json
import pathlib
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from urllib.parse import urlencode

CHROME = next((str(p) for p in (
    pathlib.Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    pathlib.Path(r'C:/Program Files/Google/Chrome/Application/chrome.exe'),
) if p.exists()), shutil.which('google-chrome') or shutil.which('chromium'))
TARGET = 'const target = clamp(scrollY / Math.max(1, ride.offsetHeight - innerHeight));'
SCROLL = 'scrollTo(0, p0 * (ride.offsetHeight - innerHeight)); '
LOOP_HEAD = 'renderer.setAnimationLoop(() => {'
LOOP_TAIL = '  composer.render();\n});'
# --motion: CSS 의 @media (prefers-reduced-motion) 규칙도 되돌린다 (같은 선택자를 뒤에 다시 선언해 이김)
MOTION_CSS = ('.blink{animation:blink 1s steps(1) infinite}.ending{transition:opacity .6s,visibility 0s .6s}'
              '.system-window[open]{animation:system-appear .3s ease-out both}'
              '.system-window[open] .system-line{animation:system-line .01s steps(1) both;animation-delay:calc(.34s + var(--i)*.22s)}')


def build(src: str, steps: int, after: int, js: str, motion: bool) -> str:
    for needle in (TARGET, SCROLL):
        assert needle in src, f'페이지에 필요한 줄이 없음: {needle}'
    src = src.replace(TARGET, 'const target = p0;').replace(SCROLL, '')
    if motion:
        src = src.replace('let reduce = mq.matches;', 'let reduce = false;')
        src = src.replace('</style>', MOTION_CSS + '</style>', 1)
        if not steps:
            print('주의: --motion 만으로는 헤드리스에서 시간이 거의 흐르지 않음 — --steps N 을 함께 쓸 것')
    if steps or js:
        assert LOOP_HEAD in src and LOOP_TAIL in src, '렌더 루프 형태가 예상과 다름'
        src = src.replace(LOOP_HEAD, 'clock.getDelta = () => 1 / 30;\nconst LOOP = () => {')
        src = src.replace(LOOP_TAIL, (
            '  composer.render();\n};\n'
            'const scr = w => { const v = w.clone().project(camera); return { clientX: (v.x + 1) / 2 * innerWidth, clientY: (1 - v.y) / 2 * innerHeight }; };\n'
            'const click = w => { const h = pick(scr(w)); console.log("CLICK", h ? h.object.type : "none"); h?.object.userData.onClick(h); };\n'
            f'for (let k = 0; k < {steps}; k++) LOOP();\n'
            f'{js}\n'
            f'for (let k = 0; k < {after}; k++) LOOP();\n'
            # 이세계 전송이 이미 시작됐으면 그쪽 루프를 유지한다
            "if (!document.body.classList.contains('portal-mode')) renderer.setAnimationLoop(() => composer.render());"))
    return src


ROOT = pathlib.Path(__file__).resolve().parent.parent


def is_vite_app(src: str) -> bool:
    return 'src="/src/main.js"' in src


@contextlib.contextmanager
def dev_server(url):
    """주어진 개발 서버를 쓰거나, 빈 포트에 Vite 개발 서버를 잠깐 띄운다."""
    if url:
        yield url.rstrip('/') + '/'
        return
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    proc = subprocess.Popen([str(ROOT / 'node_modules/.bin/vite'), '--port', str(port), '--strictPort', '--host', '127.0.0.1'],
                            cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f'http://127.0.0.1:{port}/'
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(base, timeout=1)
                break
            except OSError:
                time.sleep(.1)
        yield base
    finally:
        proc.terminate()
        proc.wait()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('html')
    ap.add_argument('--p', type=float, default=0.0, help='진행률 0~1')
    ap.add_argument('--steps', type=int, default=0, help='찍기 전 1/30초 단위로 진행할 프레임 수')
    ap.add_argument('--js', default='', help='steps 진행 뒤 실행할 코드 (클릭 시뮬레이션 등)')
    ap.add_argument('--after', type=int, default=0, help='js 실행 뒤 더 진행할 프레임 수')
    ap.add_argument('--motion', action='store_true', help="'움직임 줄이기'를 끈 상태로 강제")
    ap.add_argument('--size', default='1280x720')
    ap.add_argument('--out', required=True)
    ap.add_argument('--theme', choices=['circus', 'antarctic', 'dino'], help='통합 index.html의 테마')
    ap.add_argument('--seed', type=int, help='Math.random 고정 (본편 전용)')
    ap.add_argument('--server', help='이미 떠 있는 개발 서버 주소 (본편 전용, 없으면 잠깐 띄움)')
    a = ap.parse_args()

    page = pathlib.Path(a.html).resolve()
    out = pathlib.Path(a.out).resolve()
    with tempfile.TemporaryDirectory(prefix='pov-shot-') as directory:
        capture_page(a, page, out, pathlib.Path(directory))


def capture_page(a, page, out, tmp):
    src = page.read_text(encoding='utf-8')
    w, h = a.size.split('x')
    if not CHROME:
        raise SystemExit('Chrome 실행 파일을 찾을 수 없음')
    query = {'p': a.p}
    if a.theme:
        query['theme'] = a.theme
    capture = tmp / 'capture.png' if out.suffix.lower() == '.webp' else out
    chrome = [CHROME, '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars',
              f'--window-size={w},{h}', '--virtual-time-budget=20000', f'--user-data-dir={tmp / "profile"}', f'--screenshot={capture}']
    if is_vite_app(src):
        if a.motion and not a.steps:
            print('주의: --motion 만으로는 헤드리스에서 시간이 거의 흐르지 않음 — --steps N 을 함께 쓸 것')
        config = json.dumps({'steps': a.steps, 'after': a.after, 'js': a.js, 'motion': a.motion, 'seed': a.seed})
        with dev_server(a.server) as base:
            subprocess.run(['node', str(ROOT / 'tools/shot-browser.mjs'), CHROME, str(tmp / 'profile'),
                            f'{base}?{urlencode(query)}', w, h, str(capture)], input=config, text=True, check=True)
    else:
        test = tmp / page.name
        test.write_text(build(src, a.steps, a.after, a.js, a.motion), encoding='utf-8')
        subprocess.run(chrome + [f'{test.as_uri()}?{urlencode(query)}'], check=False, capture_output=True)
    if out.suffix.lower() == '.webp' and capture.exists():
        # -I 실행에서도 사용자 환경에 설치한 Pillow로 변환한다.
        convert = ("from PIL import Image; import sys; "
                   "image = Image.open(sys.argv[1]); "
                   "image.save(sys.argv[2], 'WEBP', quality=100, lossless=True, method=6, exact=True)")
        subprocess.run([sys.executable, '-c', convert, str(capture), str(out)], check=True)
    print(out if out.exists() else '스크린샷 실패')


if __name__ == '__main__':
    main()
