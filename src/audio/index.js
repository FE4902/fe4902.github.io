export const audio = { init };

// 시작 입력 전에는 컨텍스트·버퍼를 만들지 않는다.
function init() {
  // 원곡 주선율 + 직접 편성한 8bit 반주. 음표 길이는 4분음표=1.
  const patrol = [
    'G4 G4 G4:.5 F#4:.5 G4:.5 A4:.5', 'B4 B4 B4:.5 A#4:.5 B4:.5 C5:.5',
    'D5 D5 D5:.5 C#5:.5 D5:.5 G5:.5', 'D5:3 B4',
    'C5 C5:.5 B4:.5 A4 C5', 'B4 B4:.5 A4:.5 G4 B4',
    'A4 E4 F#4 G4', 'A4:3 D4:.333333 E4:.333333 F#4:.333334',
    'G4 G4 G4:.5 F#4:.5 G4:.5 A4:.5', 'B4 B4 B4:.5 A#4:.5 B4:.5 C5:.5',
    'D5 D5 D5:.5 C#5:.5 D5:.5 G5:.5', 'D5:3 G4',
    'E5 D5 C5 B4', 'A4 G4 F#4 G4', 'A4 B4:.5 C5:.5 B4 A4', 'G4 D4:.5 E4:.5 F#4:.5 G4:.5 A4:.5 B4:.5',
    'C5 C5 C5 C5', 'C5:.5 B4:.5 C5:2 C#5', 'D5 D5 D5:.5 C5:.5 B4:.5 C5:.5', 'D5:3 B4',
    'C5 C5 C5 C5', 'C5:.5 B4:.5 C5:2 C#5', 'D5 D5 D5:.5 C5:.5 B4:.5 C5:.5', 'D5:3 D5',
    'E5 E5 G5:1.5 E5:.5', 'D5 D5 D5:.5 C5:.5 B4', 'C5 C5 F#4 C5', 'B4 B4 B4:.5 A4:.5 G4',
    'E5 E5 G5:1.5 E5:.5', 'D5 D5 D5:.5 C5:.5 B4', 'C5 C5 F#4 A4', 'G4:3 R',
  ];
  const skaters = [
    'C#5:3', 'E5:2 F#5', 'F#5:3', 'F#5:3', 'D5:3', 'F#5:2 G#5', 'G#5:3', 'G#5:3',
    'B5:3', 'A5:2 C#5', 'E5:3', 'D5:2 C#5', 'C#5:3', 'B4:3', 'A4:3', 'A4 R:2',
    'E5:.5 A5:.5 F#5:.5 A5:.5 E5:.5 A5:.5', 'F#5:.5 A5:.5 E5:.5 A5:.5 F#5:.5 A5:.5',
    'E5 G#5:.5 R:.5 G#5:.5 R:.5', 'E5 G#5:.5 R:.5 G#5:.5 R:.5',
    'E5:.5 B5:.5 F#5:.5 B5:.5 E5:.5 B5:.5', 'F#5:.5 B5:.5 E5:.5 B5:.5 F#5:.5 B5:.5',
    'E5 A5:.5 R:.5 A5:.5 R:.5', 'E5 A5:.5 R:.5 A5:.5 R:.5',
    'E5:.5 A5:.5 F#5:.5 A5:.5 E5:.5 A5:.5', 'F#5:.5 A5:.5 E5:.5 A5:.5 F#5:.5 A5:.5',
    'E5 G#5:.5 R:.5 G#5:.5 R:.5', 'E5 G#5:.5 R:.5 G#5:.5 R:.5',
    'G#5:.5 A5:.5 G#5:.5 A5:.5 G#5:.5 A5:.5', 'G#5:.5 A5:.5 G#5:.5 A5:.5 G#5:.5 A5:.5',
    'G#5:.5 A5:.5 G#5:.5 A5:.5 G#5:.5 A5:.5', 'G#5:.5 A5:.5 G#5:.5 A5:.5 G#5:.5 B5:.5',
  ];
  const dino = [
    'E4:.5 R:.5 E5:.5 D5:.5 B4 E4', 'G4:.5 A4:.5 B4 E5:.5 D5:.5 B4',
    'E4:.5 R:.5 G5:.5 E5:.5 D5 B4', 'A4:.5 B4:.5 D5 B4:.5 A4:.5 G4',
    'C5:.5 R:.5 E5:.5 G5:.5 E5 D5', 'C5:.5 B4:.5 A4 G4:.5 E4:.5 G4',
    'D5:.5 R:.5 F#5:.5 E5:.5 D5 A4', 'B4:.5 A4:.5 F#4 B4:.5 D#5:.5 B4',
    'E5:.5 B4:.5 E5:.5 G5:.5 E5 D5', 'B4:.5 G4:.5 B4 D5:.5 E5:.5 G5',
    'E5:.5 R:.5 D5:.5 B4:.5 G4 B4', 'A4:.5 B4:.5 D5 E5:.5 D5:.5 B4',
    'G5:.5 E5:.5 C5 E5:.5 D5:.5 C5', 'A4:.5 C5:.5 E5 G5:.5 E5:.5 D5',
    'F#5:.5 D5:.5 A4 D5:.5 E5:.5 F#5', 'B4 D#5 E5 R',
  ];
  const chords = {
    G: ['G2','D3','B3','D4'], D: ['D3','A2','F#3','C4'], A: ['A2','E3','C#4','E4'],
    C: ['C3','G2','E4','G4'], Am: ['A2','E3','C4','E4'], Em: ['E3','B2','G3','B3'],
    F: ['F2','C3','A3','C4'], E: ['E3','B2','G#3','D4'], B: ['B2','F#3','D#4','F#4'],
    Fsm: ['F#2','C#3','A3','C#4'], Csm: ['C#3','G#2','E4','G#4'], Dim: ['D#3','A2','F#3','C4'],
  };
  const scores = {
    circus: { bpm: 180, meter: 4, bars: patrol, harmony: 'G G G G D G A D G G G G C Am D G D D G G D D G G C G Dim Em C G D G'.split(' '), voice: 'pulse', level: .17 },
    antarctic: { bpm: 210, meter: 3, bars: skaters, harmony: 'A A D D D E E E E A A D A E A A A A E E E E A A A A E E E E E E'.split(' '), voice: 'square', level: .13 },
    dino: { bpm: 156, meter: 4, bars: dino, harmony: 'Em Em Em D C Am D B Em Em Em D C Am D B'.split(' '), voice: 'pulse', level: .16 },
    arrival: { bpm: 92, meter: 4, voice: 'triangle', level: .16,
      bars: ['E5:2 G5 B5','A5:2 E5:2','G5:2 E5 D5','B4:3 R','C5:2 E5 G5','E5:2 D5:2','D5:2 G5 F#5','E5:3 R',
        'G5:2 B5 D6','C6:2 B5 A5','G5:2 E5:2','D5:3 R','E5:2 G5 E5','C5:2 E5:2','D5:2 B4 D5','E5:3 R'],
      harmony: 'C Am Em G C Am D Em C Am Em G C Am D Em'.split(' ') },
    clear: { bpm: 240, meter: 4, voice: 'pulse', level: .15, once: true,
      bars: ['C5:.5 E5:.5 G5:.5 C6:2 R:.5'], harmony: ['C'] },
  };
  const hz = name => {
    const [, letter, sharp, octave] = /^([A-G])(#?)(\d)$/.exec(name);
    const midi = (Number(octave) + 1) * 12 + {C:0,D:2,E:4,F:5,G:7,A:9,B:11}[letter] + (sharp ? 1 : 0);
    return 440 * 2 ** ((midi - 69) / 12);
  };
  const buffers = new Map();
  // 한 바퀴를 미리 합성해 GPU 부하·프레임률과 독립적으로 반복한다.
  async function render(key) {
    const song = scores[key], beat = 60 / song.bpm, duration = song.bars.length * song.meter * beat;
    const offline = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, Math.ceil(duration * 44100), 44100);
    const filter = offline.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = key === 'arrival' ? 2600 : 5200;
    filter.Q.value = .4; filter.connect(offline.destination);
    const real = new Float32Array(33), imag = new Float32Array(33);
    for (let n = 1; n < 33; n++) { real[n] = Math.sin(2 * Math.PI * n * .25) / (Math.PI * n); imag[n] = (1 - Math.cos(2 * Math.PI * n * .25)) / (Math.PI * n); }
    const pulse = offline.createPeriodicWave(real, imag);
    const note = (pitch, at, length, voice, volume) => {
      if (pitch === 'R') return;
      const start = at * beat, end = Math.min(duration, start + length * beat * .88);
      const osc = offline.createOscillator(), gain = offline.createGain();
      if (voice === 'pulse') osc.setPeriodicWave(pulse); else osc.type = voice;
      osc.frequency.value = hz(pitch);
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .004);
      gain.gain.setValueAtTime(volume * .75, Math.max(start + .005, end - .025)); gain.gain.linearRampToValueAtTime(0, end);
      osc.connect(gain); gain.connect(filter); osc.start(start); osc.stop(end + .001);
    };
    song.bars.forEach((bar, i) => {
      let pos = i * song.meter;
      for (const token of bar.split(' ')) { const [pitch, len] = token.split(':'); const n = Number(len || 1); note(pitch, pos, n, song.voice, song.level); pos += n; }
      if (Math.abs(pos - (i + 1) * song.meter) > .00001) throw Error(`BGM 박자 확인: ${key} ${i + 1}`);
      const chord = chords[song.harmony[i]], base = i * song.meter, quiet = key === 'arrival';
      note(chord[0], base, quiet ? 1.5 : .7, 'triangle', quiet ? .10 : .23);
      if (song.meter === 4) note(chord[1], base + 2, .7, 'triangle', quiet ? .08 : .18);
      for (const b of song.meter === 3 ? [1,2] : [1,3]) {
        note(chord[2], base + b, quiet ? .75 : .38, quiet ? 'triangle' : 'pulse', quiet ? .055 : .035);
        note(chord[3], base + b + (quiet ? .25 : 0), quiet ? .5 : .38, quiet ? 'triangle' : 'pulse', quiet ? .045 : .025);
      }
      if (key === 'dino') for (let b = 0; b < 4; b += .5) note(chord[b % 1 ? 1 : 0], base + b, .18, 'triangle', .10);
    });
    return offline.startRendering();
  }
  function bufferFor(key) {
    if (!buffers.has(key)) buffers.set(key, render(key).catch(error => { buffers.delete(key); throw error; }));
    return buffers.get(key);
  }

  const button = document.getElementById('sound-toggle'), controls = document.getElementById('sound-controls');
  const volumeInput = document.getElementById('sound-volume'), level = document.getElementById('sound-level');
  let volume = .55, previousVolume = .55;
  const intro = document.getElementById('intro'), clear = document.getElementById('clear');
  const Audio = window.AudioContext || window.webkitAudioContext;
  let context, master, current, active = false, enabled = true, wanted = 'silent', offset = 0, revision = 0, finished = false, failed = false;
  const available = Audio && (window.OfflineAudioContext || window.webkitOfflineAudioContext);
  // 테마별 짧은 합성음. 상대 음량은 별도로, 사용자 음량·음소거는 BGM과 함께 적용한다.
  const sfxLevel = .7, sfxBuffers = new Map(), voices = new Set(), lastEffect = new Map();
  let effectRevision = 0;
  const timbres = {
    circus: { wave: 'pulse', pitch: 1, jump: [240, 880, .18], click: [660, 330, .12] },
    antarctic: { wave: 'triangle', pitch: 1.25, jump: [480, 1080, .14], click: [940, 470, .12] },
    dino: { wave: 'square', pitch: .8, jump: [210, 610, .11], click: [400, 180, .09] },
    arrival: { wave: 'triangle', pitch: 1, jump: [400, 900, .16], click: [880, 660, .1] },
  };
  function effectBuffer(kind, theme) {
    const key = `${theme}:${kind}`;
    if (sfxBuffers.has(key)) return sfxBuffers.get(key);
    const tone = timbres[theme], p = tone.pitch;
    const notes = {
      jump: [tone.jump], click: [tone.click],
      spin: [[330, 990, .13], [990, 440, .13], [440, 1320, .15]],
      bonus: [[660 * p, 660 * p, .065], [880 * p, 880 * p, .065], [1320 * p, 1320 * p, .13]],
      open: [[523, 523, .06], [784, 784, .11]],
      close: [[660, 660, .05], [392, 392, .09]],
      send: [[330, 1760, .28]], select: [[1046, 784, .065]],
      stomp: [[130, 48, .2]],
      start: [[440 * p, 440 * p, .06], [660 * p, 660 * p, .06], [880 * p, 1320 * p, .12]],
      fire: [[180, 780, .12, .75], [780, 110, .2, .9]],
      land: [[155, 58, .13], [220, 145, .07]],
      splash: [[1350, 360, .12, .75], [740, 1280, .08, .4], [580, 260, .1, .65]],
      flag: [[660, 660, .12], [880, 880, .12], [1320, 1320, .18]],
      duck: [[420, 85, .16, .2]],
      heart: [[660 * p, 660 * p, .09], [990 * p, 990 * p, .15]],
      droop: [[440 * p, 330 * p, .16], [330 * p, 220 * p, .16], [220 * p, 110 * p, .16]],
      noise: [[95, 680, .22, .85], [680, 130, .18, 1], [160, 60, .3, .8]],
      prompt: [[392, 784, .06], [1046, 1046, .12]],
      log: [[1500, 1100, .045]],
      accept: [[784, 784, .07], [1175, 1568, .13]],
      refuse: [[220, 196, .12], [220, 196, .12], [165, 110, .12]],
      force: [[110, 220, .1], [220, 440, .1], [440, 880, .1]],
      travel: [[90, 1400, 2.2, .28]],
      'travel-short': [[180, 1200, .7, .2]],
      arrive: [[523, 523, .12], [784, 784, .12], [1046, 1046, .3]],
    }[kind];
    if (!notes) return null;
    const rate = context.sampleRate, length = notes.reduce((sum, n) => sum + n[2], 0);
    const buffer = context.createBuffer(1, Math.ceil(length * rate), rate), data = buffer.getChannelData(0);
    let offset = 0, seed = 173;
    for (const [from, to, duration, grain = 0] of notes) {
      const count = Math.floor(duration * rate); let phase = 0;
      for (let i = 0; i < count; i++) {
        const u = i / count, seconds = i / rate;
        // 작은 음정 계단으로 미끄러지는 옛 아케이드 음색.
        const step = Math.floor(u * 24) / 24, freq = from * (to / from) ** step;
        phase += freq / rate;
        let value = 0;
        for (let harmonic = 1; harmonic <= 7; harmonic++) {
          if (freq * harmonic >= rate / 2) break;
          const coefficient = tone.wave === 'pulse' ? Math.sin(harmonic * Math.PI / 4) / harmonic
            : harmonic % 2 === 0 ? 0 : tone.wave === 'triangle' ? (-1) ** ((harmonic - 1) / 2) / (harmonic * harmonic) : 1 / harmonic;
          value += Math.sin(phase * Math.PI * 2 * harmonic) * coefficient;
        }
        const envelope = Math.min(1, seconds / .004, (duration - seconds) / .018) * (1 - u * .45);
        // 불·물·전송은 짧은 디지털 잡음을 섞고 테마의 기본 음색을 남긴다.
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const noise = seed / 2147483648 - 1;
        data[offset + i] = (value * (1 - grain * .65) + noise * grain) * envelope * .22;
      }
      offset += count;
    }
    sfxBuffers.set(key, buffer); return buffer;
  }
  function stopEffects(immediate = false) {
    effectRevision++;
    for (const voice of voices) {
      const now = context.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(immediate ? 0 : voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + .012);
      voice.node.stop(immediate ? now : now + .015);
    }
    voices.clear(); lastEffect.clear();
  }
  function sfx(kind, theme = document.body.dataset.theme) {
    if (!active || !enabled || volume === 0 || failed || document.hidden || context?.state !== 'running') return false;
    theme = timbres[theme] ? theme : 'arrival';
    const now = context.currentTime, key = `${theme}:${kind}`;
    if (now - (lastEffect.get(key) ?? -Infinity) < .09 || voices.size >= 4) return false;
    try {
      const buffer = effectBuffer(kind, theme); if (!buffer) return false;
      const node = context.createBufferSource(), gain = context.createGain(), voice = { node, gain };
      node.buffer = buffer; node.connect(gain); gain.gain.value = sfxLevel; gain.connect(master);
      node.onended = () => { voices.delete(voice); node.disconnect(); gain.disconnect(); };
      voices.add(voice); lastEffect.set(key, now); node.start(); return true;
    } catch { return false; }   // 소리 실패는 주행·클릭을 막지 않는다.
  }
  // 최전방 위치를 기준으로 한 번만 울린다. 직행·큰 스크롤은 지난 소리를 건너뛴다.
  function rideSounds(theme, jumps, rewards, cues = []) {
    let frontier = null, previousTarget;
    return (z, targetZ = z) => {
      // End 키 등으로 건너뛴 구간은 관성으로 뒤늦게 지나가도 소리를 내지 않는다.
      if ((previousTarget ?? z) - targetZ > 12) frontier = Math.min(frontier ?? z, targetZ);
      previousTarget = targetZ;
      if (frontier === null) { frontier = z; return false; }
      if (z >= frontier) return false;
      const before = frontier; frontier = z;
      if (before - z > 12) return false;
      const crossed = at => before > at && z <= at;
      if (jumps.some(crossed)) sfx('jump', theme);
      if (rewards.some(crossed)) sfx('bonus', theme);
      for (const [kind, at] of cues) if (crossed(at)) sfx(kind, theme);
      return true;
    };
  }
  function paint() {
    const blocked = active && enabled && (!context || context.state !== 'running');
    button.dataset.sound = !available || failed ? 'unavailable' : !enabled ? 'muted' : document.hidden ? 'paused' : blocked ? 'blocked' : current ? 'playing' : 'ready';
    button.setAttribute('aria-pressed', String(!!available && !failed && enabled && volume > 0 && !blocked));
    button.setAttribute('aria-label', !available || failed ? '게임 소리 재생 불가' : !enabled || blocked || !volume ? '게임 소리 켜기 (M)' : '게임 소리 끄기 (M)');
    button.dataset.zero = String(volume === 0);
    button.querySelector('.sound-state').textContent = !available || failed ? '--' : !enabled || !volume || blocked ? 'OFF' : 'ON';
    controls.dataset.muted = String(!enabled || volume === 0);
    volumeInput.value = String(Math.round(volume * 100));
    volumeInput.setAttribute('aria-valuetext', `${Math.round(volume * 100)}%`);
    level.value = String(Math.round(volume * 100)).padStart(2, '0');
    controls.querySelectorAll('.volume-meter i').forEach((bar, i) => bar.classList.toggle('on', i < Math.ceil(volume * 10)));
    button.disabled = volumeInput.disabled = !available || failed;
  }
  function stop(remember = false) {
    if (!current) return;
    const old = current; current = null;
    if (remember) offset = (old.offset + Math.max(0, context.currentTime - old.at)) % old.node.buffer.duration;
    const now = context.currentTime;
    old.gain.gain.cancelScheduledValues(now); old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + .025); old.node.stop(now + .03);
  }
  async function play() {
    if (failed || !context || context.state !== 'running' || !active || !enabled || document.hidden || !scores[wanted] || finished || current?.key === wanted) { paint(); return; }
    const ticket = ++revision, key = wanted;
    try {
      const buffer = await bufferFor(key);
      if (ticket !== revision || key !== wanted || !enabled || document.hidden || context.state !== 'running') return;
      stop();
      const node = context.createBufferSource(), gain = context.createGain(), at = context.currentTime;
      node.buffer = buffer; node.loop = !scores[key].once; node.connect(gain); gain.connect(master);
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(1, at + .035);
      const playing = {node, gain, at, offset, key}; current = playing;
      node.onended = () => {
        node.disconnect(); gain.disconnect();
        if (current === playing) { current = null; finished = true; paint(); }
      };
      node.start(at, offset % buffer.duration); paint();
    } catch (error) {
      if (ticket !== revision) return;   // 지나간 장면의 실패는 현재 곡에 영향을 주지 않는다.
      failed = true; stop(); stopEffects(true); paint();
      console.warn('BGM을 준비하지 못했습니다.', error);
    }
  }
  function scene(key) {
    if (wanted === key) return;
    revision++; stop(); stopEffects(true); wanted = key; offset = 0; finished = false; play();
  }
  function syncScene() {
    active = intro.hidden;
    const phase = document.body.dataset.portal;
    scene(!active ? 'silent' : phase === 'ended' ? 'arrival' : document.body.classList.contains('portal-mode') ? 'portal' : clear.classList.contains('on') ? 'clear' : document.body.dataset.theme || 'silent');
    paint();
  }
  function wake() {
    if (!available || failed || !active || !enabled || document.hidden) { paint(); return; }
    try {
      if (!context) {
        context = new Audio({ latencyHint: 'playback' }); master = context.createGain(); master.gain.value = volume; master.connect(context.destination);
        context.addEventListener('statechange', () => { paint(); if (context.state === 'running') play(); });
      }
      const resumed = context.resume().then(() => { play(); return true; }).catch(() => { paint(); return false; });
      paint(); return resumed;
    } catch { failed = true; paint(); }
  }
  function setVolume(value) {
    volume = Math.max(0, Math.min(1, Number(value) / 100));
    if (volume > 0) previousVolume = volume;
    else stopEffects();
    // 음악 위치를 유지한 채 짧게 감쇠해 볼륨 변경의 클릭음을 막는다.
    if (master) master.gain.setTargetAtTime(volume, context.currentTime, .015);
    paint();
  }
  volumeInput.addEventListener('input', () => { setVolume(volumeInput.value); if (enabled) wake(); });
  function toggle() {
    if (volume === 0) { setVolume(previousVolume * 100); enabled = true; wake(); paint(); return; }
    // 휠/공유 링크로 시작했을 때 첫 누름은 재생 허용을 요청한다.
    if (active && enabled && (!context || context.state !== 'running')) wake();
    else {
      enabled = !enabled; revision++;
      if (enabled) wake(); else { stop(true); stopEffects(); }
      paint();
    }
  }
  button.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  addEventListener('keydown', e => {
    if (e.code !== 'KeyM' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input:not([type="range"]),textarea,select,[contenteditable="true"]')) return;
    e.preventDefault(); syncScene(); toggle();
  });
  const unlock = e => {
    if (!e.isTrusted || e.target.closest('#sound-controls') || e.code === 'KeyM') return;
    syncScene(); if (active) wake();
  };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock); addEventListener('touchend', unlock, {passive:true});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { revision++; stopEffects(true); context?.suspend().catch(() => {}); paint(); }
    else if (context && active && enabled) wake();
  });
  addEventListener('pagehide', () => { revision++; stopEffects(true); context?.suspend().catch(() => {}); });
  addEventListener('pageshow', () => { if (context && active && enabled) wake(); });
  const observer = new MutationObserver(syncScene);
  observer.observe(document.body, {attributes:true, attributeFilter:['class','data-theme','data-portal']});
  observer.observe(intro, {attributes:true, attributeFilter:['hidden']});
  observer.observe(clear, {attributes:true, attributeFilter:['class']});
  function start(key) {
    active = true; scene(key);
    const at = performance.now(), ticket = effectRevision;
    // 브라우저가 허용한 즉시만 시작음을 낸다. 잠금 해제까지 기다렸다 뒤늦게 재생하지 않는다.
    wake()?.then(ok => {
      if (ok && ticket === effectRevision && performance.now() - at < 200) sfx('start', key);
    });
  }
  function portal(phase, calm, forced) {
    if (phase === 'ended') return;
    scene('portal'); stopEffects(true);
    if (phase === 'noise') sfx('noise', 'arrival');
    if (phase === 'choice' || phase === 'refusal') {
      sfx(phase === 'choice' ? 'prompt' : 'refuse', 'arrival');
      if (calm) sfx('log', 'arrival');
    }
    if (phase === 'playing') {
      sfx(forced ? 'force' : 'accept', 'arrival');
      sfx(calm ? 'travel-short' : 'travel', 'arrival');
    }
  }
  Object.assign(audio, { scene, sfx, ride: rideSounds, start, portal,
    arrive: () => { scene('arrival'); sfx('arrive', 'arrival'); } });
  paint();
}
