/**
 * Day Phase Logic: Discussion, Voting, Lynch Execution, and Sunrise/Nightfall Transitions
 */
import { gameState, lobbyState, uiState } from '../../state/store.js';
import { soundManager } from '../../audio/sound.js';
import { saveAppState } from '../../state/storage.js';
import { showCustomAlert, showCustomConfirm } from '../../ui/dialog.js';
import { showGameToast } from '../../ui/toast.js';
import { startTimer, pauseTimer } from '../../utils/timer.js';
import { previewNightDeaths, getInfectedCursedPlayer } from './witch-potions.js';
import { smartAutoFillRemainingRoles, checkDoppelgangerTrigger } from './autofill.js';
import { triggerHunterRevenge } from '../../ui/modal/hunter-modal.js';
import { showWinOverlay } from '../../ui/modal/win-modal.js';

export function resolveNightAndStartDay(callbacks = {}) {
  if (typeof callbacks.cancelAutoAdvance === 'function') callbacks.cancelAutoAdvance();
  const deaths = previewNightDeaths();
  const infectedCursed = getInfectedCursedPlayer();

  deaths.forEach(d => {
    const p = gameState.players.find(x => x.id === d.id);
    if (p) p.status = 'dead';
    checkDoppelgangerTrigger(d.id, callbacks);
  });

  // Handle Cursed Infection at Sunrise:
  if (infectedCursed && !deaths.some(d => d.id === infectedCursed.id)) {
    infectedCursed.role = 'Werewolf';
    if (typeof callbacks.addHistoryLog === 'function') {
      callbacks.addHistoryLog('Cursed Infected', `#${infectedCursed.seat} ${infectedCursed.name} was attacked by Werewolves and has turned into a Werewolf!`);
    }
    if (typeof soundManager.playWolfHowl === 'function') {
      soundManager.playWolfHowl();
    }
    showCustomAlert(
      `<strong>#${infectedCursed.seat} ${infectedCursed.name}</strong> was attacked by the Werewolves tonight.<br><br>Instead of dying, their curse activated and they turned into an active <strong>Werewolf</strong>!<br><br><span style="color: #94a3b8; font-size: 0.88em;"><em>(Secretly notify them, or have them open eyes with Werewolves tonight!)</em></span>`,
      {
        title: 'Cursed Infected!',
        icon: '🐺',
        confirmText: 'Understood',
        confirmClass: 'btn-danger'
      }
    );
  }

  if (gameState.nightActions.witchHealed) gameState.potions.witchHealAvailable = false;
  if (gameState.nightActions.witchPoisonTarget) gameState.potions.witchPoisonAvailable = false;
  gameState.nightActions.bodyguardLastTarget = gameState.nightActions.bodyguardTarget;
  if (gameState.nightActions.bodyguardLastTarget) {
    const guarded = gameState.players.find(p => p.id === gameState.nightActions.bodyguardLastTarget);
    if (guarded) guarded.isShielded = true;
  }

  gameState.lastNightDeaths = deaths;
  const summary = deaths.length > 0 ? deaths.map(d => `${d.name} (${d.reason})`).join(', ') : 'Nobody died';
  if (typeof callbacks.addHistoryLog === 'function') {
    callbacks.addHistoryLog(`Night ${gameState.currentNight}`, `Morning arrived. Deaths: ${summary}`);
  }

  // Transition to DAY
  gameState.phase = 'DAY';
  gameState.wizardStepIndex = 0;
  gameState.players.forEach(p => p.votes = 0);
  gameState.nightActions.wolfTarget = null;
  gameState.nightActions.witchHealed = false;
  gameState.nightActions.witchHealTarget = null;
  gameState.nightActions.witchPoisonTarget = null;
  gameState.nightActions.witchArmPoison = false;
  gameState.nightActions.bodyguardTarget = null;
  uiState.witchSelectionMode = null;

  // SUNRISE SMART AUTO-FILL
  smartAutoFillRemainingRoles(true, callbacks);

  // SUNRISE AUTO START TIME DISCUSSION!
  gameState.timerRemaining = lobbyState.discussionTimer || 90;
  startTimer();

  soundManager.playSunriseBell();
  saveAppState();

  // Instant direct DOM transition guarantee:
  const callerBox = document.getElementById('night-caller-box');
  if (callerBox) callerBox.style.display = 'none';
  const dayControlsBar = document.getElementById('day-controls-bar');
  if (dayControlsBar) dayControlsBar.style.display = 'flex';
  const phasePill = document.getElementById('game-phase-pill');
  if (phasePill) {
    phasePill.className = 'game-phase-pill day';
    phasePill.textContent = `☀️ Day ${gameState.currentDay}`;
  }
  renderDayControls();

  const renderScreenFn = (typeof callbacks.renderGameScreen === 'function')
    ? callbacks.renderGameScreen
    : (typeof globalThis.renderGameScreen === 'function' ? globalThis.renderGameScreen : null);

  const checkWinFn = (typeof callbacks.checkWinCondition === 'function')
    ? callbacks.checkWinCondition
    : (typeof globalThis.checkWinCondition === 'function' ? globalThis.checkWinCondition : null);

  if (renderScreenFn) {
    renderScreenFn();
  } else {
    const renderTableFn = (typeof callbacks.renderTouchTable === 'function')
      ? callbacks.renderTouchTable
      : (typeof globalThis.renderTouchTable === 'function' ? globalThis.renderTouchTable : null);
    if (renderTableFn) renderTableFn();
  }

  // Ensure caller box is definitively hidden and day controls shown
  if (callerBox) callerBox.style.display = 'none';
  if (dayControlsBar) dayControlsBar.style.display = 'flex';

  if (checkWinFn) checkWinFn(callbacks);

  const deadHunters = deaths
    .map(d => gameState.players.find(x => x.id === d.id))
    .filter(p => p && p.role === 'Hunter');
  if (deadHunters.length > 0) {
    setTimeout(() => {
      deadHunters.forEach(h => triggerHunterRevenge(h));
    }, 450);
  }
}

