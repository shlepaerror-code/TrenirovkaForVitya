// ====== ШЕЙДЕРНЫЙ ФОН (WebGL) ======
(function initShader() {
  const canvas = document.getElementById('shaderCanvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return;

  const vsSource = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const fsSource = `
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uDark;

    vec2 hash(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(dot(hash(i + vec2(0.0,0.0)), f - vec2(0.0,0.0)),
                     dot(hash(i + vec2(1.0,0.0)), f - vec2(1.0,0.0)), u.x),
                 mix(dot(hash(i + vec2(0.0,1.0)), f - vec2(0.0,1.0)),
                     dot(hash(i + vec2(1.0,1.0)), f - vec2(1.0,1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes.xy;
      vec2 p = uv;
      p.x *= uRes.x / uRes.y;
      vec2 m = uMouse / uRes;
      float md = distance(uv, m);
      float t = uTime * 0.12;

      float n1 = fbm(p * 1.5 + vec2(t, t * 0.7));
      float n2 = fbm(p * 2.2 - vec2(t * 0.8, t * 0.5) + n1 * 0.5);
      float n3 = fbm(p * 0.8 + vec2(t * 0.4, -t * 0.3) + n2 * 0.4);

      vec3 c1_light = vec3(0.72, 0.68, 1.0);
      vec3 c2_light = vec3(1.0, 0.72, 0.85);
      vec3 c3_light = vec3(0.58, 0.78, 1.0);
      vec3 c4_light = vec3(0.85, 0.75, 1.0);
      vec3 c1_dark = vec3(0.25, 0.18, 0.45);
      vec3 c2_dark = vec3(0.45, 0.30, 0.55);
      vec3 c3_dark = vec3(0.25, 0.30, 0.55);
      vec3 c4_dark = vec3(0.35, 0.20, 0.50);

      vec3 c1 = mix(c1_light, c1_dark, uDark);
      vec3 c2 = mix(c2_light, c2_dark, uDark);
      vec3 c3 = mix(c3_light, c3_dark, uDark);
      vec3 c4 = mix(c4_light, c4_dark, uDark);

      vec3 col = mix(c1, c2, smoothstep(-0.3, 0.5, n1));
      col = mix(col, c3, smoothstep(-0.2, 0.6, n2));
      col = mix(col, c4, smoothstep(0.1, 0.7, n3) * 0.55);

      float glow = 1.0 - smoothstep(0.0, 0.4, md);
      col += glow * 0.18 * mix(vec3(0.7, 0.6, 1.0), vec3(1.0, 0.6, 0.85), n1 * 0.5 + 0.5);

      float vign = smoothstep(0.3, 1.1, distance(uv, vec2(0.5)));
      col *= mix(1.0, 0.85, vign * (0.3 + uDark * 0.4));
      col += 0.015 * sin(uv.y * 40.0 + uTime * 0.4);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(program);
  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, 'uRes');
  const uTime = gl.getUniformLocation(program, 'uTime');
  const uMouse = gl.getUniformLocation(program, 'uMouse');
  const uDark = gl.getUniformLocation(program, 'uDark');

  let mouse = { x: innerWidth / 2, y: innerHeight / 2 };
  let targetMouse = { ...mouse };
  addEventListener('mousemove', e => { targetMouse.x = e.clientX; targetMouse.y = innerHeight - e.clientY; });
  addEventListener('touchmove', e => {
    if (e.touches[0]) { targetMouse.x = e.touches[0].clientX; targetMouse.y = innerHeight - e.touches[0].clientY; }
  }, { passive: true });

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  addEventListener('resize', resize);

  const start = performance.now();
  let darkTarget = 0;
  window.__setShaderDark = v => darkTarget = v;
  let darkCurrent = 0;

  function render() {
    mouse.x += (targetMouse.x * (canvas.width / innerWidth) - mouse.x) * 0.05;
    mouse.y += (targetMouse.y * (canvas.height / innerHeight) - mouse.y) * 0.05;
    darkCurrent += (darkTarget - darkCurrent) * 0.05;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (performance.now() - start) / 1000);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uDark, darkCurrent);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  render();
})();

// ====== КОНФИГ ======
const EXERCISES = {
  easy:   ['Отжимания', 'Приседания', 'Планка (сек)', 'Скручивания', 'Выпады'],
  medium: ['Отжимания', 'Приседания', 'Бёрпи', 'Планка (сек)', 'Скручивания', 'Выпады', 'Супермен'],
  hard:   ['Отжимания', 'Приседания', 'Бёрпи', 'Планка (сек)', 'Скручивания', 'Выпады', 'Супермен', 'Боковая планка (сек)', 'Джампинг Джек'],
  insane: ['Отжимания', 'Приседания', 'Бёрпи', 'Планка (сек)', 'Скручивания', 'Выпады', 'Супермен', 'Боковая планка (сек)', 'Джампинг Джек', 'Альпинист', 'Бурпи с прыжком', 'Отжимания с хлопком']
};

const BASE_COUNTS = {
  easy:   { 'Отжимания': 10, 'Приседания': 15, 'Планка (сек)': 20, 'Скручивания': 12, 'Выпады': 10 },
  medium: { 'Отжимания': 15, 'Приседания': 20, 'Бёрпи': 8, 'Планка (сек)': 30, 'Скручивания': 18, 'Выпады': 14, 'Супермен': 12 },
  hard:   { 'Отжимания': 20, 'Приседания': 25, 'Бёрпи': 12, 'Планка (сек)': 45, 'Скручивания': 25, 'Выпады': 18, 'Супермен': 16, 'Боковая планка (сек)': 30, 'Джампинг Джек': 30 },
  insane: { 'Отжимания': 30, 'Приседания': 40, 'Бёрпи': 20, 'Планка (сек)': 60, 'Скручивания': 35, 'Выпады': 25, 'Супермен': 22, 'Боковая планка (сек)': 45, 'Джампинг Джек': 50, 'Альпинист': 30, 'Бурпи с прыжком': 10, 'Отжимания с хлопком': 8 }
};

const EMOJIS = {
  'Отжимания': '💪', 'Приседания': '🦵', 'Бёрпи': '🤸', 'Планка (сек)': '📏',
  'Скручивания': '🌀', 'Выпады': '🚶', 'Супермен': '🦸', 'Боковая планка (сек)': '📐',
  'Джампинг Джек': '⭐', 'Альпинист': '🧗', 'Бурпи с прыжком': '🚀', 'Отжимания с хлопком': '👏'
};

const QUOTES = [
  '«Ты сильнее, чем думаешь»', '«Дисциплина важнее мотивации»',
  '«Каждый день — новый шанс»', '«Боль сегодня — сила завтра»',
  '«Твоё тело слышит всё, что говорит разум»', '«Не останавливайся, когда устал. Остановись, когда закончил»',
  '«Маленькие шаги — большие перемены»', '«Ты — своё лучшее вложение»',
  '«Начни там, где ты есть. Используй то, что имеешь»', '«Прогресс важнее совершенства»'
];

const ACHIEVEMENTS = [
  { id: 'first', emoji: '🎯', name: 'Первый шаг', desc: 'Заверши 1 тренировку', check: s => s.totalWorkouts >= 1 },
  { id: 'five', emoji: '✋', name: 'Пятёрка', desc: '5 тренировок', check: s => s.totalWorkouts >= 5 },
  { id: 'ten', emoji: '🔟', name: 'Десятка', desc: '10 тренировок', check: s => s.totalWorkouts >= 10 },
  { id: 'twenty', emoji: '💎', name: 'Профи', desc: '20 тренировок', check: s => s.totalWorkouts >= 20 },
  { id: 'fifty', emoji: '👑', name: 'Легенда', desc: '50 тренировок', check: s => s.totalWorkouts >= 50 },
  { id: 'streak3', emoji: '🔥', name: 'На волне', desc: '3 дня подряд', check: s => s.streak >= 3 },
  { id: 'streak7', emoji: '⚡', name: 'Неделя силы', desc: '7 дней подряд', check: s => s.streak >= 7 },
  { id: 'streak30', emoji: '🏆', name: 'Железная воля', desc: '30 дней подряд', check: s => s.streak >= 30 },
  { id: 'ex50', emoji: '🏋️', name: 'Упорный', desc: '50 упражнений', check: s => s.totalExercises >= 50 },
  { id: 'ex200', emoji: '🦾', name: 'Титан', desc: '200 упражнений', check: s => s.totalExercises >= 200 },
  { id: 'cal100', emoji: '🔥', name: 'Сжигатель', desc: '100 ккал', check: s => s.totalCalories >= 100 },
  { id: 'cal1000', emoji: '☄️', name: 'Метеор', desc: '1000 ккал', check: s => s.totalCalories >= 1000 },
  { id: 'insane', emoji: '💀', name: 'Безумец', desc: 'Тренировка "Безумный"', check: s => s.insaneDone },
  { id: 'night', emoji: '🌙', name: 'Полуночник', desc: 'Тренировка ночью', check: s => s.nightDone },
  { id: 'morning', emoji: '🌅', name: 'Ранняя пташка', desc: 'Тренировка до 8 утра', check: s => s.morningDone },
  { id: 'noSkip', emoji: '🎖️', name: 'Без пропусков', desc: 'Тренировка без "пропустить"', check: s => s.noSkipDone }
];

const state = {
  level: 'easy', rounds: 3, currentRound: 0, currentExerciseIdx: 0,
  restDuration: 30, elapsed: 0, isResting: false, isPaused: false,
  theme: 'light', soundOn: true, vibration: true,
  autoPause: true, countdown: true, autoStart: false,
  workoutTimer: null, restTimer: null, idleTimer: null,
  calories: 0, exercisesDone: 0, skipped: false,
  stats: {}, achievements: {}, xp: 0, userLevel: 1, streak: 0,
  sessionCalories: 0
};

const $ = id => document.getElementById(id);
const screens = { level: $('levelScreen'), workout: $('workoutScreen'), rest: $('restScreen'), finish: $('finishScreen'), countdown: $('countdownScreen') };

function showScreen(name) {
  Object.values(screens).forEach(s => s && s.classList.remove('active'));
  if (screens[name]) screens[name].classList.add('active');
}

function toast(msg, duration = 2500) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('toastContainer').appendChild(el);
  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

let audioCtx = null;
function beep(freq = 440, dur = 0.15, type = 'sine', vol = 0.15) {
  if (!state.soundOn) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + dur);
  } catch(e) {}
}
function soundDone() { beep(660, 0.1); setTimeout(() => beep(880, 0.15), 100); }
function soundRest() { beep(440, 0.2, 'triangle'); }
function soundEnd() { beep(523, 0.12); setTimeout(() => beep(659, 0.12), 130); setTimeout(() => beep(784, 0.25), 260); }
function soundTick() { beep(880, 0.05, 'square', 0.08); }
function soundLevelUp() { beep(523,0.1); setTimeout(()=>beep(659,0.1),90); setTimeout(()=>beep(784,0.1),180); setTimeout(()=>beep(1047,0.3),270); }

function vibrate(pattern) {
  if (state.vibration && navigator.vibrate) navigator.vibrate(pattern);
}

const confettiCanvas = $('confettiCanvas');
const ctx2d = confettiCanvas.getContext('2d');
let confettiParticles = [];
function resizeCanvas() { confettiCanvas.width = innerWidth; confettiCanvas.height = innerHeight; }
resizeCanvas();
addEventListener('resize', resizeCanvas);

function launchConfetti(count = 120) {
  const colors = ['#7c5cff', '#a78bfa', '#fd79a8', '#00b894', '#fdcb6e', '#e17055', '#74b9ff'];
  for (let i = 0; i < count; i++) {
    confettiParticles.push({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: innerHeight / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -14 - 4,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1
    });
  }
}
function animateConfetti() {
  ctx2d.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettiParticles.forEach((p, i) => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.vx *= 0.99;
    p.rot += p.vr; p.life -= 0.008;
    ctx2d.save();
    ctx2d.translate(p.x, p.y);
    ctx2d.rotate(p.rot);
    ctx2d.globalAlpha = Math.max(0, p.life);
    ctx2d.fillStyle = p.color;
    ctx2d.fillRect(-p.size/2, -p.size/2, p.size, p.size * 0.6);
    ctx2d.restore();
    if (p.life <= 0 || p.y > innerHeight + 50) confettiParticles.splice(i, 1);
  });
  requestAnimationFrame(animateConfetti);
}
animateConfetti();

function setTimeOfDayBackground() {
  const h = new Date().getHours();
  const dark = (h >= 20 || h < 7) ? 1 : 0;
  if (window.__setShaderDark) window.__setShaderDark(dark);
}

function applyTheme(theme) {
  state.theme = theme;
  document.body.classList.toggle('dark', theme === 'dark');
  document.querySelectorAll('.theme-option').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  $('themeBtn').textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('fitflow_theme', theme);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#1a1a2e' : '#6c5ce7');
 }
