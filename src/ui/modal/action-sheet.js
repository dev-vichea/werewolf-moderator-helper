/**
 * Player Action Sheet
 * Triggered by long-pressing / holding a player's card to quickly view or edit role, status, or notes.
 */
import { gameState, lobbyState, uiState } from '../../state/store.js';
import { getRoleData, getRoleImage } from '../../state/roles.js';
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
    const isDoppel = (p.role === 'Doppelganger' || p.id === gameState.nightActions.doppelgangerPlayer || p.assumedRoleFrom);
    if (isDoppel) {
      doppelRow.style.display = 'block';
      const targetP = gameState.nightActions.doppelgangerTarget ? gameState.players.find(x => x.id === gameState.nightActions.doppelgangerTarget) : null;
      const targetBtn = document.getElementById('sheet-doppelganger-btn');
      if (targetBtn) {
        if (targetP) {
          targetBtn.innerHTML = `🎭 Target: #${targetP.seat} ${targetP.name} <span style="opacity:0.75; font-size:0.75rem;">(Tap to change)</span>`;
        } else {
          targetBtn.innerHTML = `🎭 Link Target to Copy if They Die`;
        }
      }
      const showTargetBtn = document.getElementById('sheet-doppelganger-show-target-btn');
      if (showTargetBtn) {
        if (targetP) {
          showTargetBtn.style.display = 'block';
          showTargetBtn.textContent = `🎴 Show #${targetP.seat} ${targetP.name}'s Card (${targetP.role}) to Doppelgänger`;
          showTargetBtn.onclick = () => openFullCardView(targetP.id);
        } else {
          showTargetBtn.style.display = 'none';
        }
      }
    } else {
      doppelRow.style.display = 'none';
    }
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

  const currentTarget = gameState.players.find(p => p.id === gameState.nightActions.doppelgangerTarget);
  const options = gameState.players.filter(p => p.id !== doppel.id && p.status === 'alive');
  if (options.length === 0) {
    showCustomAlert('No other living players in the game to link with!');
    return;
  }

  const currentInfo = currentTarget ? `Currently linked to: #${currentTarget.seat} ${currentTarget.name}\n\n` : '';
  const list = options.map(p => `#${p.seat} ${p.name}`).join('\n');
  const targetSeat = prompt(`${currentInfo}Enter seat number of player for Doppelgänger to secretly copy if they die:\n\n${list}`);
  if (!targetSeat) return;

  const chosen = options.find(p => String(p.seat) === targetSeat.trim());
  if (!chosen) {
    showCustomAlert('Invalid seat number selected.');
    return;
  }

  gameState.nightActions.doppelgangerTarget = chosen.id;
  gameState.nightActions.doppelgangerPlayer = doppel.id;
  doppel.doppelTarget = chosen.id;
  soundManager.playChime();
  showCustomAlert(`🎭 Doppelgänger linked with #${chosen.seat} ${chosen.name}!\n\nIf #${chosen.seat} ${chosen.name} dies, Doppelgänger will secretly assume their role and abilities.`);
  if (typeof callbacks.addHistoryLog === 'function') {
    callbacks.addHistoryLog('Doppelgänger Link', `Doppelgänger (${doppel.name}) linked with #${chosen.seat} ${chosen.name} to copy if they die.`);
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

export function sheetOpenFullCardView() {
  if (!uiState.sheetTargetPlayerId) return;
  openFullCardView(uiState.sheetTargetPlayerId);
}

export function openFullCardView(playerId) {
  const p = gameState.players.find(x => x.id === playerId);
  if (!p) return;

  const backdrop = document.getElementById('full-card-view-backdrop');
  const contentEl = document.getElementById('full-card-content');
  if (!backdrop || !contentEl) return;

  const roleData = getRoleData(p.role);
  const team = roleData.team || 'Town';
  const teamLower = team.toLowerCase();
  const teamEmoji = team === 'Werewolf' ? '🐺' : (team === 'Neutral' ? '🎭' : '🛡️');

  // Check Doppelgänger details
  let doppelExtraHtml = '';
  if (p.role === 'Doppelganger' || p.id === gameState.nightActions.doppelgangerPlayer) {
    if (gameState.nightActions.doppelgangerTarget) {
      const targetP = gameState.players.find(x => x.id === gameState.nightActions.doppelgangerTarget);
      if (targetP) {
        doppelExtraHtml = `
          <div class="full-card-extra-box">
            <span>🎭 Linked to: <strong>#${targetP.seat} ${targetP.name}</strong> (${targetP.role})</span>
            <button type="button" class="btn btn-outline" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; border-color: #ec4899; color: #f472b6; font-weight: 700;" onclick="openFullCardView('${targetP.id}')">
              Show #${targetP.seat} Role 👁️
            </button>
          </div>
        `;
      }
    }
  }

  // If this player assumed role from someone
  if (p.assumedRoleFrom) {
    const orig = gameState.players.find(x => x.id === p.assumedRoleFrom);
    if (orig) {
      doppelExtraHtml = `
        <div class="full-card-extra-box">
          <span>🎭 Originally Doppelgänger — Secretly assumed role from <strong>#${orig.seat} ${orig.name}</strong></span>
        </div>
      `;
    }
  }

  // If this player is the target of Doppelgänger
  if (gameState.nightActions.doppelgangerTarget === p.id) {
    const doppelP = gameState.players.find(x => x.id === gameState.nightActions.doppelgangerPlayer || x.role === 'Doppelganger');
    doppelExtraHtml = `
      <div class="full-card-extra-box">
        <span>🎭 Linked Target for Doppelgänger ${doppelP ? `(#${doppelP.seat} ${doppelP.name})` : ''}</span>
      </div>
    `;
  }

  contentEl.innerHTML = `
    <div class="full-card-body card-team-${teamLower}">
      <div class="full-card-header">
        <div class="full-card-seat-pill">#${p.seat} ${p.name}</div>
        <div class="full-card-team-badge team-${teamLower}">${teamEmoji} ${team} Team</div>
      </div>

      <div class="full-card-art-box">
        <img src="${getRoleImage(p.role)}" class="full-card-img" alt="${p.role}" onerror="this.src='images/anonymous.jpeg'">
        <div class="full-card-gradient"></div>
        <div class="full-card-role-banner">
          <h2 class="full-card-role-title">${p.role === 'Unknown' ? 'Unknown Role' : p.role}</h2>
          <span class="full-card-status-pill ${p.status === 'alive' ? 'status-alive' : 'status-dead'}">
            ${p.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div class="full-card-desc-box">
        <div class="full-card-desc-label">ROLE ABILITIES & RULES</div>
        <p class="full-card-desc-text">${roleData.desc || 'No description available.'}</p>
        ${doppelExtraHtml}
      </div>
    </div>
  `;

  soundManager.playChime();
  backdrop.style.display = 'flex';
  void backdrop.offsetWidth;
  backdrop.classList.add('open');
}

export function closeFullCardView() {
  const backdrop = document.getElementById('full-card-view-backdrop');
  if (backdrop) {
    backdrop.classList.remove('open');
    setTimeout(() => {
      if (!backdrop.classList.contains('open')) {
        backdrop.style.display = 'none';
      }
    }, 200);
  }
}

