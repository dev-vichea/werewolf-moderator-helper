/**
 * Hunter Elimination Revenge Queue & Modal
 */
import { gameState } from '../../state/store.js';
import { getRoleImage } from '../../state/roles.js';
import { soundManager } from '../../audio/sound.js';
import { saveAppState } from '../../state/storage.js';
import { showCustomConfirm } from '../dialog.js';

let pendingHunterRevengeQueue = [];
export let currentRevengeHunter = null;
export function getCurrentRevengeHunter() { return currentRevengeHunter; }
export function setCurrentRevengeHunter(val) {
  currentRevengeHunter = val;
}

export function triggerHunterRevenge(hunterPlayer) {
  if (!hunterPlayer) return;
  pendingHunterRevengeQueue.push(hunterPlayer);
  processNextHunterRevenge();
}

export function processNextHunterRevenge() {
  if (pendingHunterRevengeQueue.length === 0) return;
  const modal = document.getElementById('hunter-revenge-modal');
  if (modal && modal.classList && modal.classList.contains && modal.classList.contains('show')) return;

  const hunter = pendingHunterRevengeQueue.shift();
  openHunterRevengeModal(hunter);
}

export function openHunterRevengeModal(hunter) {
  setCurrentRevengeHunter(hunter);
  const modal = document.getElementById('hunter-revenge-modal');
  if (!modal) return;

  const descEl = document.getElementById('hunter-revenge-desc');
  if (descEl) {
    descEl.innerHTML = `🏹 <strong>#${hunter.seat} ${hunter.name}</strong> was eliminated!<br>The Hunter may immediately take another player down with them.`;
  }

  const listEl = document.getElementById('hunter-revenge-target-list');
  if (listEl) {
    const aliveTargets = gameState.players.filter(p => p.status === 'alive' && p.id !== hunter.id);
    if (aliveTargets.length === 0) {
      listEl.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted); font-style: italic; text-align: center; padding: 1rem;">No alive players left to shoot.</div>`;
    } else {
      listEl.innerHTML = aliveTargets.map(p => `
        <button class="hunter-target-btn" onclick="executeHunterRevenge('${p.id}')">
          <img src="${getRoleImage(p.role)}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.25); flex-shrink: 0;" onerror="this.src='images/anonymous.jpeg'">
          <div style="overflow: hidden; flex: 1;">
            <div style="font-weight: 700; font-size: 0.85rem; color: #fff; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">#${p.seat} ${p.name}</div>
            <div style="font-size: 0.72rem; color: #f87171; font-weight: 600;">💥 Eliminate</div>
          </div>
        </button>
      `).join('');
    }
  }

  modal.classList.add('show');
  soundManager.playGong();
}

export function executeHunterRevenge(targetId, callbacks = {}) {
  if (!currentRevengeHunter) return;
  const hunter = currentRevengeHunter;
  const target = gameState.players.find(p => p.id === targetId);
  if (!target || target.status === 'dead') {
    closeHunterRevengeModal();
    return;
  }

  target.status = 'dead';
  soundManager.playGong();
  if (typeof callbacks.addHistoryLog === 'function') {
    callbacks.addHistoryLog('🏹 Hunter Revenge', `${hunter.name} took down #${target.seat} ${target.name} with their final shot!`);
  }

  // Check Doppelganger trigger
  if (typeof callbacks.checkDoppelgangerTrigger === 'function') {
    callbacks.checkDoppelgangerTrigger(target.id);
  }

  // Lover heartbreak check
  if (target.isLover) {
    const partner = gameState.players.find(x => x.isLover && x.id !== target.id && x.status === 'alive');
    if (partner) {
      showCustomConfirm(`💘 ${target.name} was in love with ${partner.name}! Does ${partner.name} die of heartbreak?`, {
        icon: '💔',
        title: 'Heartbreak Tragedy',
        confirmText: '💀 Dies of Heartbreak',
        confirmClass: 'btn-danger',
        onConfirm: () => {
          partner.status = 'dead';
          if (typeof callbacks.addHistoryLog === 'function') {
            callbacks.addHistoryLog('Heartbreak', `${partner.name} died of grief after lover ${target.name} was shot.`);
          }
          if (typeof callbacks.checkDoppelgangerTrigger === 'function') {
            callbacks.checkDoppelgangerTrigger(partner.id);
          }
          if (partner.role === 'Hunter') {
            triggerHunterRevenge(partner);
          }
          saveAppState();
          if (typeof callbacks.renderGameScreen === 'function') callbacks.renderGameScreen();
          if (typeof callbacks.checkWinCondition === 'function') callbacks.checkWinCondition();
        }
      });
    }
  }

  // Chained revenge if target was also Hunter
  if (target.role === 'Hunter') {
    triggerHunterRevenge(target);
  }

  closeHunterRevengeModal();
  saveAppState();
  if (typeof callbacks.renderGameScreen === 'function') callbacks.renderGameScreen();
  if (typeof callbacks.checkWinCondition === 'function') callbacks.checkWinCondition();
  processNextHunterRevenge();
}

export function passHunterRevenge(callbacks = {}) {
  if (currentRevengeHunter) {
    if (typeof callbacks.addHistoryLog === 'function') {
      callbacks.addHistoryLog('Hunter Revenge Pass', `${currentRevengeHunter.name} chose not to shoot anyone upon elimination.`);
    }
  }
  closeHunterRevengeModal();
  processNextHunterRevenge();
}

export function closeHunterRevengeModal() {
  const modal = document.getElementById('hunter-revenge-modal');
  if (modal) modal.classList.remove('show');
  setCurrentRevengeHunter(null);
}
