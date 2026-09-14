/**
 * Smart Role Deduction & Auto-Fill Algorithms
 */
import { gameState, lobbyState, uiState } from '../../state/store.js';
import { getRoleTargetCount } from '../../state/roles.js';
import { getActiveNightSteps } from './night-caller.js';
import { soundManager } from '../../audio/sound.js';
import { saveAppState } from '../../state/storage.js';
import { showGameToast } from '../../ui/toast.js';
import { showCustomAlert } from '../../ui/dialog.js';

export function smartAutoFillRemainingRoles(isExplicitManualOrSunrise = false, callbacks = {}) {
  if (!gameState.inProgress) return [];
  const unknownPlayers = gameState.players.filter(p => p.role === 'Unknown');
  if (unknownPlayers.length === 0) return [];

  const deck = lobbyState.roleDeck || {};

  // Count assigned roles in current player roster
  const assignedCounts = {};
  gameState.players.forEach(p => {
    if (p.role && p.role !== 'Unknown') {
      assignedCounts[p.role] = (assignedCounts[p.role] || 0) + 1;
    }
  });

  // Calculate missing roles according to configured roleDeck
  const missingRoles = [];
  for (const [roleName, targetCount] of Object.entries(deck)) {
    const assigned = assignedCounts[roleName] || 0;
    const needed = Math.max(0, targetCount - assigned);
    for (let i = 0; i < needed; i++) {
      missingRoles.push(roleName);
    }
  }

  const assignedUpdates = [];

  // CASE 1: Exactly 1 unknown player remains -> assign the last missing role or Villager
  if (unknownPlayers.length === 1) {
    const p = unknownPlayers[0];
    const autoRole = missingRoles.length > 0 ? missingRoles[0] : 'Villager';
    p.role = autoRole;
    assignedUpdates.push({ player: p, role: autoRole });
  }
  // CASE 2: All special roles from deck are fulfilled -> ONLY Villagers remain!
  else {
    const nonVillagersMissing = missingRoles.filter(r => r !== 'Villager');
    if (nonVillagersMissing.length === 0) {
      // All remaining unknowns MUST be Villagers!
      unknownPlayers.forEach(p => {
        p.role = 'Villager';
        assignedUpdates.push({ player: p, role: 'Villager' });
      });
    }
    // CASE 3: Exact match on missing roles count and they are all identical
    else if (unknownPlayers.length === missingRoles.length && missingRoles.every(r => r === missingRoles[0])) {
      const fillRole = missingRoles[0];
      unknownPlayers.forEach(p => {
        p.role = fillRole;
        assignedUpdates.push({ player: p, role: fillRole });
      });
    }
    // CASE 4: Explicit manual click OR Sunrise resolution
    else if (isExplicitManualOrSunrise) {
      const shuffledMissing = [...missingRoles];
      for (let i = shuffledMissing.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledMissing[i], shuffledMissing[j]] = [shuffledMissing[j], shuffledMissing[i]];
      }
      unknownPlayers.forEach((p, idx) => {
        const autoRole = shuffledMissing[idx] || 'Villager';
        p.role = autoRole;
        assignedUpdates.push({ player: p, role: autoRole });
      });
    }
  }

  if (assignedUpdates.length > 0) {
    soundManager.playChime();
    const updateDescriptions = assignedUpdates.map(u => `#${u.player.seat} ${u.player.name} (${u.role})`).join(', ');
    if (typeof callbacks.addHistoryLog === 'function') {
      callbacks.addHistoryLog('Smart Auto-Fill', `Auto-assigned: ${updateDescriptions}`);
    }

    // When roles are filled, if current night step has a skill and its roles are satisfied, transition to skill action (e.g. Wolf Kill)
    if (gameState.phase === 'NIGHT') {
      const steps = getActiveNightSteps();
      const currentStep = steps ? steps[gameState.wizardStepIndex] : null;
      if (currentStep && currentStep.hasSkill && currentStep.targetRole) {
        const holders = gameState.players.filter(p => p.role === currentStep.targetRole);
        const targetCount = getRoleTargetCount(currentStep.targetRole, lobbyState);
        if (holders.length >= targetCount && targetCount > 0) {
          uiState.callerSubMode = 'target';
          uiState.userExplicitRoleMode = false;
        }
      }
    }

    showGameToast(`⚡ Auto-Filled ${assignedUpdates.length} role(s): ${updateDescriptions}`);
    saveAppState();
    if (typeof callbacks.renderGameScreen === 'function') {
      callbacks.renderGameScreen();
    }
    return assignedUpdates;
  }

  return [];
}

