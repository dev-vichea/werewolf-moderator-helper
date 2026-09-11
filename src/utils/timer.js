/**
 * Discussion & Game Timer Controller
 */
import { gameState, lobbyState, uiState } from '../state/store.js';
import { soundManager } from '../audio/sound.js';
import { showCustomAlert } from '../ui/dialog.js';

export function toggleTimer() {
  if (gameState.timerRunning) pauseTimer();
  else startTimer();
}

export function startTimer() {
  if (gameState.timerRunning) return;
  gameState.timerRunning = true;
  const toggleBtn = document.getElementById('game-timer-toggle');
  if (toggleBtn) toggleBtn.textContent = '⏸';

  if (uiState.timerInterval) {
    clearInterval(uiState.timerInterval);
    uiState.timerInterval = null;
  }

  uiState.timerInterval = setInterval(() => {
    if (gameState.timerRemaining > 0) {
      gameState.timerRemaining--;
      updateTimerDisplay();
      if (gameState.timerRemaining <= 3 && gameState.timerRemaining > 0) soundManager.playBeep();
      if (gameState.timerRemaining === 0) {
        pauseTimer();
        soundManager.playChime();
        showCustomAlert('⏰ Discussion time is up!');
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
  const toggleBtn = document.getElementById('game-timer-toggle');
  if (toggleBtn) toggleBtn.textContent = '▶';
}

export function resetTimer() {
  pauseTimer();
  gameState.timerRemaining = lobbyState.discussionTimer || 90;
  updateTimerDisplay();
}

export function updateTimerDisplay() {
  const mins = Math.floor(gameState.timerRemaining / 60);
  const secs = gameState.timerRemaining % 60;
  const pad = n => (n < 10 ? '0' + n : n);
  const el = document.getElementById('game-timer-display');
  if (el) el.textContent = `${pad(mins)}:${pad(secs)}`;
}

export function toggleSound() {
  soundManager.enabled = !soundManager.enabled;
  const btn = document.getElementById('lobby-sound-btn');
  if (btn) btn.textContent = soundManager.enabled ? '🔊 Sound On' : '🔇 Sound Off';
}
