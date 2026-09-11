/**
 * Lobby Screen: Player roster management & Role deck builder
 */
import { lobbyState } from '../../state/store.js';
import { ROLES_CATALOG } from '../../state/roles.js';
import { soundManager } from '../../audio/sound.js';
import { saveAppState } from '../../state/storage.js';

export function renderLobby() {
  renderLobbyPlayers();
  renderRoleDeckGrid();
  updateDeckStatus();
  const timerSelect = document.getElementById('lobby-timer-select');
  if (timerSelect) {
    timerSelect.value = lobbyState.discussionTimer || 90;
  }
}

export function addLobbyPlayer() {
  const input = document.getElementById('lobby-player-input');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;

  lobbyState.players.push(name);
  input.value = '';
  input.focus();
  saveAppState();
  renderLobbyPlayers();
  updateDeckStatus();
}

export function addLobbyBatchPlayers() {
  const input = document.getElementById('lobby-batch-input');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;

  const names = raw.split(/[,;\n]+/).map(n => n.trim()).filter(n => n);
  if (names.length === 0) return;

  names.forEach(n => lobbyState.players.push(n));
  input.value = '';
  saveAppState();
  renderLobbyPlayers();
  updateDeckStatus();
}

export function removeLobbyPlayer(index) {
  lobbyState.players.splice(index, 1);
  saveAppState();
  renderLobbyPlayers();
  updateDeckStatus();
}

export function renderLobbyPlayers() {
  const listEl = document.getElementById('lobby-players-list');
  const countBadge = document.getElementById('lobby-player-count-badge');
  if (!listEl || !countBadge) return;

  const count = lobbyState.players.length;
  countBadge.textContent = `${count} Player${count === 1 ? '' : 's'}`;

  if (count === 0) {
    listEl.innerHTML = `<div style="color: var(--text-dim); font-size: 0.85rem; padding: 0.5rem 0;">No players added yet. Add player names above!</div>`;
    return;
  }

  listEl.innerHTML = lobbyState.players.map((name, i) => `
    <div class="lobby-player-chip">
      <span class="lobby-chip-seat">#${i + 1}</span>
      <span>${name}</span>
      <button class="lobby-chip-remove" onclick="removeLobbyPlayer(${i})" title="Remove">✕</button>
    </div>
  `).join('');
}

export function adjustRoleCount(roleName, delta) {
  const current = lobbyState.roleDeck[roleName] || 0;
  const next = Math.max(0, current + delta);
  if (next === 0) {
    delete lobbyState.roleDeck[roleName];
  } else {
    lobbyState.roleDeck[roleName] = next;
  }
  soundManager.playBeep();
  saveAppState();
  renderRoleDeckGrid();
  updateDeckStatus();
}

export function renderRoleDeckGrid() {
  const container = document.getElementById('role-deck-grid');
  if (!container) return;

  container.innerHTML = ROLES_CATALOG.map(r => {
    const count = lobbyState.roleDeck[r.name] || 0;
    return `
      <div class="role-deck-card ${count > 0 ? 'has-count' : ''}">
        <img src="${r.image}" class="deck-card-img" alt="${r.name}" onerror="this.src='images/villager.jpeg'">
        <div class="deck-card-name" title="${r.name}">${r.name}</div>
        <div class="deck-card-counter">
          <button class="counter-btn" onclick="adjustRoleCount('${r.name}', -1)">-</button>
          <span class="counter-val" style="color: ${count > 0 ? '#c084fc' : 'var(--text-muted)'};">${count}</span>
          <button class="counter-btn" onclick="adjustRoleCount('${r.name}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');
}

export function getTotalDeckCount() {
  return Object.values(lobbyState.roleDeck).reduce((sum, v) => sum + v, 0);
}

export function updateDeckStatus() {
  const playerCount = lobbyState.players.length;
  const deckCount = getTotalDeckCount();
  const badge = document.getElementById('lobby-deck-count-badge');
  const statusText = document.getElementById('deck-status-text');
  const autoFillBtn = document.getElementById('auto-fill-btn');
  if (!badge || !statusText) return;

  badge.textContent = `${deckCount} / ${playerCount} Roles`;

  if (playerCount === 0) {
    statusText.innerHTML = `Add your players first to configure role balance.`;
    statusText.style.color = 'var(--text-muted)';
    if (autoFillBtn) autoFillBtn.style.display = 'none';
    return;
  }

  if (deckCount === playerCount) {
    const wolves = lobbyState.roleDeck['Werewolf'] || 0;
    const town = deckCount - wolves;
    statusText.innerHTML = `✅ <strong>${deckCount} Roles</strong> match <strong>${playerCount} Players</strong> (${wolves} 🐺 vs ${town} 🧑)`;
    statusText.style.color = '#4ade80';
    if (autoFillBtn) autoFillBtn.style.display = 'none';
  } else if (deckCount < playerCount) {
    const diff = playerCount - deckCount;
    statusText.innerHTML = `⚠️ Need <strong>${diff} more role${diff > 1 ? 's' : ''}</strong> to match ${playerCount} players.`;
    statusText.style.color = '#fbbf24';
    if (autoFillBtn) {
      autoFillBtn.style.display = 'inline-flex';
      autoFillBtn.textContent = `+ Add ${diff} Villager${diff > 1 ? 's' : ''}`;
    }
  } else {
    const diff = deckCount - playerCount;
    statusText.innerHTML = `⚠️ Remove <strong>${diff} role${diff > 1 ? 's' : ''}</strong> to match player count.`;
    statusText.style.color = '#f87171';
    if (autoFillBtn) autoFillBtn.style.display = 'none';
  }
}

export function autoFillVillagers() {
  const diff = lobbyState.players.length - getTotalDeckCount();
  if (diff > 0) {
    lobbyState.roleDeck['Villager'] = (lobbyState.roleDeck['Villager'] || 0) + diff;
    saveAppState();
    renderRoleDeckGrid();
    updateDeckStatus();
  }
}

export function loadLobbyPreset(count) {
  const presets = {
    6: { 'Werewolf': 2, 'Seer': 1, 'Witch': 1, 'Villager': 2 },
    8: { 'Werewolf': 2, 'Seer': 1, 'Witch': 1, 'Bodyguard': 1, 'Villager': 3 },
    10: { 'Werewolf': 3, 'Seer': 1, 'Witch': 1, 'Bodyguard': 1, 'Hunter': 1, 'Villager': 3 },
    12: { 'Werewolf': 3, 'Seer': 1, 'Witch': 1, 'Bodyguard': 1, 'Hunter': 1, 'Cupid': 1, 'Villager': 4 }
  };
  lobbyState.roleDeck = Object.assign({}, presets[count] || presets[8]);
  saveAppState();
  renderRoleDeckGrid();
  updateDeckStatus();
}

export function clearRoleDeck() {
  lobbyState.roleDeck = {};
  saveAppState();
  renderRoleDeckGrid();
  updateDeckStatus();
}
