/**
 * Table Center Hub Controller
 * Interactive center disk that displays the current phase, status indicators, and handles tap transitions.
 */
import { gameState, lobbyState, uiState } from '../../state/store.js';
import { soundManager } from '../../audio/sound.js';
import { getRoleTargetCount } from '../../state/roles.js';
import { getActiveNightSteps, renderNightCaller, isStepRoleDead } from './night-caller.js';
import { assignRandomPlayerForRole } from './autofill.js';

export function handleCenterHubTap(callbacks = {}) {
  soundManager.playBeep();
  const getSteps = typeof callbacks.getActiveNightSteps === 'function' ? callbacks.getActiveNightSteps : (typeof globalThis.getActiveNightSteps === 'function' ? globalThis.getActiveNightSteps : getActiveNightSteps);
  const nextStepFn = typeof callbacks.nextWizardStep === 'function' ? callbacks.nextWizardStep : (typeof globalThis.nextWizardStep === 'function' ? globalThis.nextWizardStep : null);
  const resolveDayFn = typeof callbacks.resolveNightAndStartDay === 'function' ? callbacks.resolveNightAndStartDay : (typeof globalThis.resolveNightAndStartDay === 'function' ? globalThis.resolveNightAndStartDay : null);
  const renderTableFn = typeof callbacks.renderTouchTable === 'function' ? callbacks.renderTouchTable : (typeof globalThis.renderTouchTable === 'function' ? globalThis.renderTouchTable : null);

  const phase = (gameState.phase || '').toUpperCase();
  if (phase === 'NIGHT') {
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
    // Tapping the center hub assigns a random unknown player to this role!
    if (currentStep && currentStep.targetRole && uiState.callerSubMode === 'role') {
      const holders = gameState.players.filter(p => p.role === currentStep.targetRole);
      const targetCount = getRoleTargetCount(currentStep.targetRole, lobbyState);
      if (holders.length < targetCount) {
        assignRandomPlayerForRole(currentStep.targetRole, callbacks);
        return;
      }
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
    const alive = gameState.players.filter(p => p.status === 'alive');
    let maxVotes = 0;
    alive.forEach(p => {
      if ((p.votes || 0) > maxVotes) maxVotes = p.votes;
    });
    const leaders = maxVotes > 0 ? alive.filter(p => (p.votes || 0) === maxVotes) : [];

    if (leaders.length === 1 && maxVotes > 0) {
      if (typeof callbacks.executeCurrentLynchLeader === 'function') callbacks.executeCurrentLynchLeader();
      else if (typeof globalThis.executeCurrentLynchLeader === 'function') globalThis.executeCurrentLynchLeader();
    } else {
      if (typeof callbacks.startNightPhase === 'function') callbacks.startNightPhase();
      else if (typeof globalThis.startNightPhase === 'function') globalThis.startNightPhase();
    }
  }

  if (renderTableFn) renderTableFn();
}
