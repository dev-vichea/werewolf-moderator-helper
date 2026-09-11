/**
 * Player Action Sheet
 * Triggered by long-pressing / holding a player's card to quickly view or edit role, status, or notes.
 */
import { gameState, lobbyState, uiState } from '../../state/store.js';
import { getRoleData } from '../../state/roles.js';
import { soundManager } from '../../audio/sound.js';
import { saveAppState } from '../../state/storage.js';
import { showCustomAlert } from '../dialog.js';

export function openPlayerActionSheet(playerId) {
  uiState.sheetTargetPlayerId = playerId;
  const p = gameState.players.find(x => x.id === playerId);
  if (!p) return;

  const seatEl = document.getElementById('sheet-player-seat');
  if (seatEl) seatEl.textContent = `#${p.seat}`;
  const nameInput = document.getElementById('sheet-player-name-input');
  if (nameInput) nameInput.value = p.name;
  const oldNameEl = document.getElementById('sheet-player-name');
  if (oldNameEl) oldNameEl.textContent = `#${p.seat} ${p.name}`;

  const roleText = p.role === 'Unknown' ? 'Unknown (Hidden)' : p.role;
  document.getElementById('sheet-player-role').textContent = `${roleText} (${p.status.toUpperCase()})`;
  document.getElementById('sheet-player-notes').value = p.notes || '';

  // 1-Tap Role Quick Picker Grid: Random first + Unknown + all 14 roles!
  const pickerEl = document.getElementById('sheet-role-picker');
  const allRoles = ['Unknown', 'Villager', 'Werewolf', 'Seer', 'Bodyguard', 'Witch', 'Hunter', 'Cupid', 'Mason', 'Spellcaster', 'Lycan', 'Doppelganger', 'Tanner', 'Cursed', 'Prince'];
  const randomChip = `
    <button class="sheet-role-btn sheet-random-role-btn" onclick="sheetAssignRandomRole()" title="Assign a random unassigned role from deck">
      <span style="font-size: 1.3rem;">🎲</span>
      <span style="color: #c084fc; font-weight: 800;">Random</span>
    </button>
  `;
  pickerEl.innerHTML = randomChip + allRoles.map(r => {
    const rData = getRoleData(r);
    const isActive = (p.role.toLowerCase() === r.toLowerCase());
    return `
      <button class="sheet-role-btn ${isActive ? 'active' : ''}" onclick="sheetSetRole('${r}')">
        <img src="${rData.image}" class="sheet-role-avatar" alt="${r}" onerror="this.src='images/anonymous.jpeg'">
        <span>${r}</span>
      </button>
    `;
  }).join('');

  const lifeBtn = document.getElementById('sheet-toggle-life-btn');
  lifeBtn.textContent = p.status === 'alive' ? '💀 Kill Player' : '💚 Revive Player';
  lifeBtn.className = p.status === 'alive' ? 'btn btn-danger' : 'btn btn-success';

  document.getElementById('sheet-toggle-mayor-btn').textContent = p.isMayor ? '👑 Remove Mayor' : '👑 Make Mayor';
  document.getElementById('sheet-toggle-lover-btn').textContent = p.isLover ? '💘 Remove Lover' : '💘 Make Lover';

  const shieldBtn = document.getElementById('sheet-toggle-shield-btn');
  if (shieldBtn) {
    shieldBtn.textContent = p.isShielded ? '🛡️ Remove Shield' : '🛡️ Give Shield';
    shieldBtn.className = p.isShielded ? 'btn btn-warning' : 'btn btn-outline';
  }

  const silenceBtn = document.getElementById('sheet-toggle-silence-btn');
  if (silenceBtn) {
    silenceBtn.textContent = p.isSilenced ? '🤐 Unsilence' : '🤐 Silence';
    silenceBtn.className = p.isSilenced ? 'btn btn-warning' : 'btn btn-outline';
  }

  // Doppelganger target setting row
  const doppelRow = document.getElementById('sheet-doppelganger-row');
  if (doppelRow) {
    doppelRow.style.display = (p.role === 'Doppelganger') ? 'block' : 'none';
  }

  document.getElementById('player-action-sheet-backdrop').classList.add('open');
}

