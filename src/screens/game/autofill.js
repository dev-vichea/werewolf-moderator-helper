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
      unknownPlayers.forEach((p, idx) => {
        const autoRole = missingRoles[idx] || 'Villager';
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

export function manualTriggerAutoFill(callbacks = {}) {
  const unknowns = gameState.players.filter(p => p.role === 'Unknown');
  if (unknowns.length === 0) {
    showGameToast('All players already have assigned roles! 👍');
    return;
  }
  const updates = smartAutoFillRemainingRoles(true, callbacks);
  if (updates.length === 0) {
    showGameToast('No remaining roles could be auto-filled.');
  } else {
    // Re-render caller and table to ensure the night action (e.g. Werewolves Kill) is actively prompted
    if (typeof callbacks.renderGameScreen === 'function') {
      callbacks.renderGameScreen();
    }
  }
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
