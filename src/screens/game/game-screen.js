/**
 * Game Screen Coordinator: Game Initialization, Top Bar, and Win Conditions
 */
import { gameState, lobbyState, uiState } from '../../state/store.js';
import { getRoleData } from '../../state/roles.js';
import { soundManager } from '../../audio/sound.js';
import { saveAppState } from '../../state/storage.js';
import { showCustomAlert, showCustomConfirm } from '../../ui/dialog.js';
import { showGameToast } from '../../ui/toast.js';
import { updateTimerDisplay, pauseTimer } from '../../utils/timer.js';
import { renderNightCaller, cancelAutoAdvance } from './night-caller.js';
import { renderTouchTable } from './table.js';
import { renderDayControls } from './day-phase.js';
import { showWinOverlay } from '../../ui/modal/win-modal.js';
import { getTotalDeckCount } from '../lobby/lobby-screen.js';

export function renderGameScreen() {
  renderGameTopBar();
  renderNightCaller();
  renderTouchTable();
}

export function renderGameTopBar() {
  const alive = gameState.players.filter(p => p.status === 'alive');
  const wolves = alive.filter(p => getRoleData(p.role).team === 'Werewolf').length;
  const vampires = alive.filter(p => getRoleData(p.role).team === 'Vampire').length;
  const town = alive.length - wolves - vampires;

  const statWolves = document.getElementById('game-stat-wolves');
  const statTown = document.getElementById('game-stat-town');
  const statVampires = document.getElementById('game-stat-vampires');
  if (statWolves) statWolves.textContent = wolves;
  if (statTown) statTown.textContent = town;
  if (statVampires) {
    const vampBadge = statVampires.closest ? statVampires.closest('.game-stat-badge') : statVampires.parentElement;
    if (vampires > 0) {
      statVampires.textContent = vampires;
      if (vampBadge) vampBadge.style.display = '';
    } else {
      if (vampBadge) vampBadge.style.display = 'none';
    }
  }

  const phasePill = document.getElementById('game-phase-pill');
  const callerBox = document.getElementById('night-caller-box');
  const dayControlsBar = document.getElementById('day-controls-bar');

  if (phasePill) {
    if (gameState.phase === 'NIGHT') {
      phasePill.className = 'game-phase-pill night';
      if (gameState.currentNight === 0) {
        phasePill.textContent = '🪑 Night 0: Seating';
        phasePill.style.background = 'rgba(56, 189, 248, 0.2)';
        phasePill.style.borderColor = '#38bdf8';
        phasePill.style.color = '#38bdf8';
      } else {
        phasePill.textContent = `🌙 Night ${gameState.currentNight}`;
        phasePill.style.background = '';
        phasePill.style.borderColor = '';
        phasePill.style.color = '';
      }
      if (callerBox) callerBox.style.display = 'block';
      if (dayControlsBar) dayControlsBar.style.display = 'none';
    } else {
      phasePill.className = 'game-phase-pill day';
      phasePill.textContent = `☀️ Day ${gameState.currentDay}`;
      phasePill.style.background = '';
      phasePill.style.borderColor = '';
      phasePill.style.color = '';
      if (callerBox) callerBox.style.display = 'none';
      if (dayControlsBar) dayControlsBar.style.display = 'flex';
      renderDayControls();
    }
  }

  updateTimerDisplay();
}

export function startGameDirectNight1(callbacks = {}) {
  if (lobbyState.players.length < 3) {
    showCustomAlert('Please add at least 3 players to start a Werewolf game!');
    return;
  }

  gameState.players = lobbyState.players.map((name, idx) => ({
    id: 'p_' + Date.now() + '_' + idx,
    seat: idx + 1,
    name: name,
    role: 'Unknown',
    status: 'alive',
    isMayor: false,
    isLover: false,
    checkedBySeer: false,
    notes: '',
    votes: 0
  }));

  gameState.inProgress = true;
  gameState.isPhysicalCardMode = true;
  gameState.phase = 'NIGHT';
  gameState.currentNight = 0; // Starts at Night 0 (Seating Setup)
  gameState.currentDay = 1;
  gameState.wizardStepIndex = 0;
  uiState.callerSubMode = 'seatSwap';
  uiState.selectedSwapSeatId = null;
  gameState.potions = { witchHealAvailable: true, witchPoisonAvailable: true };
  gameState.nightActions = {
    cupidLover1: null,
    cupidLover2: null,
    bodyguardTarget: null,
    bodyguardLastTarget: null,
    wolfTarget: null,
    witchHealed: false,
    witchHealTarget: null,
    witchPoisonTarget: null,
    witchArmPoison: false,
    seerTarget: null,
    spellcasterTarget: null,
    doppelgangerPlayer: null,
    doppelgangerTarget: null,
    vampireTarget: null,
    sorceressTarget: null
  };
  gameState.lastNightDeaths = [];
  gameState.priestShieldTarget = null;
  gameState.priestWakesTonight = true;
  gameState.history = [{ time: 'Start', text: `Game started at Night 0 (Seating Arrangement) with ${gameState.players.length} players.` }];

  const timerEl = document.getElementById('lobby-timer-select');
  const timerDuration = timerEl ? (parseInt(timerEl.value, 10) || 90) : 90;
  gameState.timerRemaining = timerDuration;
  lobbyState.discussionTimer = timerDuration;

  soundManager.playGong();
  saveAppState();
  if (typeof callbacks.switchNavTab === 'function') {
    callbacks.switchNavTab('game');
  } else if (typeof window !== 'undefined' && typeof window.switchNavTab === 'function') {
    window.switchNavTab('game');
  }
}

