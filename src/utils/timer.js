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
  const el = (typeof document !== 'undefined') ? document.getElementById('game-timer-display') : null;
  if (el) el.textContent = `${pad(mins)}:${pad(secs)}`;
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

