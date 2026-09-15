/**
 * Discussion & Game Timer Controller
 */
import { gameState, lobbyState, uiState } from '../state/store.js';
import { soundManager } from '../audio/sound.js';
import { showGameToast } from '../ui/toast.js';

export function toggleTimer() {
  if (gameState.timerRunning) pauseTimer();
  else startTimer();
}

export function startTimer() {
  if (gameState.timerRunning) return;
  silenceTimerAlarm();
  gameState.timerRunning = true;
  const toggleBtn = (typeof document !== 'undefined') ? document.getElementById('game-timer-toggle') : null;
  if (toggleBtn) toggleBtn.textContent = '⏸';
  updateTimerDisplay();

  if (uiState.timerInterval) {
    clearInterval(uiState.timerInterval);
    uiState.timerInterval = null;
  }

  uiState.timerInterval = setInterval(() => {
    if (gameState.timerRemaining > 0) {
      gameState.timerRemaining--;
      updateTimerDisplay();
      if (gameState.timerRemaining <= 3 && gameState.timerRemaining > 0) {
        soundManager.playBeep();
      }
      if (gameState.timerRemaining === 0) {
        pauseTimer();
        triggerTimerAlarm();
      }
    }
  }, 1000);
}

export function pauseTimer() {
  gameState.timerRunning = false;
  if (uiState.timerInterval) {
    clearInterval(uiState.timerInterval);
    uiState.timerInterval = null;
  }
  const toggleBtn = (typeof document !== 'undefined') ? document.getElementById('game-timer-toggle') : null;
  if (toggleBtn) toggleBtn.textContent = '▶';
  updateTimerDisplay();
}

export function resetTimer() {
  pauseTimer();
  silenceTimerAlarm();
  gameState.timerRemaining = lobbyState.discussionTimer || 90;
  updateTimerDisplay();
}

export function updateTimerDisplay() {
  const mins = Math.floor(gameState.timerRemaining / 60);
  const secs = gameState.timerRemaining % 60;
  const pad = n => (n < 10 ? '0' + n : n);
  const timeStr = `${pad(mins)}:${pad(secs)}`;

  if (typeof document === 'undefined') return;

  const headerEl = document.getElementById('game-timer-display');
  if (headerEl) headerEl.textContent = timeStr;

  const bigClock = document.getElementById('discussion-timer-big-display');
  if (bigClock) bigClock.textContent = timeStr;

  // Discussion Bar Fill Animation & Color Shifts
  const barFill = document.getElementById('discussion-timer-bar-fill');
  if (barFill) {
    const totalSec = Math.max(1, lobbyState.discussionTimer || 90);
    const pct = Math.max(0, Math.min(100, (gameState.timerRemaining / totalSec) * 100));
    barFill.style.width = `${pct}%`;

    if (gameState.timerRemaining <= 10 && gameState.timerRemaining > 0) {
      barFill.className = 'discussion-progress-fill critical';
    } else if (gameState.timerRemaining <= 25) {
      barFill.className = 'discussion-progress-fill warning';
    } else {
      barFill.className = 'discussion-progress-fill normal';
    }
  }

  // 1-Click Discussion Timer Big Button
  const bigBtn = document.getElementById('discussion-timer-big-btn');
  if (bigBtn) {
    const totalSec = lobbyState.discussionTimer || 90;
    if (gameState.timerRunning) {
      bigBtn.className = 'discussion-timer-big-btn is-running';
      bigBtn.innerHTML = `<span class="dt-btn-icon">⏸</span> <span class="dt-btn-text">Pause Discussion</span>`;
      bigBtn.setAttribute('title', 'Click to pause discussion timer');
    } else {
      bigBtn.className = 'discussion-timer-big-btn is-paused';
      const label = gameState.timerRemaining === totalSec ? 'Start Discussion' : 'Resume Discussion';
      bigBtn.innerHTML = `<span class="dt-btn-icon">▶</span> <span class="dt-btn-text">${label}</span>`;
      bigBtn.setAttribute('title', 'One-click to turn on discussion bar');
    }
  }
}

export function triggerTimerAlarm() {
  soundManager.startAlarmLoop();
  if (typeof document !== 'undefined') {
    const pill = document.querySelector('.game-timer-pill');
    if (pill) pill.classList.add('timer-alarm-active');
    const banner = document.getElementById('timer-alarm-banner');
    if (banner) banner.style.display = 'flex';
  }
  showGameToast('🚨 Discussion time is up! Time for votes.');
}

export function silenceTimerAlarm() {
  soundManager.stopAlarm();
  if (typeof document !== 'undefined') {
    const pill = document.querySelector('.game-timer-pill');
    if (pill) pill.classList.remove('timer-alarm-active');
    const banner = document.getElementById('timer-alarm-banner');
    if (banner) banner.style.display = 'none';
  }
}

export function addTimerSeconds(sec = 30) {
  silenceTimerAlarm();
  gameState.timerRemaining += sec;
  updateTimerDisplay();
  startTimer();
  showGameToast(`⏱️ Added +${sec}s to discussion time.`);
}

export function triggerAttentionBell() {
  soundManager.playAttentionBell();
  if (typeof document !== 'undefined') {
    const btn = document.getElementById('moderator-bell-btn');
    if (btn) {
      btn.classList.add('bell-ringing');
      setTimeout(() => btn.classList.remove('bell-ringing'), 1000);
    }
  }
  showGameToast('🔔 Attention! Order in the village.');
}

export function toggleSound() {
  soundManager.enabled = !soundManager.enabled;
  const btn = (typeof document !== 'undefined') ? document.getElementById('lobby-sound-btn') : null;
  if (btn) btn.textContent = soundManager.enabled ? '🔊 Sound On' : '🔇 Sound Off';
}

