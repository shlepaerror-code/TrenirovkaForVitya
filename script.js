// ==== Конфигурация упражнений по уровням ====
const EXERCISES = {
  easy:   ['Отжимания', 'Приседания', 'Планка (сек)', 'Скручивания', 'Выпады'],
  medium: ['Отжимания', 'Приседания', 'Бёрпи', 'Планка (сек)', 'Скручивания', 'Выпады', 'Супермен'],
  hard:   ['Отжимания', 'Приседания', 'Бёрпи', 'Планка (сек)', 'Скручивания', 'Выпады', 'Супермен', 'Боковая планка (сек)', 'Джампинг Джек'],
  insane: ['Отжимания', 'Приседания', 'Бёрпи', 'Планка (сек)', 'Скручивания', 'Выпады', 'Супермен', 'Боковая планка (сек)', 'Джампинг Джек', 'Альпинист', 'Бурпи с прыжком', 'Отжимания с хлопком']
};

// Базовые количества по уровням (для 1-го занятия), дальше растёт
const BASE_COUNTS = {
  easy:   { 'Отжимания': 10, 'Приседания': 15, 'Планка (сек)': 20, 'Скручивания': 12, 'Выпады': 10 },
  medium: { 'Отжимания': 15, 'Приседания': 20, 'Бёрпи': 8, 'Планка (сек)': 30, 'Скручивания': 18, 'Выпады': 14, 'Супермен': 12 },
  hard:   { 'Отжимания': 20, 'Приседания': 25, 'Бёрпи': 12, 'Планка (сек)': 45, 'Скручивания': 25, 'Выпады': 18, 'Супермен': 16, 'Боковая планка (сек)': 30, 'Джампинг Джек': 30 },
  insane: { 'Отжимания': 30, 'Приседания': 40, 'Бёрпи': 20, 'Планка (сек)': 60, 'Скручивания': 35, 'Выпады': 25, 'Супермен': 22, 'Боковая планка (сек)': 45, 'Джампинг Джек': 50, 'Альпинист': 30, 'Бурпи с прыжком': 10, 'Отжимания с хлопком': 8 }
};

// ==== Состояние ====
const state = {
  level: 'easy',
  rounds: 3,
  currentRound: 0,
  currentExerciseIdx: 0,
  restDuration: 30,
  workoutTimer: null,
  restTimer: null,
  elapsed: 0,
  isResting: false,
  theme: 'light'
};

// ==== DOM ====
const $ = id => document.getElementById(id);
const screens = { level: $('levelScreen'), workout: $('workoutScreen'), rest: $('restScreen'), finish: $('finishScreen') };

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ==== Фон по времени суток ====
function setTimeOfDayBackground() {
  const h = new Date().getHours();
  const bg = $('bgLayer');
  bg.classList.remove('morning', 'day', 'evening', 'night');
  let period;
  if (h >= 5 && h < 11) period = 'morning';
  else if (h >= 11 && h < 17) period = 'day';
  else if (h >= 17 && h < 22) period = 'evening';
  else period = 'night';
  bg.classList.add(period);
  if (period === 'night' && state.theme === 'light') {
    // лёгкое затемнение уже в градиенте
  }
}

// ==== Тема ====
function applyTheme(theme) {
  state.theme = theme;
  document.body.classList.toggle('dark', theme === 'dark');
  document.querySelectorAll('.theme-option').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === theme);
  });
  $('themeBtn').textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('fitflow_theme', theme);
}

$('themeBtn').addEventListener('click', () => {
  applyTheme(state.theme === 'light' ? 'dark' : 'light');
});

// ==== Выбор уровня ====
let selectedLevelCard = null;
document.querySelectorAll('.level-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.level-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.level = card.dataset.level;
    selectedLevelCard = card;
  });
});
// Выбираем лёгкий по умолчанию
document.querySelector('.level-card[data-level="easy"]').classList.add('selected');

// ==== Настройки ====
$('settingsBtn').addEventListener('click', () => {
  $('settingsModal').classList.add('active');
  $('restDurationInput').value = state.restDuration;
});
$('closeSettings').addEventListener('click', () => {
  state.restDuration = Math.max(5, Math.min(300, parseInt($('restDurationInput').value) || 30));
  localStorage.setItem('fitflow_rest', state.restDuration);
  $('settingsModal').classList.remove('active');
});
document.querySelectorAll('.theme-option').forEach(b => {
  b.addEventListener('click', () => applyTheme(b.dataset.theme));
});
$('settingsModal').addEventListener('click', e => {
  if (e.target === $('settingsModal')) $('settingsModal').classList.remove('active');
});

