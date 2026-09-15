/**
 * Central Reactive Store & State Definitions
 */

export const lobbyState = {
  players: [], // Player names in lobby
  roleDeck: {},
  discussionTimer: 90
};

export const gameState = {
  inProgress: false,
  isPhysicalCardMode: true,
  players: [],
  phase: 'NIGHT', // 'NIGHT' or 'DAY'
  currentNight: 1,
  currentDay: 1,
  wizardStepIndex: 0,
  potions: { witchHealAvailable: true, witchPoisonAvailable: true },
  nightActions: {
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
    doppelgangerTarget: null
  },
  lastNightDeaths: [],
  priestShieldTarget: null,
  priestWakesTonight: true,
  history: [],
  daySubPhase: 'discussion', // 'discussion' | 'lynch'
  dayLynchedPlayer: null, // Name/seat of player lynched during current day
  timerRemaining: 90,
  timerRunning: false
};

// Caller and UI Selection State
export const uiState = {
  callerSubMode: 'role', // 'role' | 'target' | 'seatSwap'
  selectedSwapSeatId: null, // Player ID currently selected for seat swapping
  userExplicitRoleMode: false,
  witchSelectionMode: null, // 'heal' | 'poison' | null
  activeTab: 'lobby', // 'lobby' | 'game' | 'log-roles'
  sheetTargetPlayerId: null,
  timerInterval: null,
  activeDialogResolver: null
};

export function resetNightActions() {
  gameState.nightActions = {
    cupidLover1: null,
    cupidLover2: null,
    bodyguardTarget: null,
    bodyguardLastTarget: gameState.nightActions ? gameState.nightActions.bodyguardTarget : null,
    wolfTarget: null,
    witchHealed: false,
    witchHealTarget: null,
    witchPoisonTarget: null,
    witchArmPoison: false,
    seerTarget: null,
    spellcasterTarget: null,
    doppelgangerPlayer: null,
    doppelgangerTarget: null
  };
}
