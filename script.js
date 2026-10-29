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

    // 2D шум
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
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes.xy;
      vec2 p = uv;
      p.x *= uRes.x / uRes.y;

      // движение от мыши
      vec2 m = uMouse / uRes;
      float md = distance(uv, m);

      float t = uTime * 0.15;

      // потоковые волны
      float n1 = fbm(p * 1.5 + vec2(t, t * 0.7));
      float n2 = fbm(p * 2.2 - vec2(t * 0.8, t * 0.5) + n1 * 0.5);
      float n3 = fbm(p * 0.8 + vec2(t * 0.4, -t * 0.3) + n2 * 0.4);

      // палитра
      vec3 c1_light = vec3(0.66, 0.63, 1.0);   // фиолетовый
      vec3 c2_light = vec3(0.99, 0.47, 0.66);  // розовый
      vec3 c3_light = vec3(0.45, 0.72, 1.0);   // голубой
      vec3 c4_light = vec3(1.0, 0.85, 0.55);   // тёплый

      vec3 c1_dark = vec3(0.10, 0.10, 0.25);
      vec3 c2_dark = vec3(0.45, 0.25, 0.55);
      vec3 c3_dark = vec3(0.15, 0.25, 0.55);
      vec3 c4_dark = vec3(0.30, 0.15, 0.35);

      vec3 c1 = mix(c1_light, c1_dark, uDark);
      vec3 c2 = mix(c2_light, c2_dark, uDark);
      vec3 c3 = mix(c3_light, c3_dark, uDark);
      vec3 c4 = mix(c4_light, c4_dark, uDark);

      // смешивание
      vec3 col = mix(c1, c2, smoothstep(-0.3, 0.5, n1));
      col = mix(col, c3, smoothstep(-0.2, 0.6, n2));
      col = mix(col, c4, smoothstep(0.1, 0.7, n3) * 0.5);

      // свечение от мыши
      float glow = 1.0 - smoothstep(0.0, 0.4, md);
      col += glow * 0.15 * mix(vec3(0.7, 0.6, 1.0), vec3(1.0, 0.5, 0.7), n1 * 0.5 + 0.5);

      // усиление контраста
      col = pow(col, vec3(0.95));

      // виньетка
      float vign = smoothstep(0.2, 1.0, distance(uv, vec2(0.5)));
      col *= mix(1.0, 0.6, vign * (0.4 + uDark * 0.4));

      // лёгкий блик
      col += 0.02 * sin(uv.y * 50.0 + uTime * 0.5);

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
  const colors = ['#6c5ce7', '#a29bfe', '#fd79a8', '#00b894', '#fdcb6e', '#e17055', '#74b9ff'];
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
  // шейдеру передаём тёмность в зависимости от времени
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

function loadStats() {
  const s = JSON.parse(localStorage.getItem('fitflow_stats') || '{}');
  state.stats = {
    totalWorkouts: s.totalWorkouts || 0,
    totalExercises: s.totalExercises || 0,
    totalCalories: s.totalCalories || 0,
    totalTime: s.totalTime || 0,
    history: s.history || [],
    lastDate: s.lastDate || null
  };
  state.xp = s.xp || 0;
  state.userLevel = s.userLevel || 1;
  state.achievements = JSON.parse(localStorage.getItem('fitflow_achievements') || '{}');
  state.streak = s.streak || 0;
  state.insaneDone = s.insaneDone || false;
  state.nightDone = s.nightDone || false;
  state.morningDone = s.morningDone || false;
  state.noSkipDone = s.noSkipDone || false;
  updateXPUI();
  updateStreakUI();
}

function saveStats() {
  const s = {
    ...state.stats,
    xp: state.xp, userLevel: state.userLevel, streak: state.streak,
    insaneDone: state.insaneDone, nightDone: state.nightDone,
    morningDone: state.morningDone, noSkipDone: state.noSkipDone
  };
  localStorage.setItem('fitflow_stats', JSON.stringify(s));
  localStorage.setItem('fitflow_achievements', JSON.stringify(state.achievements));
}

function addXP(amount) {
  state.xp += amount;
  const need = state.userLevel * 100;
  if (state.xp >= need) {
    state.xp -= need;
    state.userLevel++;
    soundLevelUp();
    launchConfetti(80);
    toast(`🎉 Уровень ${state.userLevel}!`);
  }
  updateXPUI();
  saveStats();
}

function updateXPUI() {
  $('userLevel').textContent = state.userLevel;
  const need = state.userLevel * 100;
  $('xpText').textContent = `${state.xp} / ${need} XP`;
  $('xpFill').style.width = (state.xp / need * 100) + '%';
}

function updateStreakUI() { $('streakCount').textContent = state.streak; }