// ==== Старт тренировки ====
$('startBtn').addEventListener('click', () => {
  const rounds = Math.max(1, Math.min(20, parseInt($('roundsInput').value) || 3));
  state.rounds = rounds;
  state.currentRound = 0;
  state.currentExerciseIdx = 0;
  startRound();
});

function getCurrentExercise() {
  const list = EXERCISES[state.level];
  const idx = state.currentExerciseIdx % list.length;
  const name = list[idx];
  const baseCount = BASE_COUNTS[state.level][name] || 10;
  // рост нагрузки с каждым занятием (+20%)
  const count = Math.round(baseCount * (1 + state.currentRound * 0.2));
  return { name, count };
}

function startRound() {
  state.currentRound++;
  state.currentExerciseIdx = 0;
  state.elapsed = 0;
  showScreen('workout');
  updateWorkoutUI();
  startWorkoutTimer();
}

function updateWorkoutUI() {
  const { name, count } = getCurrentExercise();
  const totalExercises = EXERCISES[state.level].length;
  $('exerciseName').textContent = name;
  $('exerciseCount').textContent = count;
  $('roundCounter').textContent = `Занятие ${state.currentRound} / ${state.rounds}`;
  $('phaseLabel').textContent = 'Выполняй упражнение';

  const total = totalExercises;
  const progress = ((state.currentExerciseIdx % total) / total) * 100;
  $('progressFill').style.width = progress + '%';
}

function startWorkoutTimer() {
  clearInterval(state.workoutTimer);
  state.elapsed = 0;
  updateWorkoutTimerDisplay();
  state.workoutTimer = setInterval(() => {
    state.elapsed++;
    updateWorkoutTimerDisplay();
  }, 1000);
}

function updateWorkoutTimerDisplay() {
  const m = String(Math.floor(state.elapsed / 60)).padStart(2, '0');
  const s = String(state.elapsed % 60).padStart(2, '0');
  $('timerDisplay').textContent = `${m}:${s}`;
}

// ==== Кнопка "Готово" ====
$('doneBtn').addEventListener('click', () => {
  clearInterval(state.workoutTimer);
  const list = EXERCISES[state.level];
  state.currentExerciseIdx++;

  if (state.currentExerciseIdx < list.length) {
    // ещё есть упражнения в занятии
    updateWorkoutUI();
    startWorkoutTimer();
  } else {
    // занятие завершено
    if (state.currentRound < state.rounds) {
      startRest();
    } else {
      finishWorkout();
    }
  }
});

// ==== Отдых ====
function startRest() {
  showScreen('rest');
  state.isResting = true;
  let remaining = state.restDuration;
  $('restTimer').textContent = remaining;

  clearInterval(state.restTimer);
  state.restTimer = setInterval(() => {
    remaining--;
    $('restTimer').textContent = remaining > 0 ? remaining : 0;
    if (remaining <= 0) {
      clearInterval(state.restTimer);
      endRest();
    }
  }, 1000);
}

$('skipBtn').addEventListener('click', () => {
  clearInterval(state.restTimer);
  endRest();
});

function endRest() {
  if (!state.isResting) return;
  state.isResting = false;
  startRound();
}

// ==== Финал ====
function finishWorkout() {
  showScreen('finish');
}

$('restartBtn').addEventListener('click', () => {
  showScreen('level');
  state.currentRound = 0;
  state.currentExerciseIdx = 0;
});

// ==== Инициализация ====
function init() {
  setTimeOfDayBackground();
  setInterval(setTimeOfDayBackground, 60000); // обновляем раз в минуту

  const savedTheme = localStorage.getItem('fitflow_theme');
  if (savedTheme) applyTheme(savedTheme);
  else {
    // авто-тема по времени суток
    const h = new Date().getHours();
    applyTheme(h >= 20 || h < 7 ? 'dark' : 'light');
  }

  const savedRest = localStorage.getItem('fitflow_rest');
  if (savedRest) state.restDuration = parseInt(savedRest);
}
init();
