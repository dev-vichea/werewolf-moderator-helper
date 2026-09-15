/**
 * Table Center Hub Controller
 * Interactive center disk that displays the current phase, status indicators, and handles tap transitions.
 */
import { gameState, lobbyState, uiState } from '../../state/store.js';
import { soundManager } from '../../audio/sound.js';
import { getRoleTargetCount } from '../../state/roles.js';
import { getActiveNightSteps, renderNightCaller, isStepRoleDead } from './night-caller.js';

export function handleCenterHubTap(callbacks = {}) {
  soundManager.playBeep();
  const getSteps = typeof callbacks.getActiveNightSteps === 'function' ? callbacks.getActiveNightSteps : (typeof globalThis.getActiveNightSteps === 'function' ? globalThis.getActiveNightSteps : getActiveNightSteps);
  const nextStepFn = typeof callbacks.nextWizardStep === 'function' ? callbacks.nextWizardStep : (typeof globalThis.nextWizardStep === 'function' ? globalThis.nextWizardStep : null);
  const resolveDayFn = typeof callbacks.resolveNightAndStartDay === 'function' ? callbacks.resolveNightAndStartDay : (typeof globalThis.resolveNightAndStartDay === 'function' ? globalThis.resolveNightAndStartDay : null);
  const renderTableFn = typeof callbacks.renderTouchTable === 'function' ? callbacks.renderTouchTable : (typeof globalThis.renderTouchTable === 'function' ? globalThis.renderTouchTable : null);

  const phase = (gameState.phase || '').toUpperCase();
  if (phase === 'NIGHT') {
    if (gameState.currentNight === 0) {
      if (typeof callbacks.startNight1FromNight0 === 'function') {
        callbacks.startNight1FromNight0();
      } else if (typeof globalThis.startNight1FromNight0 === 'function') {
        globalThis.startNight1FromNight0();
      } else if (nextStepFn) {
        nextStepFn(callbacks);
      }
      return;
    }

    const steps = getSteps ? getSteps() : [];
    const currentStep = steps[gameState.wizardStepIndex];
    if (currentStep && currentStep.id === 'resolution') {
      if (resolveDayFn) {
        resolveDayFn(callbacks);
      } else if (typeof globalThis.resolveNightAndStartDay === 'function') {
        globalThis.resolveNightAndStartDay(callbacks);
      }
      return;
    }

    // If this step's role is dead, tap immediately advances to the next caller step!
    if (isStepRoleDead(currentStep)) {
      if (nextStepFn) {
        nextStepFn(callbacks);
      } else if (typeof globalThis.nextWizardStep === 'function') {
        globalThis.nextWizardStep(callbacks);
      }
      return;
    }

    // If on a role-assignment step:
    if (currentStep && currentStep.targetRole && uiState.callerSubMode === 'role') {
      const holders = gameState.players.filter(p => p.role === currentStep.targetRole);
      const targetCount = getRoleTargetCount(currentStep.targetRole, lobbyState);
      if (holders.length >= targetCount && targetCount > 0 && currentStep.hasSkill) {
        uiState.callerSubMode = 'target';
        uiState.userExplicitRoleMode = false;
        renderNightCaller();
        if (renderTableFn) renderTableFn();
        return;
      }
    }

    if (nextStepFn) nextStepFn(callbacks);
  } else if (phase === 'DAY') {
    if (gameState.daySubPhase === 'discussion') {
      const setSubPhaseFn = (typeof callbacks.setDaySubPhase === 'function')
        ? callbacks.setDaySubPhase
        : (typeof globalThis.setDaySubPhase === 'function' ? globalThis.setDaySubPhase : null);
      if (setSubPhaseFn) {
        setSubPhaseFn('lynch', callbacks);
      } else {
        gameState.daySubPhase = 'lynch';
        if (renderTableFn) renderTableFn();
      }
      return;
    }

    // If a player was already lynched today, tapping center hub begins Night!
    if (gameState.dayLynchedPlayer) {
      if (typeof callbacks.startNightPhase === 'function') callbacks.startNightPhase(callbacks);
      else if (typeof globalThis.startNightPhase === 'function') globalThis.startNightPhase(callbacks);
      return;
    }

    // Lynch sub-phase
    const alive = gameState.players.filter(p => p.status === 'alive');
    let maxVotes = 0;
    alive.forEach(p => {
      if ((p.votes || 0) > maxVotes) maxVotes = p.votes;
    });
    const leaders = maxVotes > 0 ? alive.filter(p => (p.votes || 0) === maxVotes) : [];

    if (leaders.length === 1 && maxVotes > 0) {
      if (typeof callbacks.executeCurrentLynchLeader === 'function') callbacks.executeCurrentLynchLeader();
      else if (typeof globalThis.executeCurrentLynchLeader === 'function') globalThis.executeCurrentLynchLeader();
    } else if (leaders.length > 1 && maxVotes > 0) {
      soundManager.playBeep();
      const names = leaders.map(l => `#${l.seat} ${l.name}`).join(' & ');
      const alertFn = (typeof callbacks.showCustomAlert === 'function') ? callbacks.showCustomAlert : (typeof globalThis.showCustomAlert === 'function' ? globalThis.showCustomAlert : null);
      if (alertFn) {
        alertFn(`⚖️ Vote Tie! ${names} each have ${maxVotes} votes.\nTown must break the tie or skip lynch.`);
      }
    } else {
      if (typeof callbacks.skipLynchAndStartNight === 'function') callbacks.skipLynchAndStartNight(callbacks);
      else if (typeof globalThis.skipLynchAndStartNight === 'function') globalThis.skipLynchAndStartNight(callbacks);
      else if (typeof callbacks.startNightPhase === 'function') callbacks.startNightPhase();
      else if (typeof globalThis.startNightPhase === 'function') globalThis.startNightPhase();
    }
  }

  if (renderTableFn) renderTableFn();
}