export function checkAutoFillLastUnknownRole(callbacks = {}) {
  return smartAutoFillRemainingRoles(false, callbacks);
}

/**
 * One-click random role assignment for all players (or remaining unknown players).
 * Shuffles roles from the lobby deck (or balanced default setup) using Fisher-Yates.
 */
export function randomizeAllRoles(forceAll = false, callbacks = {}) {
  if (!gameState.inProgress || !gameState.players || gameState.players.length === 0) return [];

  const total = gameState.players.length;
  const unknowns = gameState.players.filter(p => p.role === 'Unknown');

  // If forceAll is true, or if all players are unknown, or if none are unknown (re-randomize), target everyone
  const shouldTargetAll = forceAll || unknowns.length === total || unknowns.length === 0;
  const targetPlayers = shouldTargetAll ? gameState.players : unknowns;

  // 1. Build pool of roles
  let pool = [];
  const deck = lobbyState.roleDeck || {};
  const hasDeck = Object.keys(deck).length > 0 && Object.values(deck).some(v => v > 0);

  if (hasDeck) {
    if (shouldTargetAll) {
      for (const [role, count] of Object.entries(deck)) {
        for (let i = 0; i < count; i++) pool.push(role);
      }
    } else {
      // Determine remaining roles from deck that haven't been assigned yet
      const assignedCounts = {};
      gameState.players.forEach(p => {
        if (p.role && p.role !== 'Unknown' && !targetPlayers.includes(p)) {
          assignedCounts[p.role] = (assignedCounts[p.role] || 0) + 1;
        }
      });
      for (const [role, count] of Object.entries(deck)) {
        const assigned = assignedCounts[role] || 0;
        const needed = Math.max(0, count - assigned);
        for (let i = 0; i < needed; i++) pool.push(role);
      }
    }
  }

  // If pool is insufficient for target players, fill with balanced roles or Villagers
  if (pool.length < targetPlayers.length) {
    if (pool.length === 0) {
      const wolfCount = targetPlayers.length >= 10 ? 3 : (targetPlayers.length >= 6 ? 2 : 1);
      for (let i = 0; i < wolfCount; i++) pool.push('Werewolf');
      pool.push('Seer');
      if (targetPlayers.length >= 6) pool.push('Witch');
      if (targetPlayers.length >= 8) pool.push('Bodyguard');
      if (targetPlayers.length >= 10) pool.push('Hunter');
    }
    while (pool.length < targetPlayers.length) {
      pool.push('Villager');
    }
  }

  // Truncate if pool has more items than targetPlayers
  if (pool.length > targetPlayers.length) {
    pool = pool.slice(0, targetPlayers.length);
  }

  // 2. Fisher-Yates shuffle the pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // 3. Assign roles
  targetPlayers.forEach((p, idx) => {
    p.role = pool[idx] || 'Villager';
  });

  soundManager.playFanfare();
  showGameToast(`🎲 Random roles assigned to all ${targetPlayers.length} players!`, 2000);

  if (typeof callbacks.addHistoryLog === 'function') {
    callbacks.addHistoryLog('Random Roles', `One-click randomized roles for ${targetPlayers.length} players.`);
  }

  // If currently in Night phase and on a skill step whose holders are now filled, transition subMode if appropriate
  if (gameState.phase === 'NIGHT' && gameState.currentNight >= 1) {
    const steps = getActiveNightSteps();
    const currentStep = steps ? steps[gameState.wizardStepIndex] : null;
    if (currentStep && currentStep.hasSkill && currentStep.targetRole) {
      const holders = gameState.players.filter(p => p.role === currentStep.targetRole);
      const targetCount = getRoleTargetCount(currentStep.targetRole, lobbyState);
      if (holders.length >= targetCount && targetCount > 0) {
        uiState.callerSubMode = 'target';
        uiState.userExplicitRoleMode = false;
      }
    }
  }

  saveAppState();

  if (typeof callbacks.renderGameScreen === 'function') callbacks.renderGameScreen();
  else if (typeof globalThis.renderGameScreen === 'function') globalThis.renderGameScreen();
  if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller();
  else if (typeof globalThis.renderNightCaller === 'function') globalThis.renderNightCaller();
  if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
  else if (typeof globalThis.renderTouchTable === 'function') globalThis.renderTouchTable();

  return targetPlayers;
}

export function manualTriggerAutoFill(callbacks = {}) {
  return randomizeAllRoles(false, callbacks);
}