export function renderDayControls() {
  const recapEl = document.getElementById('day-morning-recap');
  if (recapEl) {
    if (gameState.lastNightDeaths && gameState.lastNightDeaths.length > 0) {
      recapEl.innerHTML = `Deaths: <strong>${gameState.lastNightDeaths.map(d=>d.name).join(', ')}</strong>`;
    } else {
      recapEl.innerHTML = `Morning report: <strong>Nobody died!</strong>`;
    }
  }

  // Silenced banner check
  const silencedBanner = document.getElementById('day-silenced-banner');
  const silencedText = document.getElementById('day-silenced-text');
  if (silencedBanner && silencedText) {
    if (gameState.nightActions.spellcasterTarget) {
      const silencedPlayer = gameState.players.find(p => p.id === gameState.nightActions.spellcasterTarget);
      if (silencedPlayer && silencedPlayer.status === 'alive') {
        silencedBanner.style.display = 'flex';
        silencedText.textContent = `${silencedPlayer.name} (#${silencedPlayer.seat}) was silenced by the Spellcaster and CANNOT speak today!`;
      } else {
        silencedBanner.style.display = 'none';
      }
    } else {
      silencedBanner.style.display = 'none';
    }
  }

  // Highest votes leader / tie detection
  const alive = gameState.players.filter(p => p.status === 'alive');
  const mayorAlive = alive.some(p => p.isMayor);
  const maxAllowedVotes = alive.length + (mayorAlive ? 1 : 0);

  // Clamp any legacy or excess votes
  alive.forEach(p => {
    if ((p.votes || 0) > maxAllowedVotes) {
      p.votes = maxAllowedVotes;
    }
  });

  const currentTotalVotes = alive.reduce((sum, p) => sum + (p.votes || 0), 0);

  // Update vote helper text with active count
  const voteHint = document.getElementById('day-vote-hint');
  if (voteHint) {
    if (currentTotalVotes > 0) {
      voteHint.innerHTML = `👉 Tap player for +1 vote. Tap badge for −1 vote. <span style="color: #60a5fa; font-weight: 600;">(Votes: ${currentTotalVotes}/${maxAllowedVotes})</span>`;
    } else {
      voteHint.innerHTML = `👉 Tap player for +1 vote. Tap badge for −1 vote. <span style="color: var(--text-muted);">(Votes: 0/${maxAllowedVotes})</span>`;
    }
  }

  let maxVotes = 0;
  alive.forEach(p => {
    if ((p.votes || 0) > maxVotes) {
      maxVotes = p.votes;
    }
  });

  const leaders = maxVotes > 0 ? alive.filter(p => (p.votes || 0) === maxVotes) : [];
  const lynchBtn = document.getElementById('day-lynch-btn');

  if (lynchBtn) {
    if (leaders.length === 1) {
      const leader = leaders[0];
      lynchBtn.disabled = false;
      lynchBtn.textContent = `💀 Lynch #${leader.seat} ${leader.name} (${maxVotes}v)`;
    } else if (leaders.length > 1) {
      lynchBtn.disabled = true;
      const names = leaders.map(l => `#${l.seat} ${l.name}`).join(' & ');
      lynchBtn.textContent = `⚖️ Tie: ${names} (${maxVotes}v)`;
    } else {
      lynchBtn.disabled = true;
      lynchBtn.textContent = `💀 Lynch`;
    }
  }

  // Update Day Auto-Fill Button visibility
  const unknownCount = gameState.players.filter(p => p.role === 'Unknown').length;
  const dayAutofillBtn = document.getElementById('day-autofill-btn');
  if (dayAutofillBtn) {
    dayAutofillBtn.style.display = unknownCount > 0 ? 'inline-flex' : 'none';
    dayAutofillBtn.textContent = `⚡ Auto-Fill (${unknownCount})`;
  }
}

