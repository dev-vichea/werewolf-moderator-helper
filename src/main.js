/**
 * Werewolf Moderator - Main Application Bootstrap & Public API Dispatcher
 */
import { SoundManager, soundManager } from './audio/sound.js';
import { ROLES_CATALOG, getRoleData, getRoleImage, isRoleInGame, getRoleTargetCount } from './state/roles.js';
import { lobbyState, gameState, uiState, resetNightActions } from './state/store.js';
import { loadAppState, saveAppState } from './state/storage.js';
import { parseDialogMeta, showCustomAlert, showCustomConfirm, handleCustomDialogResolve, handleDialogBackdropClick, initDialogKeyboardListeners } from './ui/dialog.js';
import { showGameToast } from './ui/toast.js';
import { showWinOverlay, closeWinOverlay, returnToLobbyFromGameOver, stayAndViewTable } from './ui/modal/win-modal.js';
import { openPlayerActionSheet, closePlayerActionSheet, sheetSaveName, sheetSetRole, sheetAssignRandomRole, sheetSetDoppelgangerTargetPrompt, sheetToggleLife, sheetToggleMayor, sheetToggleLover, sheetSeerReveal, sheetSaveNotes } from './ui/modal/action-sheet.js';
import { triggerHunterRevenge, processNextHunterRevenge, openHunterRevengeModal, executeHunterRevenge, passHunterRevenge, closeHunterRevengeModal, currentRevengeHunter, getCurrentRevengeHunter, setCurrentRevengeHunter } from './ui/modal/hunter-modal.js';
import { getEvenlySpacedEllipseAngles } from './utils/math.js';
import { toggleTimer, startTimer, pauseTimer, resetTimer, updateTimerDisplay, toggleSound, triggerTimerAlarm, silenceTimerAlarm, addTimerSeconds, triggerAttentionBell } from './utils/timer.js';
import { renderLobby, addLobbyPlayer, addLobbyBatchPlayers, removeLobbyPlayer, renderLobbyPlayers, adjustRoleCount, renderRoleDeckGrid, getTotalDeckCount, updateDeckStatus, autoFillVillagers, loadLobbyPreset, clearRoleDeck } from './screens/lobby/lobby-screen.js';
import { renderGameScreen, renderGameTopBar, startGameDirectNight1, startPhysicalCardGame, dealAndStartGame, confirmRestartGame, checkWinCondition, confirmExitToLobby } from './screens/game/game-screen.js';
import { getActiveNightSteps, setCallerSubMode, syncCallerSubMode, renderNightCaller, cancelAutoAdvance, scheduleAutoAdvance, nextWizardStep, prevWizardStep } from './screens/game/night-caller.js';
import { toggleTableExpand, setupTableResizeObserver, renderTouchTable, setupPlayerNodeHold, handleTableNodeTap } from './screens/game/table.js';
import { handleCenterHubTap } from './screens/game/center-hub.js';
import { handleWitchPotionBtnTap, handleWitchDirectPlayerTap, toggleWitchHealTouch, armWitchPoisonTouch, previewNightDeaths } from './screens/game/witch-potions.js';
import { resolveNightAndStartDay, renderDayControls, addPlayerVote, decrementPlayerVote, resetAllVotes, executeCurrentLynchLeader, startNightPhase } from './screens/game/day-phase.js';
import { smartAutoFillRemainingRoles, checkAutoFillLastUnknownRole, manualTriggerAutoFill, checkDoppelgangerTrigger, assignRandomPlayerForRole } from './screens/game/autofill.js';
import { switchLogSubtab, addHistoryLog, renderHistoryTimeline, clearHistoryLog, renderRolesGuide } from './screens/log/log-roles.js';