export function checkDoppelgangerTrigger(killedPlayerId, callbacks = {}) {
  if (gameState.nightActions.doppelgangerTarget && gameState.nightActions.doppelgangerTarget === killedPlayerId) {
    const mirroredPlayer = gameState.players.find(p => p.id === killedPlayerId);
    let doppelganger = null;
    if (gameState.nightActions.doppelgangerPlayer) {
      doppelganger = gameState.players.find(p => p.id === gameState.nightActions.doppelgangerPlayer);
    }
    if (!doppelganger) {
      doppelganger = gameState.players.find(p => p.role === 'Doppelganger' && p.status === 'alive') ||
                     gameState.players.find(p => p.role === 'Doppelganger');
    }

    if (mirroredPlayer && doppelganger && doppelganger.status === 'alive') {
      const inheritedRole = (mirroredPlayer.role && mirroredPlayer.role !== 'Unknown') ? mirroredPlayer.role : 'Villager';
      doppelganger.role = inheritedRole;
      doppelganger.assumedRoleFrom = mirroredPlayer.id;

      // Consume the link so it doesn't trigger again
      gameState.nightActions.doppelgangerTarget = null;
      if (doppelganger.doppelTarget) doppelganger.doppelTarget = null;

      soundManager.playFanfare();
      showCustomAlert(
        `🎭 DOPPELGÄNGER AWAKENS!\n\n` +
        `#${mirroredPlayer.seat} ${mirroredPlayer.name} has died!\n\n` +
        `The Doppelgänger (#${doppelganger.seat} ${doppelganger.name}) secretly assumes their role and abilities, and is now a ${inheritedRole}!`,
        {
          title: '🎭 Doppelgänger Awakens!',
          icon: '🎭',
          confirmText: '🎴 Show Card to Doppelgänger',
          confirmClass: 'btn-primary',
          cardBorder: '#ec4899',
          cardGlow: 'rgba(236, 72, 153, 0.45)',
          onOk: () => {
            if (typeof callbacks.openFullCardView === 'function') {
              callbacks.openFullCardView(doppelganger.id);
            } else if (typeof window !== 'undefined' && typeof window.openFullCardView === 'function') {
              window.openFullCardView(doppelganger.id);
            }
          }
        }
      );

      if (typeof callbacks.addHistoryLog === 'function') {
        callbacks.addHistoryLog('Doppelgänger Inherit', `Doppelgänger #${doppelganger.seat} ${doppelganger.name} assumed role (${inheritedRole}) from deceased #${mirroredPlayer.seat} ${mirroredPlayer.name}.`);
      }

      saveAppState();
      if (typeof callbacks.renderTouchTable === 'function') {
        callbacks.renderTouchTable();
      } else if (typeof callbacks.renderTable === 'function') {
        callbacks.renderTable();
      }
      if (typeof callbacks.renderNightCaller === 'function') {
        callbacks.renderNightCaller();
      }
      if (typeof callbacks.renderGameScreen === 'function') {
        callbacks.renderGameScreen();
      }
      if (typeof callbacks.smartAutoFillRemainingRoles === 'function') {
        callbacks.smartAutoFillRemainingRoles();
      }
    }
  }
}

export function assignRandomPlayerForRole(targetRole, callbacks = {}) {
  if (!gameState.inProgress) return null;

  // Find living unassigned players
  let eligible = gameState.players.filter(p => p.status === 'alive' && p.role === 'Unknown');
  if (eligible.length === 0) {
    eligible = gameState.players.filter(p => p.status === 'alive' && p.role !== targetRole);
  }

  if (eligible.length === 0) {
    showGameToast(`No available players to assign as ${targetRole}.`);
    return null;
  }

  const chosen = eligible[Math.floor(Math.random() * eligible.length)];
  chosen.role = targetRole;

  soundManager.playChime();
  showGameToast(`🎲 Random: #${chosen.seat} ${chosen.name} assigned as ${targetRole}!`);
  if (typeof callbacks.addHistoryLog === 'function') {
    callbacks.addHistoryLog('Random Role', `Assigned #${chosen.seat} ${chosen.name} as ${targetRole}`);
  }

  // Check if role requirements are now satisfied
  const holders = gameState.players.filter(p => p.role === targetRole);
  const targetCount = getRoleTargetCount(targetRole, lobbyState);

  if (holders.length >= targetCount && targetCount > 0) {
    const steps = getActiveNightSteps();
    const currentStep = steps ? steps[gameState.wizardStepIndex] : null;
    if (currentStep && currentStep.hasSkill) {
      uiState.callerSubMode = 'target';
      uiState.userExplicitRoleMode = false;
    }
  }

  saveAppState();

  if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller();
  else if (typeof globalThis.renderNightCaller === 'function') globalThis.renderNightCaller();

  if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
  else if (typeof globalThis.renderTouchTable === 'function') globalThis.renderTouchTable();

  return chosen;
}