export function addPlayerVote(playerId, callbacks = {}) {
  const alive = gameState.players.filter(p => p.status === 'alive');
  const player = alive.find(p => p.id === playerId);
  if (!player) return;

  const mayorAlive = alive.some(p => p.isMayor);
  const maxAllowedVotes = alive.length + (mayorAlive ? 1 : 0);
  const currentTotalVotes = alive.reduce((sum, p) => sum + (p.votes || 0), 0);

  // LIMIT: Total votes cannot exceed alive players count, nor can single player votes exceed limit.
  if (currentTotalVotes >= maxAllowedVotes || (player.votes || 0) >= maxAllowedVotes) {
    return;
  }

  player.votes = (player.votes || 0) + 1;
  soundManager.playBeep();
  saveAppState();

  // Instant surgical DOM update on the specific player card for 0ms latency
  const node = document.querySelector(`.table-touch-node[data-player-id="${playerId}"]`);
  if (node) {
    const avatarWrapper = node.querySelector('.node-avatar-wrapper');
    if (avatarWrapper) {
      let voteBadge = avatarWrapper.querySelector('.node-vote-badge');
      if (!voteBadge) {
        voteBadge = document.createElement('span');
        voteBadge.className = 'node-vote-badge';
        voteBadge.setAttribute('onclick', `decrementPlayerVote('${player.id}', event)`);
        voteBadge.title = 'Tap to -1 vote';
        avatarWrapper.appendChild(voteBadge);
      }
      voteBadge.innerHTML = `${player.votes}v<span class="vote-minus-symbol">-</span>`;
      voteBadge.style.animation = 'none';
      voteBadge.offsetHeight; // trigger reflow
      voteBadge.style.animation = 'votePop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }
  }

  // Refresh table and day control buttons instantly
  const renderTableFn = (typeof callbacks.renderTouchTable === 'function')
    ? callbacks.renderTouchTable
    : (typeof globalThis.renderTouchTable === 'function' ? globalThis.renderTouchTable : null);
  if (renderTableFn) renderTableFn();

  renderDayControls();
}

export function decrementPlayerVote(playerId, event, callbacks = {}) {
  if (event && event.stopPropagation) event.stopPropagation();
  const player = gameState.players.find(p => p.id === playerId);
  if (!player || !player.votes || player.votes <= 0) return;
  player.votes = Math.max(0, player.votes - 1);
  soundManager.playBeep();
  saveAppState();

  // Instant DOM update on the vote badge
  const node = document.querySelector(`.table-touch-node[data-player-id="${playerId}"]`);
  if (node) {
    const voteBadge = node.querySelector('.node-vote-badge');
    if (voteBadge) {
      if (player.votes === 0) {
        voteBadge.remove();
      } else {
        voteBadge.innerHTML = `${player.votes}v<span class="vote-minus-symbol">-</span>`;
      }
    }
  }

  const renderTableFn = (typeof callbacks.renderTouchTable === 'function')
    ? callbacks.renderTouchTable
    : (typeof globalThis.renderTouchTable === 'function' ? globalThis.renderTouchTable : null);
  if (renderTableFn) renderTableFn();

  renderDayControls();
}

export function resetAllVotes(callbacks = {}) {
  const hasVotes = gameState.players.some(p => (p.votes || 0) > 0);
  if (!hasVotes) return;
  gameState.players.forEach(p => p.votes = 0);
  soundManager.playBeep();
  saveAppState();

  // Instant clear of all vote badges in DOM
  document.querySelectorAll('.node-vote-badge').forEach(b => b.remove());

  const renderTableFn = (typeof callbacks.renderTouchTable === 'function')
    ? callbacks.renderTouchTable
    : (typeof globalThis.renderTouchTable === 'function' ? globalThis.renderTouchTable : null);
  if (renderTableFn) renderTableFn();

  renderDayControls();
}

export function executeCurrentLynchLeader(callbacks = {}) {
  const alive = gameState.players.filter(p => p.status === 'alive');
  let maxVotes = 0;
  alive.forEach(p => {
    if ((p.votes || 0) > maxVotes) {
      maxVotes = p.votes;
    }
  });

  const leaders = maxVotes > 0 ? alive.filter(p => (p.votes || 0) === maxVotes) : [];
  if (leaders.length === 0) return;
  if (leaders.length > 1) {
    soundManager.playBeep();
    showCustomAlert(`⚖️ Vote Tie! ${leaders.map(l => `#${l.seat} ${l.name}`).join(' and ')} each have ${maxVotes} votes.\nTown must break the tie before executing!`);
    return;
  }
  const leader = leaders[0];

  const refreshAfterLynch = () => {
    gameState.players.forEach(p => p.votes = 0);
    saveAppState();
    const renderScreenFn = (typeof callbacks.renderGameScreen === 'function')
      ? callbacks.renderGameScreen
      : (typeof globalThis.renderGameScreen === 'function' ? globalThis.renderGameScreen : null);
    if (renderScreenFn) {
      renderScreenFn();
    } else {
      const renderTableFn = (typeof callbacks.renderTouchTable === 'function')
        ? callbacks.renderTouchTable
        : (typeof globalThis.renderTouchTable === 'function' ? globalThis.renderTouchTable : null);
      if (renderTableFn) renderTableFn();
    }
    renderDayControls();
    const checkWinFn = (typeof callbacks.checkWinCondition === 'function')
      ? callbacks.checkWinCondition
      : (typeof globalThis.checkWinCondition === 'function' ? globalThis.checkWinCondition : null);
    if (checkWinFn) checkWinFn();
  };

  if (leader.role === 'Prince') {
    showCustomAlert(`👑 ${leader.name} reveals they are the PRINCE! The town cannot execute royalty!`);
    leader.role = 'Villager';
    if (typeof callbacks.addHistoryLog === 'function') {
      callbacks.addHistoryLog('Prince Saved', `${leader.name} revealed royalty.`);
    }
    refreshAfterLynch();
    return;
  }

  showCustomConfirm(`Execute #${leader.seat} ${leader.name} (${leader.role}) with ${maxVotes} votes?`, {
    icon: '💀',
    title: 'Execute Lynch Target',
    confirmText: '💀 Execute',
    confirmClass: 'btn-danger',
    onConfirm: () => {
      leader.status = 'dead';
      soundManager.playGong();
      if (typeof callbacks.addHistoryLog === 'function') {
        callbacks.addHistoryLog(`Day ${gameState.currentDay} Lynch`, `${leader.name} was executed.`);
      }
      checkDoppelgangerTrigger(leader.id, callbacks);

      if (leader.role === 'Tanner') {
        showWinOverlay('🤡 Tanner Wins!', `${leader.name} was the Tanner and successfully got executed!`, callbacks);
        saveAppState();
        refreshAfterLynch();
        return;
      }

      if (leader.role === 'Hunter') {
        triggerHunterRevenge(leader);
      }

      if (leader.isLover) {
        const partner = gameState.players.find(x => x.isLover && x.id !== leader.id && x.status === 'alive');
        if (partner) {
          showCustomConfirm(`💘 ${leader.name} was in love with ${partner.name}! Does ${partner.name} die of heartbreak?`, {
            icon: '💔',
            title: 'Heartbreak Tragedy',
            confirmText: '💀 Dies of Heartbreak',
            confirmClass: 'btn-danger',
            onConfirm: () => {
              partner.status = 'dead';
              if (typeof callbacks.addHistoryLog === 'function') {
                callbacks.addHistoryLog('Heartbreak', `${partner.name} died of grief.`);
              }
              checkDoppelgangerTrigger(partner.id, callbacks);
              if (partner.role === 'Hunter') {
                triggerHunterRevenge(partner);
              }
              refreshAfterLynch();
            },
            onCancel: () => {
              refreshAfterLynch();
            }
          });
          return;
        }
      }

      refreshAfterLynch();
    }
  });
}

export function startNightPhase(callbacks = {}) {
  if (typeof callbacks.cancelAutoAdvance === 'function') callbacks.cancelAutoAdvance();
  showCustomConfirm(`Send village to sleep and begin Night ${gameState.currentNight + 1}?`, {
    icon: '🌙',
    title: 'Begin Nightfall',
    confirmText: '🌙 Begin Night',
    confirmClass: 'btn-primary',
    onConfirm: () => {
      gameState.phase = 'NIGHT';
      gameState.currentNight++;
      gameState.currentDay++;
      gameState.wizardStepIndex = 0;
      uiState.callerSubMode = 'target'; // Night 2+ is purely for skill targeting!
      gameState.players.forEach(p => {
        p.votes = 0;
      });
      gameState.nightActions.spellcasterTarget = null;
      gameState.nightActions.wolfTarget = null;
      gameState.nightActions.seerTarget = null;
      gameState.nightActions.bodyguardTarget = null;
      gameState.nightActions.witchHealed = false;
      gameState.nightActions.witchHealTarget = null;
      gameState.nightActions.witchPoisonTarget = null;
      gameState.nightActions.witchArmPoison = false;
      uiState.witchSelectionMode = null;
      pauseTimer();
      soundManager.playGong();
      saveAppState();
      if (typeof callbacks.renderGameScreen === 'function') callbacks.renderGameScreen();
      showGameToast(`🌙 Night ${gameState.currentNight} has begun!`);
    }
  });
}