// --- Navigation Controller ---
function switchNavTab(tab) {
  uiState.activeTab = tab;

  if (typeof document !== 'undefined') {
    document.querySelectorAll('.bottom-nav-tab').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`tab-btn-${tab}`);
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.view-screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(`view-${tab}`);
    if (screen) screen.classList.add('active');
  }

  if (tab === 'game') {
    if (!gameState.inProgress || gameState.players.length === 0) {
      showCustomConfirm('No active game in progress. Do you want to setup players in the Lobby first?', {
        icon: '🏠',
        title: 'No Active Game',
        confirmText: 'Go to Lobby',
        onConfirm: () => switchNavTab('lobby')
      });
      return;
    }
    renderGameScreen();
  } else if (tab === 'lobby') {
    renderLobby();
  } else if (tab === 'log-roles') {
    renderHistoryTimeline();
    renderRolesGuide();
  }
}

// Wrapper delegators for UI event triggers
function wrappedSheetSaveName(newName) { return sheetSaveName(newName, appCallbacks); }
function wrappedSheetSetRole(newRole) { return sheetSetRole(newRole, appCallbacks); }
function wrappedSheetAssignRandomRole() { return sheetAssignRandomRole(appCallbacks); }
function wrappedSheetSetDoppelgangerTargetPrompt() { return sheetSetDoppelgangerTargetPrompt(appCallbacks); }
function wrappedSheetToggleLife() { return sheetToggleLife(appCallbacks); }
function wrappedSheetToggleMayor() { return sheetToggleMayor(appCallbacks); }
function wrappedSheetToggleLover() { return sheetToggleLover(appCallbacks); }
function wrappedExecuteHunterRevenge(targetId) { return executeHunterRevenge(targetId, appCallbacks); }
function wrappedPassHunterRevenge() { return passHunterRevenge(appCallbacks); }
function wrappedReturnToLobbyFromGameOver() { return returnToLobbyFromGameOver(appCallbacks); }
function wrappedHandleCenterHubTap() { return handleCenterHubTap(appCallbacks); }
function wrappedHandleTableNodeTap(id) { return handleTableNodeTap(id, appCallbacks); }
function wrappedAddPlayerVote(id) { return addPlayerVote(id, appCallbacks); }
function wrappedDecrementPlayerVote(id, event) { return decrementPlayerVote(id, event, appCallbacks); }
function wrappedResetAllVotes() { return resetAllVotes(appCallbacks); }
function wrappedExecuteCurrentLynchLeader() { return executeCurrentLynchLeader(appCallbacks); }
function wrappedStartNightPhase() { return startNightPhase(appCallbacks); }
function wrappedResolveNightAndStartDay() { return resolveNightAndStartDay(appCallbacks); }
function wrappedNextWizardStep() { return nextWizardStep(appCallbacks); }
function wrappedPrevWizardStep() { return prevWizardStep(appCallbacks); }
function wrappedScheduleAutoAdvance(delay) { return scheduleAutoAdvance(delay, appCallbacks); }
function wrappedSetCallerSubMode(mode) { return setCallerSubMode(mode, appCallbacks); }
function wrappedHandleWitchPotionBtnTap(type, e) { return handleWitchPotionBtnTap(type, e, appCallbacks); }
function wrappedToggleWitchHealTouch() { return toggleWitchHealTouch(appCallbacks); }
function wrappedArmWitchPoisonTouch() { return armWitchPoisonTouch(appCallbacks); }
function wrappedSmartAutoFillRemainingRoles(explicit) { return smartAutoFillRemainingRoles(explicit, appCallbacks); }
function wrappedCheckAutoFillLastUnknownRole() { return checkAutoFillLastUnknownRole(appCallbacks); }
function wrappedManualTriggerAutoFill() { return manualTriggerAutoFill(appCallbacks); }
function wrappedCheckDoppelgangerTrigger(id) { return checkDoppelgangerTrigger(id, appCallbacks); }
function wrappedAssignRandomPlayerForRole(targetRole) { return assignRandomPlayerForRole(targetRole, appCallbacks); }
function wrappedConfirmRestartGame() { return confirmRestartGame(appCallbacks); }
function wrappedConfirmExitToLobby() { return confirmExitToLobby(appCallbacks); }
function wrappedCheckWinCondition() { return checkWinCondition(appCallbacks); }
function wrappedStartGameDirectNight1() { return startGameDirectNight1(appCallbacks); }
function wrappedStartPhysicalCardGame() { return startPhysicalCardGame(appCallbacks); }
function wrappedDealAndStartGame() { return dealAndStartGame(appCallbacks); }

