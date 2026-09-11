/**
 * LocalStorage Persistence Helpers
 */
import { lobbyState, gameState, uiState } from './store.js';

export function loadAppState(loadPresetFn) {
  if (typeof localStorage === 'undefined') return;

  const savedLobby = localStorage.getItem('ww_touch_lobby_v3');
  if (savedLobby) {
    try { Object.assign(lobbyState, JSON.parse(savedLobby)); } catch (e) {}
  } else if (typeof loadPresetFn === 'function') {
    loadPresetFn(8);
  }

  const savedGame = localStorage.getItem('ww_touch_game_v3');
  if (savedGame) {
    try { Object.assign(gameState, JSON.parse(savedGame)); } catch (e) {}
  }

  if (gameState.inProgress && gameState.players.length > 0) {
    uiState.activeTab = 'game';
    if (gameState.phase === 'NIGHT' && gameState.currentNight >= 2) {
      uiState.callerSubMode = 'target';
    }
  } else {
    uiState.activeTab = 'lobby';
  }
}

export function saveAppState() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('ww_touch_lobby_v3', JSON.stringify(lobbyState));
    localStorage.setItem('ww_touch_game_v3', JSON.stringify(gameState));
  } catch (e) {}
}