export function startPhysicalCardGame(callbacks = {}) {
  startGameDirectNight1(callbacks);
}

export function dealAndStartGame(callbacks = {}) {
  if (lobbyState.players.length < 3) {
    showCustomAlert('Please add at least 3 players to start a Werewolf game!');
    return;
  }

  const deckCount = getTotalDeckCount();
  if (deckCount !== lobbyState.players.length) {
    showCustomAlert(`Role count (${deckCount}) does not match player count (${lobbyState.players.length}). Balance the deck first!`);
    return;
  }

  const deckList = [];
  for (const [role, count] of Object.entries(lobbyState.roleDeck)) {
    for (let i = 0; i < count; i++) deckList.push(role);
  }

  for (let i = deckList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deckList[i], deckList[j]] = [deckList[j], deckList[i]];
  }

  gameState.players = lobbyState.players.map((name, idx) => ({
    id: 'p_' + Date.now() + '_' + idx,
    seat: idx + 1,
    name: name,
    role: deckList[idx],
    status: 'alive',
    isMayor: false,
    isLover: false,
    checkedBySeer: false,
    notes: '',
    votes: 0
  }));

  gameState.inProgress = true;
  gameState.isPhysicalCardMode = false;
  gameState.phase = 'NIGHT';
  gameState.currentNight = 0; // Starts at Night 0 (Seating Setup)
  gameState.currentDay = 1;
  gameState.wizardStepIndex = 0;
  uiState.callerSubMode = 'seatSwap';
  uiState.selectedSwapSeatId = null;
  gameState.potions = { witchHealAvailable: true, witchPoisonAvailable: true };
  gameState.nightActions = {
    cupidLover1: null,
    cupidLover2: null,
    bodyguardTarget: null,
    bodyguardLastTarget: null,
    wolfTarget: null,
    witchHealed: false,
    witchHealTarget: null,
    witchPoisonTarget: null,
    witchArmPoison: false,
    seerTarget: null,
    spellcasterTarget: null,
    doppelgangerPlayer: null,
    doppelgangerTarget: null,
    vampireTarget: null,
    sorceressTarget: null
  };
  gameState.lastNightDeaths = [];
  gameState.priestShieldTarget = null;
  gameState.priestWakesTonight = true;
  gameState.history = [{ time: 'Start', text: `Auto-dealt game started at Night 0 (Seating Arrangement) with ${gameState.players.length} players.` }];

  const timerEl = document.getElementById('lobby-timer-select');
  const timerDuration = timerEl ? (parseInt(timerEl.value, 10) || 90) : 90;
  gameState.timerRemaining = timerDuration;
  lobbyState.discussionTimer = timerDuration;

  soundManager.playGong();
  saveAppState();
  if (typeof callbacks.switchNavTab === 'function') {
    callbacks.switchNavTab('game');
  } else if (typeof window !== 'undefined' && typeof window.switchNavTab === 'function') {
    window.switchNavTab('game');
  }
}