// --- Wire callback dependencies to modules ---
const appCallbacks = {
  renderGameScreen,
  renderTouchTable,
  renderNightCaller,
  renderLobby,
  switchNavTab,
  addHistoryLog,
  smartAutoFillRemainingRoles: wrappedSmartAutoFillRemainingRoles,
  checkDoppelgangerTrigger: wrappedCheckDoppelgangerTrigger,
  assignRandomPlayerForRole: wrappedAssignRandomPlayerForRole,
  triggerHunterRevenge,
  checkWinCondition: wrappedCheckWinCondition,
  pauseTimer,
  startTimer,
  resetTimer,
  cancelAutoAdvance,
  scheduleAutoAdvance: wrappedScheduleAutoAdvance,
  nextWizardStep: wrappedNextWizardStep,
  prevWizardStep: wrappedPrevWizardStep,
  getActiveNightSteps,
  resolveNightAndStartDay: wrappedResolveNightAndStartDay,
  executeCurrentLynchLeader: wrappedExecuteCurrentLynchLeader,
  startNightPhase: wrappedStartNightPhase
};

const exposedExports = {
  SoundManager,
  soundManager,
  ROLES_CATALOG,
  getRoleData,
  getRoleImage,
  isRoleInGame,
  getRoleTargetCount,
  lobbyState,
  gameState,
  uiState,
  resetNightActions,
  loadAppState,
  saveAppState,
  parseDialogMeta,
  showCustomAlert,
  showCustomConfirm,
  handleCustomDialogResolve,
  handleDialogBackdropClick,
  initDialogKeyboardListeners,
  showGameToast,
  showWinOverlay,
  closeWinOverlay,
  returnToLobbyFromGameOver: wrappedReturnToLobbyFromGameOver,
  stayAndViewTable,
  openPlayerActionSheet,
  closePlayerActionSheet,
  sheetSaveName: wrappedSheetSaveName,
  sheetSetRole: wrappedSheetSetRole,
  sheetAssignRandomRole: wrappedSheetAssignRandomRole,
  sheetSetDoppelgangerTargetPrompt: wrappedSheetSetDoppelgangerTargetPrompt,
  sheetToggleLife: wrappedSheetToggleLife,
  sheetToggleMayor: wrappedSheetToggleMayor,
  sheetToggleLover: wrappedSheetToggleLover,
  sheetSeerReveal,
  sheetSaveNotes,
  triggerHunterRevenge,
  processNextHunterRevenge,
  openHunterRevengeModal,
  executeHunterRevenge: wrappedExecuteHunterRevenge,
  passHunterRevenge: wrappedPassHunterRevenge,
  closeHunterRevengeModal,
  getEvenlySpacedEllipseAngles,
  toggleTimer,
  startTimer,
  pauseTimer,
  resetTimer,
  updateTimerDisplay,
  toggleSound,
  triggerTimerAlarm,
  silenceTimerAlarm,
  addTimerSeconds,
  triggerAttentionBell,
  renderLobby,
  addLobbyPlayer,
  addLobbyBatchPlayers,
  removeLobbyPlayer,
  renderLobbyPlayers,
  adjustRoleCount,
  renderRoleDeckGrid,
  getTotalDeckCount,
  updateDeckStatus,
  autoFillVillagers,
  loadLobbyPreset,
  clearRoleDeck,
  renderGameScreen,
  renderGameTopBar,
  startGameDirectNight1: wrappedStartGameDirectNight1,
  startPhysicalCardGame: wrappedStartPhysicalCardGame,
  dealAndStartGame: wrappedDealAndStartGame,
  confirmRestartGame: wrappedConfirmRestartGame,
  checkWinCondition: wrappedCheckWinCondition,
  confirmExitToLobby: wrappedConfirmExitToLobby,
  getActiveNightSteps,
  setCallerSubMode: wrappedSetCallerSubMode,
  syncCallerSubMode,
  renderNightCaller,
  cancelAutoAdvance,
  scheduleAutoAdvance: wrappedScheduleAutoAdvance,
  nextWizardStep: wrappedNextWizardStep,
  prevWizardStep: wrappedPrevWizardStep,
  toggleTableExpand,
  setupTableResizeObserver,
  renderTouchTable,
  setupPlayerNodeHold,
  handleTableNodeTap: wrappedHandleTableNodeTap,
  handleCenterHubTap: wrappedHandleCenterHubTap,
  handleWitchPotionBtnTap: wrappedHandleWitchPotionBtnTap,
  handleWitchDirectPlayerTap,
  toggleWitchHealTouch: wrappedToggleWitchHealTouch,
  armWitchPoisonTouch: wrappedArmWitchPoisonTouch,
  previewNightDeaths,
  resolveNightAndStartDay: wrappedResolveNightAndStartDay,
  renderDayControls,
  addPlayerVote: wrappedAddPlayerVote,
  decrementPlayerVote: wrappedDecrementPlayerVote,
  resetAllVotes: wrappedResetAllVotes,
  executeCurrentLynchLeader: wrappedExecuteCurrentLynchLeader,
  startNightPhase: wrappedStartNightPhase,
  smartAutoFillRemainingRoles: wrappedSmartAutoFillRemainingRoles,
  checkAutoFillLastUnknownRole: wrappedCheckAutoFillLastUnknownRole,
  manualTriggerAutoFill: wrappedManualTriggerAutoFill,
  checkDoppelgangerTrigger: wrappedCheckDoppelgangerTrigger,
  assignRandomPlayerForRole: wrappedAssignRandomPlayerForRole,
  switchLogSubtab,
  addHistoryLog,
  renderHistoryTimeline,
  clearHistoryLog,
  renderRolesGuide,
  switchNavTab
};

