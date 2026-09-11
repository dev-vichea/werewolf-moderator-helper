/**
 * Win Overlay Modal & Auto-return Countdown
 */
import { gameState } from '../../state/store.js';
import { getRoleData, getRoleImage } from '../../state/roles.js';
import { soundManager } from '../../audio/sound.js';
import { saveAppState } from '../../state/storage.js';

let gameOverCountdownTimer = null;

export function showWinOverlay(title, desc, callbacks = {}) {
  const overlay = document.getElementById('win-overlay');
  if (!overlay) return;

  // Determine trophy/badge
  const trophyEl = document.getElementById('win-trophy');
  if (trophyEl) {
    if (title.includes('Village')) trophyEl.textContent = '🎉';
    else if (title.includes('Werewolf')) trophyEl.textContent = '🐺';
    else if (title.includes('Tanner')) trophyEl.textContent = '🤡';
    else if (title.includes('Lover')) trophyEl.textContent = '💘';
    else trophyEl.textContent = '🏆';
  }

  const titleEl = document.getElementById('win-title');
  if (titleEl) titleEl.textContent = title;
  const descEl = document.getElementById('win-desc');
  if (descEl) descEl.textContent = desc;

  // Render Full Roster Breakdown
  const rosterContainer = document.getElementById('win-roster-summary');
  if (rosterContainer && gameState.players) {
    rosterContainer.innerHTML = gameState.players.map(p => {
      const roleData = getRoleData(p.role);
      const isDead = p.status === 'dead';
      return `
        <div class="win-roster-pill ${isDead ? 'dead' : 'alive'}">
          <img src="${getRoleImage(p.role)}" class="win-pill-img" alt="${p.role}" onerror="this.src='images/villager.jpeg'">
          <div class="win-pill-info">
            <div class="win-pill-name">#${p.seat} ${p.name} ${p.isLover ? '💘' : ''} ${p.isMayor ? '👑' : ''}</div>
            <div class="win-pill-role ${roleData.team === 'Werewolf' ? 'team-wolf' : 'team-town'}">${p.role} · ${isDead ? '💀 Dead' : '✨ Alive'}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  overlay.classList.add('show');
  soundManager.playFanfare();

  // 6-second auto-return countdown to Lobby
  if (gameOverCountdownTimer) clearInterval(gameOverCountdownTimer);
  let secondsLeft = 6;
  const countEl = document.getElementById('win-countdown-num');
  if (countEl) countEl.textContent = secondsLeft;

  gameOverCountdownTimer = setInterval(() => {
    secondsLeft--;
    if (countEl) countEl.textContent = secondsLeft;
    if (secondsLeft <= 0) {
      clearInterval(gameOverCountdownTimer);
      gameOverCountdownTimer = null;
      returnToLobbyFromGameOver(callbacks);
    }
  }, 1000);
}

export function closeWinOverlay() {
  const overlay = document.getElementById('win-overlay');
  if (overlay) overlay.classList.remove('show');
  if (gameOverCountdownTimer) {
    clearInterval(gameOverCountdownTimer);
    gameOverCountdownTimer = null;
  }
}

export function returnToLobbyFromGameOver(callbacks = {}) {
  if (gameOverCountdownTimer) {
    clearInterval(gameOverCountdownTimer);
    gameOverCountdownTimer = null;
  }
  closeWinOverlay();
  gameState.inProgress = false;
  if (typeof callbacks.pauseTimer === 'function') callbacks.pauseTimer();
  saveAppState();
  if (typeof callbacks.switchNavTab === 'function') {
    callbacks.switchNavTab('lobby');
  } else if (typeof window !== 'undefined' && typeof window.switchNavTab === 'function') {
    window.switchNavTab('lobby');
  }
}

export function stayAndViewTable() {
  if (gameOverCountdownTimer) {
    clearInterval(gameOverCountdownTimer);
    gameOverCountdownTimer = null;
  }
  closeWinOverlay();
}