export function closePlayerActionSheet() {
  const backdrop = (typeof document !== 'undefined') ? document.getElementById('player-action-sheet-backdrop') : null;
  if (backdrop) backdrop.classList.remove('open');
  uiState.sheetTargetPlayerId = null;
}

export function sheetSaveName(newName, callbacks = {}) {
  if (!uiState.sheetTargetPlayerId) return;
  const p = gameState.players.find(x => x.id === uiState.sheetTargetPlayerId);
  if (!p) return;
  const trimmed = newName.trim();
  if (!trimmed) return;
  p.name = trimmed;
  if (lobbyState.players && lobbyState.players[p.seat - 1] !== undefined) {
    lobbyState.players[p.seat - 1] = trimmed;
  }
  soundManager.playBeep();
  if (typeof callbacks.addHistoryLog === 'function') {
    callbacks.addHistoryLog('Renamed', `Seat #${p.seat} renamed to ${trimmed}`);
  }
  saveAppState();
  if (typeof callbacks.renderGameScreen === 'function') {
    callbacks.renderGameScreen();
  }
}

export function sheetSetRole(newRole, callbacks = {}) {
  if (!uiState.sheetTargetPlayerId) return;
  const p = gameState.players.find(x => x.id === uiState.sheetTargetPlayerId);
  if (!p) return;

  p.role = newRole;
  soundManager.playChime();
  if (typeof callbacks.addHistoryLog === 'function') {
    callbacks.addHistoryLog('Role Changed', `Changed #${p.seat} ${p.name} to ${newRole}`);
  }
  saveAppState();
  closePlayerActionSheet();
  if (typeof callbacks.smartAutoFillRemainingRoles === 'function') {
    callbacks.smartAutoFillRemainingRoles();
  }
  if (typeof callbacks.renderGameScreen === 'function') {
    callbacks.renderGameScreen();
  }
}

export function sheetAssignRandomRole(callbacks = {}) {
  if (!uiState.sheetTargetPlayerId) return;
  const p = gameState.players.find(x => x.id === uiState.sheetTargetPlayerId);
  if (!p) return;

  const deck = lobbyState.roleDeck || {};
  const assignedCounts = {};
  gameState.players.forEach(player => {
    if (player.id !== p.id && player.role && player.role !== 'Unknown') {
      assignedCounts[player.role] = (assignedCounts[player.role] || 0) + 1;
    }
  });

  const missingRoles = [];
  for (const [roleName, targetCount] of Object.entries(deck)) {
    const assigned = assignedCounts[roleName] || 0;
    if (assigned < targetCount) {
      for (let i = 0; i < targetCount - assigned; i++) {
        missingRoles.push(roleName);
      }
    }
  }

  const pool = missingRoles.length > 0
    ? missingRoles
    : ['Villager', 'Werewolf', 'Seer', 'Bodyguard', 'Witch', 'Hunter', 'Cupid', 'Spellcaster', 'Tanner', 'Mason'];

  const randomRole = pool[Math.floor(Math.random() * pool.length)];
  p.role = randomRole;

  soundManager.playChime();
  showGameToast(`🎲 Random: #${p.seat} ${p.name} assigned as ${randomRole}!`);
  if (typeof callbacks.addHistoryLog === 'function') {
    callbacks.addHistoryLog('Random Role', `Randomly set #${p.seat} ${p.name} to ${randomRole}`);
  }

  saveAppState();
  closePlayerActionSheet();

  if (typeof callbacks.smartAutoFillRemainingRoles === 'function') {
    callbacks.smartAutoFillRemainingRoles();
  }
  if (typeof callbacks.renderGameScreen === 'function') {
    callbacks.renderGameScreen();
  } else if (typeof globalThis.renderGameScreen === 'function') {
    globalThis.renderGameScreen();
  }
}