export {
  SoundManager,
  soundManager,
  ROLES_CATALOG,
  getRoleData,
  getRoleImage,
  isRoleInGame,
  getRoleTargetCount,
  lobbyState,
  gameState,
  uiState,
  resetNightActions,
  loadAppState,
  saveAppState,
  parseDialogMeta,
  showCustomAlert,
  showCustomConfirm,
  handleCustomDialogResolve,
  handleDialogBackdropClick,
  initDialogKeyboardListeners,
  showGameToast,
  showWinOverlay,
  closeWinOverlay,
  wrappedReturnToLobbyFromGameOver as returnToLobbyFromGameOver,
  stayAndViewTable,
  openPlayerActionSheet,
  closePlayerActionSheet,
  wrappedSheetSaveName as sheetSaveName,
  wrappedSheetSetRole as sheetSetRole,
  wrappedSheetAssignRandomRole as sheetAssignRandomRole,
  wrappedSheetSetDoppelgangerTargetPrompt as sheetSetDoppelgangerTargetPrompt,
  wrappedSheetToggleLife as sheetToggleLife,
  wrappedSheetToggleMayor as sheetToggleMayor,
  wrappedSheetToggleLover as sheetToggleLover,
  sheetSeerReveal,
  sheetSaveNotes,
  triggerHunterRevenge,
  processNextHunterRevenge,
  openHunterRevengeModal,
  wrappedExecuteHunterRevenge as executeHunterRevenge,
  wrappedPassHunterRevenge as passHunterRevenge,
  closeHunterRevengeModal,
  getEvenlySpacedEllipseAngles,
  toggleTimer,
  startTimer,
  pauseTimer,
  resetTimer,
  updateTimerDisplay,
  toggleSound,
  triggerTimerAlarm,
  silenceTimerAlarm,
  addTimerSeconds,
  triggerAttentionBell,
  renderLobby,
  addLobbyPlayer,
  addLobbyBatchPlayers,
  removeLobbyPlayer,
  renderLobbyPlayers,
  adjustRoleCount,
  renderRoleDeckGrid,
  getTotalDeckCount,
  updateDeckStatus,
  autoFillVillagers,
  loadLobbyPreset,
  clearRoleDeck,
  renderGameScreen,
  renderGameTopBar,
  wrappedStartGameDirectNight1 as startGameDirectNight1,
  wrappedStartPhysicalCardGame as startPhysicalCardGame,
  wrappedDealAndStartGame as dealAndStartGame,
  wrappedConfirmRestartGame as confirmRestartGame,
  wrappedCheckWinCondition as checkWinCondition,
  wrappedConfirmExitToLobby as confirmExitToLobby,
  getActiveNightSteps,
  wrappedSetCallerSubMode as setCallerSubMode,
  syncCallerSubMode,
  renderNightCaller,
  cancelAutoAdvance,
  wrappedScheduleAutoAdvance as scheduleAutoAdvance,
  wrappedNextWizardStep as nextWizardStep,
  wrappedPrevWizardStep as prevWizardStep,
  toggleTableExpand,
  setupTableResizeObserver,
  renderTouchTable,
  setupPlayerNodeHold,
  wrappedHandleTableNodeTap as handleTableNodeTap,
  wrappedHandleCenterHubTap as handleCenterHubTap,
  wrappedHandleWitchPotionBtnTap as handleWitchPotionBtnTap,
  handleWitchDirectPlayerTap,
  wrappedToggleWitchHealTouch as toggleWitchHealTouch,
  wrappedArmWitchPoisonTouch as armWitchPoisonTouch,
  previewNightDeaths,
  wrappedResolveNightAndStartDay as resolveNightAndStartDay,
  renderDayControls,
  wrappedAddPlayerVote as addPlayerVote,
  wrappedDecrementPlayerVote as decrementPlayerVote,
  wrappedResetAllVotes as resetAllVotes,
  wrappedExecuteCurrentLynchLeader as executeCurrentLynchLeader,
  wrappedStartNightPhase as startNightPhase,
  wrappedSmartAutoFillRemainingRoles as smartAutoFillRemainingRoles,
  wrappedCheckAutoFillLastUnknownRole as checkAutoFillLastUnknownRole,
  wrappedManualTriggerAutoFill as manualTriggerAutoFill,
  wrappedCheckDoppelgangerTrigger as checkDoppelgangerTrigger,
  wrappedAssignRandomPlayerForRole as assignRandomPlayerForRole,
  switchLogSubtab,
  addHistoryLog,
  renderHistoryTimeline,
  clearHistoryLog,
  renderRolesGuide,
  switchNavTab,
  exposedExports
};

