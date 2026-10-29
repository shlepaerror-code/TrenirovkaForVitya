// ====== СТАРТ ТРЕНИРОВКИ ======
$('startBtn').addEventListener('click', () => {
  const rounds = Math.max(1, Math.min(20, parseInt($('roundsInput').value) || 3));
  state.rounds = rounds;
  state.currentRound = 0;
  state.currentExerciseIdx = 0;
  state.skipped = false;
  state.sessionCalories = 0;
  state.exercisesDone = 0;
  if (state.countdown) showCountdown(() => startRound());
  else startRound();
});

function showCountdown(cb) {
  showScreen('countdown');
  let n = 3;
  $('countdownNum').textContent = n;
  soundTick();
  const t = setInterval(() => {
    n--;
    if (n > 0) {
      $('countdownNum').textContent = n;
      $('countdownNum').style.animation = 'none';
      void $('countdownNum').offsetWidth;
      $('countdownNum').style.animation = 'pop 1s ease';
      soundTick();
    } else {
      clearInterval(t);
      $('countdownNum').textContent = 'GO!';
      beep(880, 0.25);
      setTimeout(() => cb(), 500);
    }
  }, 1000);
}

function getCurrentExercise() {
  const list = EXERCISES[state.level];
  const idx = state.currentExerciseIdx % list.length;
  const name = list[idx];
  const baseCount = BASE_COUNTS[state.level][name] || 10;
  const count = Math.round(baseCount * (1 + state.currentRound * 0.2));
  let cal = 0;
  if (name.includes('сек')) cal = Math.round(count * 0.08);
  else if (name.includes('Отжимания')) cal = Math.round(count * 0.5);
  else if (name.includes('Приседания')) cal = Math.round(count * 0.35);
  else if (name.includes('Бёрпи') || name.includes('Бурпи')) cal = Math.round(count * 1.0);
  else cal = Math.round(count * 0.4);
  return { name, count, cal };
}

function startRound() {
  state.currentRound++;
  state.currentExerciseIdx = 0;
  state.elapsed = 0;
  state.isPaused = false;
  showScreen('workout');
  updateWorkoutUI();
  startWorkoutTimer();
  startIdleTimer();
}

function updateWorkoutUI() {
  const { name, count, cal } = getCurrentExercise();
  const totalExercises = EXERCISES[state.level].length;
  $('exerciseName').textContent = name;
  $('exerciseEmoji').textContent = EMOJIS[name] || '💪';
  $('exerciseCount').textContent = count;
  $('roundCounter').textContent = `Занятие ${state.currentRound} / ${state.rounds}`;
  $('phaseLabel').textContent = 'Выполняй упражнение';
  $('calories').textContent = cal;
  state.calories = cal;
  const progress = ((state.currentExerciseIdx % totalExercises) / totalExercises) * 100;
  $('progressFill').style.width = progress + '%';
  const ring = $('ringFill');
  const circ = 553;
  ring.style.strokeDashoffset = circ - (circ * progress / 100);
}

function startWorkoutTimer() {
  clearInterval(state.workoutTimer);
  state.elapsed = 0;
  updateWorkoutTimerDisplay();
  state.workoutTimer = setInterval(() => {
    if (state.isPaused) return;
    state.elapsed++;
    updateWorkoutTimerDisplay();
    if (state.elapsed % 30 === 0) soundTick();
  }, 1000);
}

function updateWorkoutTimerDisplay() {
  const m = String(Math.floor(state.elapsed / 60)).padStart(2, '0');
  const s = String(state.elapsed % 60).padStart(2, '0');
  $('timerDisplay').textContent = `${m}:${s}`;
}

function startIdleTimer() {
  clearTimeout(state.idleTimer);
  if (!state.autoPause) return;
  state.idleTimer = setTimeout(() => {
    if (!state.isPaused && screens.workout.classList.contains('active')) {
      pauseWorkout();
      toast('⏸ Авто-пауза (простой 60с)');
    }
  }, 60000);
}
['click','keydown','touchstart'].forEach(ev => document.addEventListener(ev, () => {
  if (screens.workout.classList.contains('active') && !state.isPaused) startIdleTimer();
}));

function pauseWorkout() {
  state.isPaused = true;
  $('pauseBtn').textContent = '▶ Продолжить';
}
function resumeWorkout() {
  state.isPaused = false;
  $('pauseBtn').textContent = '⏸ Пауза';
  startIdleTimer();
}
$('pauseBtn').addEventListener('click', () => {
  state.isPaused ? resumeWorkout() : pauseWorkout();
});

// ====== ГОТОВО ======
$('doneBtn').addEventListener('click', () => {
  clearInterval(state.workoutTimer);
  clearTimeout(state.idleTimer);
  soundDone();
  vibrate(60);
  const list = EXERCISES[state.level];
  state.currentExerciseIdx++;
  state.stats.totalExercises++;
  state.exercisesDone++;
  state.sessionCalories += state.calories;
  state.stats.totalCalories += state.calories;
  state.stats.totalTime += state.elapsed;
  const bonus = state.elapsed < 30 ? 5 : 0;
  addXP(5 + bonus);
  if (state.currentExerciseIdx < list.length) {
    updateWorkoutUI();
    startWorkoutTimer();
  } else {
    if (state.currentRound < state.rounds) startRest();
    else finishWorkout();
  }
});