export function sheetSetDoppelgangerTargetPrompt(callbacks = {}) {
  if (!uiState.sheetTargetPlayerId) return;
  const doppel = gameState.players.find(x => x.id === uiState.sheetTargetPlayerId);
  if (!doppel) return;

  const options = gameState.players.filter(p => p.id !== doppel.id && p.status === 'dead');
  if (options.length === 0) {
    alert('No deceased players in the game yet! Doppelganger can only take the role of someone who has died.');
    return;
  }

  const list = options.map(p => `#${p.seat} ${p.name} (Role: ${p.role})`).join('\n');
  const targetSeat = prompt(`Enter seat number of deceased player for Doppelganger to become:\n\n${list}`);
  if (!targetSeat) return;

  const chosen = options.find(p => String(p.seat) === targetSeat.trim());
  if (!chosen) {
    alert('Invalid seat number selected.');
    return;
  }

  const inheritedRole = (chosen.role && chosen.role !== 'Unknown') ? chosen.role : 'Villager';
  doppel.role = inheritedRole;
  gameState.nightActions.doppelgangerTarget = chosen.id;
  soundManager.playFanfare();
  alert(`🎭 Doppelganger took deceased #${chosen.seat} ${chosen.name}'s role and is now a ${inheritedRole}!\nHer card is updated immediately!`);
  if (typeof callbacks.addHistoryLog === 'function') {
    callbacks.addHistoryLog('Doppelganger Transform', `${doppel.name} took deceased ${chosen.name}'s role and became ${inheritedRole}.`);
  }
  if (typeof callbacks.smartAutoFillRemainingRoles === 'function') {
    callbacks.smartAutoFillRemainingRoles();
  }
  saveAppState();
  closePlayerActionSheet();
  if (typeof callbacks.renderGameScreen === 'function') {
    callbacks.renderGameScreen();
  }
}

export function sheetToggleLife(callbacks = {}) {
  if (!uiState.sheetTargetPlayerId) return;
  const p = gameState.players.find(x => x.id === uiState.sheetTargetPlayerId);
  if (!p) return;
  p.status = p.status === 'alive' ? 'dead' : 'alive';
  soundManager.playBeep();
  if (typeof callbacks.addHistoryLog === 'function') {
    callbacks.addHistoryLog('Moderator Override', `${p.name} set to ${p.status.toUpperCase()}`);
  }
  if (p.status === 'dead') {
    if (typeof callbacks.checkDoppelgangerTrigger === 'function') {
      callbacks.checkDoppelgangerTrigger(p.id);
    }
    if (p.role === 'Hunter' && typeof callbacks.triggerHunterRevenge === 'function') {
      callbacks.triggerHunterRevenge(p);
    }
  }
  saveAppState();
  closePlayerActionSheet();
  if (typeof callbacks.renderGameScreen === 'function') {
    callbacks.renderGameScreen();
  }
  if (typeof callbacks.checkWinCondition === 'function') {
    callbacks.checkWinCondition();
  }
}

export function sheetToggleMayor(callbacks = {}) {
  if (!uiState.sheetTargetPlayerId) return;
  const p = gameState.players.find(x => x.id === uiState.sheetTargetPlayerId);
  if (!p) return;
  p.isMayor = !p.isMayor;
  if (p.isMayor) {
    gameState.players.forEach(o => { if (o.id !== p.id) o.isMayor = false; });
  }
  soundManager.playBeep();
  saveAppState();
  closePlayerActionSheet();
  if (typeof callbacks.renderGameScreen === 'function') {
    callbacks.renderGameScreen();
  }
}

export function sheetToggleLover(callbacks = {}) {
  if (!uiState.sheetTargetPlayerId) return;
  const p = gameState.players.find(x => x.id === uiState.sheetTargetPlayerId);
  if (!p) return;
  p.isLover = !p.isLover;
  soundManager.playBeep();
  saveAppState();
  closePlayerActionSheet();
  if (typeof callbacks.renderGameScreen === 'function') {
    callbacks.renderGameScreen();
  }
}

