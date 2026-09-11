/**
 * Event History Log & Roles Guide Screen
 */
import { gameState } from '../../state/store.js';
import { ROLES_CATALOG } from '../../state/roles.js';
import { saveAppState } from '../../state/storage.js';
import { showCustomConfirm } from '../../ui/dialog.js';
import { showGameToast } from '../../ui/toast.js';

export function switchLogSubtab(tab) {
  const logBtn = document.getElementById('subtab-log');
  const rolesBtn = document.getElementById('subtab-roles');
  const logContent = document.getElementById('subtab-content-log');
  const rolesContent = document.getElementById('subtab-content-roles');

  if (!logBtn || !rolesBtn || !logContent || !rolesContent) return;

  if (tab === 'log') {
    logBtn.className = 'btn btn-primary';
    rolesBtn.className = 'btn btn-outline';
    logContent.style.display = 'block';
    rolesContent.style.display = 'none';
    renderHistoryTimeline();
  } else {
    logBtn.className = 'btn btn-outline';
    rolesBtn.className = 'btn btn-primary';
    logContent.style.display = 'none';
    rolesContent.style.display = 'block';
    renderRolesGuide();
  }
}

export function addHistoryLog(type, text) {
  const entry = {
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    type: type,
    text: text
  };
  gameState.history.unshift(entry);
  if (gameState.history.length > 50) gameState.history.pop();
  saveAppState();
}

export function renderHistoryTimeline() {
  const container = document.getElementById('history-timeline-list');
  if (!container) return;
  container.innerHTML = (gameState.history || []).map(item => `
    <div class="history-entry">
      <div class="history-entry-time">[${item.time}] ${item.type}</div>
      <div style="color: var(--text-primary);">${item.text}</div>
    </div>
  `).join('') || '<div style="color: var(--text-muted); font-size: 0.85rem;">No events recorded yet.</div>';
}

export function clearHistoryLog() {
  showCustomConfirm('Clear game event history log?', {
    icon: '📜',
    title: 'Clear Event History',
    confirmText: 'Clear Log',
    confirmClass: 'btn-danger',
    onConfirm: () => {
      gameState.history = [];
      saveAppState();
      renderHistoryTimeline();
      showGameToast('Event log cleared');
    }
  });
}

export function renderRolesGuide() {
  const container = document.getElementById('roles-guide-list');
  if (!container) return;
  container.innerHTML = ROLES_CATALOG.map(r => `
    <div class="role-deck-card" style="padding: 0.85rem;">
      <img src="${r.image}" class="deck-card-img" style="width: 64px; height: 64px;" onerror="this.src='images/villager.jpeg'">
      <strong style="font-size: 0.95rem;">${r.name}</strong>
      <span style="font-size: 0.75rem; color: #a855f7; font-weight: 700;">${r.team}</span>
      <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.35rem;">${r.desc}</p>
    </div>
  `).join('');
}