// ====== ОТДЫХ ======
function startRest() {
  showScreen('rest');
  state.isResting = true;
  soundRest();
  let remaining = state.restDuration;
  const total = remaining;
  $('restTimer').textContent = remaining;
  const restRing = $('restRingFill');
  const circ = 553;
  restRing.style.strokeDashoffset = 0;
  clearInterval(state.restTimer);
  state.restTimer = setInterval(() => {
    remaining--;
    $('restTimer').textContent = remaining > 0 ? remaining : 0;
    const progress = 1 - remaining / total;
    restRing.style.strokeDashoffset = circ - circ * progress;
    if (remaining <= 5 && remaining > 0) soundTick();
    if (remaining <= 0) {
      clearInterval(state.restTimer);
      endRest();
    }
  }, 1000);
}

$('skipBtn').addEventListener('click', () => {
  clearInterval(state.restTimer);
  state.skipped = true;
  endRest();
});
$('addRestBtn').addEventListener('click', () => {
  state.restDuration += 15;
  $('restTimer').textContent = (+$('restTimer').textContent) + 15;
});

function endRest() {
  if (!state.isResting) return;
  state.isResting = false;
  soundDone();
  if (state.countdown) showCountdown(() => startRound());
  else startRound();
}

// ====== ФИНАЛ ======
function finishWorkout() {
  showScreen('finish');
  soundEnd();
  vibrate([80, 50, 80, 50, 200]);
  launchConfetti(200);
  $('finishRounds').textContent = state.rounds;
  $('finishExercises').textContent = state.exercisesDone;
  $('finishCalories').textContent = state.sessionCalories;
  const xpEarned = state.rounds * 15 + state.exercisesDone * 3;
  $('finishXp').textContent = '+' + xpEarned;
  if (state.level === 'insane') state.insaneDone = true;
  if (!state.skipped) state.noSkipDone = true;
  const h = new Date().getHours();
  if (h >= 22 || h < 5) state.nightDone = true;
  if (h < 8) state.morningDone = true;
  checkStreak();
  state.stats.totalWorkouts++;
  state.stats.history.push({
    date: Date.now(),
    rounds: state.rounds,
    calories: state.sessionCalories,
    level: state.level
  });
  if (state.stats.history.length > 50) state.stats.history = state.stats.history.slice(-50);
  addXP(xpEarned);
  saveStats();
  checkAchievements();
  updateStreakUI();
  const msgs = ['Ты сделал это! 💪', 'Ещё один шаг к цели 🚀', 'Твоё тело скажет спасибо 🙌', 'Так держать! 🔥'];
  $('finishMsg').textContent = msgs[Math.floor(Math.random() * msgs.length)];
}

$('restartBtn').addEventListener('click', () => {
  showScreen('level');
  state.currentRound = 0;
  state.currentExerciseIdx = 0;
  rotateQuote();
});

// ====== ХОТКЕИ ======
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && screens.workout.classList.contains('active')) {
    e.preventDefault();
    $('doneBtn').click();
  }
  if (e.code === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
  if (e.code === 'KeyP' && screens.workout.classList.contains('active')) {
    state.isPaused ? resumeWorkout() : pauseWorkout();
  }
  if (e.code === 'KeyS' && screens.rest.classList.contains('active')) {
    $('skipBtn').click();
  }
});

// ====== ЦИТАТЫ ======
let quoteIdx = 0;
function rotateQuote() {
  quoteIdx = (quoteIdx + 1) % QUOTES.length;
  const el = $('motivationQuote');
  el.style.opacity = 0;
  setTimeout(() => {
    el.textContent = QUOTES[quoteIdx];
    el.style.opacity = 1;
  }, 300);
}
setInterval(() => { if (screens.level.classList.contains('active')) rotateQuote(); }, 6000);

// ====== ИНИЦИАЛИЗАЦИЯ ======
function init() {
  setTimeOfDayBackground();
  setInterval(setTimeOfDayBackground, 60000);
  const savedTheme = localStorage.getItem('fitflow_theme');
  if (savedTheme) applyTheme(savedTheme);
  else {
    const h = new Date().getHours();
    applyTheme(h >= 20 || h < 7 ? 'dark' : 'light');
  }
  const savedRest = localStorage.getItem('fitflow_rest');
  if (savedRest) state.restDuration = parseInt(savedRest);
  loadStats();
  updateRounds(3);
  rotateQuote();
  setTimeout(() => {
    const h = new Date().getHours();
    let g = 'Привет';
    if (h < 6) g = 'Доброй ночи';
    else if (h < 12) g = 'Доброе утро';
    else if (h < 18) g = 'Добрый день';
    else g = 'Добрый вечер';
    toast(`${g}! Готов тренироваться? 💪`, 3000);
  }, 800);
}
init();
