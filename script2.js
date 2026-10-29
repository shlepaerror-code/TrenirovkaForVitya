// ====== СТАТИСТИКА ======
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

// ====== ВЫБОР УРОВНЯ ======
document.querySelectorAll('.level-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.level-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.level = card.dataset.level;
    beep(660, 0.08, 'sine', 0.1);
  });
});
document.querySelector('.level-card[data-level="easy"]').classList.add('selected');

// ====== STEPPER ======
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

// ====== НАСТРОЙКИ ======
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

// ====== МОДАЛКА СТАТИСТИКИ ======
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
$('statsModal').addEventListener('click', e => { if (e.target === $('statsModal')) $('statsModal').classList.remove('active'); });
$('resetStatsBtn').addEventListener('click', () => {
  if (confirm('Сбросить всю статистику?')) {
    localStorage.removeItem('fitflow_stats');
    localStorage.removeItem('fitflow_achievements');
    location.reload();
  }
});

// ====== МОДАЛКА ДОСТИЖЕНИЙ ======
$('achievementsBtn').addEventListener('click', () => {
  const list = $('achievementsList');
  list.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const div = document.createElement('div');
    div.className = 'achievement' + (state.achievements[a.id] ? ' unlocked' : '');
    div.innerHTML = `<div class="ach-emoji">${a.emoji}</div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div>`;
    list.appendChild(div);
  });
  $('achievementsModal').classList.add('active');
});
$('closeAchievements').addEventListener('click', () => $('achievementsModal').classList.remove('active'));
$('achievementsModal').addEventListener('click', e => { if (e.target === $('achievementsModal')) $('achievementsModal').classList.remove('active'); });