export function confirmRestartGame(callbacks = {}) {
  cancelAutoAdvance();
  showCustomConfirm('Restart current game? This will revive all players, clear night actions, and reset back to Night 0 Seating (player names & seating are preserved).', {
    icon: '↺',
    title: 'Restart Game?',
    confirmText: '↺ Restart (Night 0)',
    confirmClass: 'btn-warning',
    onConfirm: () => {
      gameState.players.forEach(p => {
        p.status = 'alive';
        p.role = 'Unknown';
        p.isMayor = false;
        p.isLover = false;
        p.checkedBySeer = false;
        p.votes = 0;
        p.notes = '';
      });
      gameState.phase = 'NIGHT';
      gameState.currentNight = 0;
      gameState.currentDay = 1;
      gameState.wizardStepIndex = 0;
      uiState.callerSubMode = 'seatSwap';
      uiState.selectedSwapSeatId = null;
      uiState.witchSelectionMode = null;
      gameState.potions = { witchHealAvailable: true, witchPoisonAvailable: true };
      gameState.nightActions = {
        cupidLover1: null,
        cupidLover2: null,
        bodyguardTarget: null,
        bodyguardLastTarget: null,
        wolfTarget: null,
        witchHealed: false,
        witchHealTarget: null,
        witchPoisonTarget: null,
        witchArmPoison: false,
        seerTarget: null,
        spellcasterTarget: null,
        doppelgangerPlayer: null,
        doppelgangerTarget: null,
        vampireTarget: null,
        sorceressTarget: null
      };
      gameState.lastNightDeaths = [];
      gameState.priestShieldTarget = null;
      gameState.priestWakesTonight = true;
      gameState.vampireMarkedVictim = null;
      pauseTimer();
      soundManager.playGong();
      if (typeof callbacks.addHistoryLog === 'function') {
        callbacks.addHistoryLog('Game Restarted', 'Moderator restarted the game back to Night 0 (Seating).');
      }
      saveAppState();
      renderGameScreen();
      showGameToast('↺ Restarted to Night 0');
    }
  });
}

export function checkWinCondition(callbacks = {}) {
  const alive = gameState.players.filter(p => p.status === 'alive');
  if (alive.length === 0) return;

  const wolves = alive.filter(p => getRoleData(p.role).team === 'Werewolf');
  const vampires = alive.filter(p => getRoleData(p.role).team === 'Vampire');
  // "Others" = Town + Neutral + Sorceress (non-wolf, non-vampire)
  const others = alive.filter(p => getRoleData(p.role).team !== 'Werewolf' && getRoleData(p.role).team !== 'Vampire');

  const showWin = (typeof callbacks.showWinOverlay === 'function')
    ? callbacks.showWinOverlay
    : (typeof globalThis.showWinOverlay === 'function' ? globalThis.showWinOverlay : showWinOverlay);

  // Lovers win check (before team checks)
  const loversAlive = alive.filter(p => p.isLover);
  if (loversAlive.length === 2 && alive.length === 2) {
    showWin('💘 Lovers Win!', `${loversAlive[0].name} and ${loversAlive[1].name} are the only survivors!`, callbacks);
    return;
  }

  // If there are still Unknown roles among alive players, only wait if not all werewolves in deck have been assigned
  const hasUnknowns = alive.some(p => p.role === 'Unknown');
  const deck = lobbyState.roleDeck || {};
  const totalDeckWolves = (deck['Werewolf'] || 0) + (deck['Lycan'] || 0);
  const assignedWolvesCount = gameState.players.filter(p => p.role === 'Werewolf' || p.role === 'Lycan').length;
  const unassignedWolvesRemain = totalDeckWolves > 0 && assignedWolvesCount < totalDeckWolves;

  // Village wins: all wolves AND all vampires eliminated
  if (wolves.length === 0 && vampires.length === 0) {
    if (unassignedWolvesRemain && hasUnknowns) return;
    showWin('🎉 Village Wins!', 'All Werewolves and Vampires have been eliminated! The village is saved!', callbacks);
    return;
  }

  // Werewolf wins: wolves dominate everyone else (others + vampires)
  const nonWolves = alive.length - wolves.length;
  if (wolves.length >= nonWolves && wolves.length > 0) {
    showWin('🐺 Werewolves Win!', `Werewolves (${wolves.length}) equal or outnumber all others (${nonWolves})!`, callbacks);
    return;
  }

  // Vampire wins: no wolves alive, vampires equal or outnumber remaining town
  if (vampires.length > 0 && wolves.length === 0 && vampires.length >= others.length) {
    if (unassignedWolvesRemain && hasUnknowns) return;
    showWin('🧛 Vampires Win!', `Vampires (${vampires.length}) have overwhelmed the village and eliminated all Werewolves!`, callbacks);
    return;
  }
}

export function confirmExitToLobby(callbacks = {}) {
  cancelAutoAdvance();
  showCustomConfirm('Exit game and return to the Lobby? Current game will remain saved.', {
    icon: '🏠',
    title: 'Exit to Lobby?',
    confirmText: '🏠 Exit to Lobby',
    confirmClass: 'btn-danger',
    onConfirm: () => {
      if (typeof callbacks.switchNavTab === 'function') {
        callbacks.switchNavTab('lobby');
      } else if (typeof window !== 'undefined' && typeof window.switchNavTab === 'function') {
        window.switchNavTab('lobby');
      }
    }
  });
}