// --- Mount to global scope (window, globalThis, global) for inline HTML and test harnesses ---
const scopes = new Set();
if (typeof globalThis !== 'undefined') scopes.add(globalThis);
if (typeof window !== 'undefined') scopes.add(window);
if (typeof global !== 'undefined') scopes.add(global);

scopes.forEach(s => {
  for (const [key, val] of Object.entries(exposedExports)) {
    s[key] = val;
  }

  // Two-way sync for mutable state primitives
  Object.defineProperty(s, 'callerSubMode', {
    get() { return uiState.callerSubMode; },
    set(val) { uiState.callerSubMode = val; },
    configurable: true,
    enumerable: true
  });

  Object.defineProperty(s, 'witchSelectionMode', {
    get() { return uiState.witchSelectionMode; },
    set(val) { uiState.witchSelectionMode = val; },
    configurable: true,
    enumerable: true
  });

  Object.defineProperty(s, 'activeTab', {
    get() { return uiState.activeTab; },
    set(val) { uiState.activeTab = val; },
    configurable: true,
    enumerable: true
  });

  Object.defineProperty(s, 'currentRevengeHunter', {
    get() { return getCurrentRevengeHunter(); },
    set(val) { setCurrentRevengeHunter(val); },
    configurable: true,
    enumerable: true
  });

  if (typeof process === 'undefined' || !process.versions || !process.versions.node) {
    s.alert = showCustomAlert;
  } else if (!s.alert) {
    s.alert = showCustomAlert;
  }
});

// Initialize keyboard listeners
initDialogKeyboardListeners();

// --- Init on DOM Ready ---
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    loadAppState(loadLobbyPreset);
    switchNavTab(uiState.activeTab);

    window.addEventListener('resize', () => {
      if (uiState.activeTab === 'game') renderTouchTable();
    });
  });
}