function checkStreak() {
  const today = new Date().toDateString();
  const last = state.stats.lastDate;
  if (last === today) return;
  if (last) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (last === yesterday) state.streak++;
    else state.streak = 1;
  } else state.streak = 1;
  state.stats.lastDate = today;
}

function checkAchievements() {
  const snapshot = {
    totalWorkouts: state.stats.totalWorkouts,
    totalExercises: state.stats.totalExercises,
    totalCalories: state.stats.totalCalories,
    streak: state.streak,
    insaneDone: state.insaneDone,
    nightDone: state.nightDone,
    morningDone: state.morningDone,
    noSkipDone: state.noSkipDone
  };
  ACHIEVEMENTS.forEach(a => {
    if (!state.achievements[a.id] && a.check(snapshot)) {
      state.achievements[a.id] = true;
      toast(`${a.emoji} Достижение: ${a.name}!`, 3500);
      addXP(50);
      launchConfetti(60);
      soundLevelUp();
    }
  });
  saveStats();
}

document.querySelectorAll('.level-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.level-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.level = card.dataset.level;
    beep(660, 0.08, 'sine', 0.1);
  });
});
document.querySelector('.level-card[data-level="easy"]').classList.add('selected');

function updateRounds(v) {
  v = Math.max(1, Math.min(20, v));
  $('roundsInput').value = v;
  document.querySelectorAll('.quick-btn').forEach(b => b.classList.toggle('active', +b.dataset.rounds === v));
}
$('roundsMinus').addEventListener('click', () => updateRounds(+$('roundsInput').value - 1));
$('roundsPlus').addEventListener('click', () => updateRounds(+$('roundsInput').value + 1));
$('roundsInput').addEventListener('change', () => updateRounds(+$('roundsInput').value));
document.querySelectorAll('.quick-btn').forEach(b => {
  b.addEventListener('click', () => updateRounds(+b.dataset.rounds));
});

$('settingsBtn').addEventListener('click', () => {
  $('restDurationInput').value = state.restDuration;
  $('autoPauseToggle').classList.toggle('active', state.autoPause);
  $('countdownToggle').classList.toggle('active', state.countdown);
  $('vibrationToggle').classList.toggle('active', state.vibration);
  $('autoStartToggle').classList.toggle('active', state.autoStart);
  $('settingsModal').classList.add('active');
});
$('closeSettings').addEventListener('click', () => {
  state.restDuration = Math.max(5, Math.min(300, parseInt($('restDurationInput').value) || 30));
  localStorage.setItem('fitflow_rest', state.restDuration);
  $('settingsModal').classList.remove('active');
  toast('✅ Настройки сохранены');
});
$('settingsModal').addEventListener('click', e => { if (e.target === $('settingsModal')) $('settingsModal').classList.remove('active'); });

['autoPauseToggle','countdownToggle','vibrationToggle','autoStartToggle'].forEach(id => {
  $(id).addEventListener('click', function() {
    this.classList.toggle('active');
    const map = { autoPauseToggle: 'autoPause', countdownToggle: 'countdown', vibrationToggle: 'vibration', autoStartToggle: 'autoStart' };
    state[map[id]] = this.classList.contains('active');
  });
});

document.querySelectorAll('.theme-option').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.theme)));
$('themeBtn').addEventListener('click', () => applyTheme(state.theme === 'light' ? 'dark' : 'light'));
$('soundBtn').addEventListener('click', () => {
  state.soundOn = !state.soundOn;
  $('soundBtn').textContent = state.soundOn ? '🔊' : '🔇';
  $('soundBtn').classList.toggle('off', !state.soundOn);
  if (state.soundOn) beep(660, 0.1);
});

$('statsBtn').addEventListener('click', () => {
  $('statTotalWorkouts').textContent = state.stats.totalWorkouts;
  $('statTotalExercises').textContent = state.stats.totalExercises;
  $('statTotalCalories').textContent = state.stats.totalCalories;
  $('statTotalTime').textContent = Math.round(state.stats.totalTime / 60) + 'м';
  const list = $('historyList');
  list.innerHTML = '';
  const h = state.stats.history.slice(-7).reverse();
  if (!h.length) list.innerHTML = '<div class="history-item"><span>Пока нет тренировок</span></div>';
  h.forEach(item => {
    const d = new Date(item.date);
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `<span class="hi-date">${d.toLocaleDateString('ru-RU')} ${d.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})}</span><span>${item.rounds} зан • ${item.calories} ккал</span>`;
    list.appendChild(div);
  });
  $('statsModal').classList.add('active');
});
$('closeStats').addEventListener('click', () => $('statsModal').classList.remove('active'));
$('statsModal').addEventListener('click', e => { i