export function sheetToggleShield(callbacks = {}) {
  if (!uiState.sheetTargetPlayerId) return;
  const p = gameState.players.find(x => x.id === uiState.sheetTargetPlayerId);
  if (!p) return;
  p.isShielded = !p.isShielded;
  if (!p.isShielded && gameState.nightActions.bodyguardTarget === p.id) {
    gameState.nightActions.bodyguardTarget = null;
  }
  soundManager.playBeep();
  showGameToast(p.isShielded ? `🛡️ #${p.seat} ${p.name} is now shielded!` : `🛡️ Shield removed from #${p.seat} ${p.name}.`);
  if (typeof callbacks.addHistoryLog === 'function') {
    callbacks.addHistoryLog('Shield Override', `${p.name} ${p.isShielded ? 'granted shield 🛡️' : 'shield removed'}`);
  }
  saveAppState();
  closePlayerActionSheet();
  if (typeof callbacks.renderGameScreen === 'function') {
    callbacks.renderGameScreen();
  } else if (typeof globalThis.renderGameScreen === 'function') {
    globalThis.renderGameScreen();
  }
}

export function sheetToggleSilence(callbacks = {}) {
  if (!uiState.sheetTargetPlayerId) return;
  const p = gameState.players.find(x => x.id === uiState.sheetTargetPlayerId);
  if (!p) return;
  p.isSilenced = !p.isSilenced;
  if (!p.isSilenced && gameState.nightActions.spellcasterTarget === p.id) {
    gameState.nightActions.spellcasterTarget = null;
  }
  soundManager.playBeep();
  showGameToast(p.isSilenced ? `🤐 #${p.seat} ${p.name} is silenced!` : `🤐 Silence removed from #${p.seat} ${p.name}.`);
  if (typeof callbacks.addHistoryLog === 'function') {
    callbacks.addHistoryLog('Silence Override', `${p.name} ${p.isSilenced ? 'silenced 🤐' : 'unsilenced'}`);
  }
  saveAppState();
  closePlayerActionSheet();
  if (typeof callbacks.renderGameScreen === 'function') {
    callbacks.renderGameScreen();
  } else if (typeof globalThis.renderGameScreen === 'function') {
    globalThis.renderGameScreen();
  }
}

export function sheetSeerReveal() {
  if (!uiState.sheetTargetPlayerId) return;
  const p = gameState.players.find(x => x.id === uiState.sheetTargetPlayerId);
  if (!p) return;
  const isWerewolf = (p.role === 'Werewolf' || p.role === 'Lycan');

  if (isWerewolf) {
    const roleText = p.role === 'Lycan' ? 'Lycan (Appears as Werewolf)' : 'Werewolf';
    showCustomAlert(
      `#${p.seat} ${p.name}\n\nRole: ${roleText}`,
      {
        title: '🟢 Correct: Werewolf!',
        icon: '🐺',
        confirmText: 'Got It (Werewolf) 👍',
        confirmClass: 'btn-success',
        cardBorder: '#10b981',
        cardGlow: 'rgba(16, 185, 129, 0.4)'
      }
    );
  } else {
    showCustomAlert(
      `#${p.seat} ${p.name}\n\nRole: ${p.role}`,
      {
        title: '🔴 Wrong: Not Werewolf',
        icon: '❌',
        confirmText: 'Got It (Not Werewolf) 👎',
        confirmClass: 'btn-danger-solid',
        cardBorder: '#ef4444',
        cardGlow: 'rgba(239, 68, 68, 0.4)'
      }
    );
  }
}

export function sheetSaveNotes(notes) {
  if (!uiState.sheetTargetPlayerId) return;
  const p = gameState.players.find(x => x.id === uiState.sheetTargetPlayerId);
  if (!p) return;
  p.notes = notes;
  saveAppState();
}
