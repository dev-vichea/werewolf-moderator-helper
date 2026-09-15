/**
 * Day Phase Logic: Discussion, Voting, Lynch Execution, and Sunrise/Nightfall Transitions
 */
import { gameState, lobbyState, uiState } from '../../state/store.js';
import { soundManager } from '../../audio/sound.js';
import { saveAppState } from '../../state/storage.js';
import { showCustomAlert, showCustomConfirm } from '../../ui/dialog.js';
import { showGameToast } from '../../ui/toast.js';
import { startTimer, pauseTimer, updateTimerDisplay } from '../../utils/timer.js';
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

  // Handle Priest Holy Shield activation & break:
  let priestShieldSavedPlayer = null;
  if (gameState.priestShieldTarget) {
    const shieldedPlayer = gameState.players.find(p => p.id === gameState.priestShieldTarget);
    const wolfAttacked = (gameState.nightActions.wolfTarget === gameState.priestShieldTarget);
    const savedByGuard = wolfAttacked && (gameState.nightActions.bodyguardTarget === gameState.priestShieldTarget);
    const savedByWitch = wolfAttacked && gameState.nightActions.witchHealed && (!gameState.nightActions.witchHealTarget || gameState.nightActions.witchHealTarget === gameState.priestShieldTarget);
    const wolfBlockedByPriest = wolfAttacked && !savedByGuard && !savedByWitch;
    const poisonBlockedByPriest = (gameState.nightActions.witchPoisonTarget === gameState.priestShieldTarget);

    if (wolfBlockedByPriest || poisonBlockedByPriest) {
      priestShieldSavedPlayer = shieldedPlayer;
      gameState.priestShieldTarget = null;
    }
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
  if (priestShieldSavedPlayer) {
    if (typeof callbacks.addHistoryLog === 'function') {
      callbacks.addHistoryLog('Holy Shield Activated', `Priest's Holy Shield protected #${priestShieldSavedPlayer.seat} ${priestShieldSavedPlayer.name} from lethal attack and shattered!`);
    }
    showCustomAlert(
      `✝️ <strong>Holy Shield Activated!</strong><br><br>The Priest's Holy Shield protected <strong>#${priestShieldSavedPlayer.seat} ${priestShieldSavedPlayer.name}</strong> from a lethal nighttime attack and was consumed!<br><br><span style="color: #94a3b8; font-size: 0.88em;">The Priest will awaken on the next night to bestow a new shield.</span>`,
      {
        title: 'Holy Shield Activated',
        icon: '✝️',
        confirmText: 'Amen',
        confirmClass: 'btn-primary'
      }
    );
  }

  // Transition to DAY
  gameState.phase = 'DAY';
  gameState.daySubPhase = 'discussion';
  gameState.dayLynchedPlayer = null;
  gameState.wizardStepIndex = 0;
  gameState.players.forEach(p => p.votes = 0);
  gameState.nightActions.wolfTarget = null;
  gameState.nightActions.witchHealed = false;
  gameState.nightActions.witchHealTarget = null;
  gameState.nightActions.witchPoisonTarget = null;
  gameState.nightActions.witchArmPoison = false;
  gameState.nightActions.bodyguardTarget = null;
  uiState.witchSelectionMode = null;

  // SUNRISE PREPARE DISCUSSION TIMER (Ready to turn on with 1 click)
  gameState.timerRemaining = lobbyState.discussionTimer || 90;
  pauseTimer();

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

/**
 * Switch Day Sub-Phase (Discussion vs Lynch)
 */
export function setDaySubPhase(subPhase, callbacks = {}) {
  const targetSubPhase = (subPhase === 'lynch') ? 'lynch' : 'discussion';
  gameState.daySubPhase = targetSubPhase;
  soundManager.playBeep();
  saveAppState();

  renderDayControls();

  const renderTableFn = (typeof callbacks.renderTouchTable === 'function')
    ? callbacks.renderTouchTable
    : (typeof globalThis.renderTouchTable === 'function' ? globalThis.renderTouchTable : null);
  if (renderTableFn) renderTableFn();

  if (targetSubPhase === 'lynch') {
    showGameToast('⚖️ Town Vote & Lynch Mode: Tap cards to cast votes!');
  } else {
    showGameToast('☀️ Discussion Mode: Tap cards to view player info.');
  }
}

/**
 * 1-Click Discussion Timer Toggle
 */
export function toggleDiscussionTimer() {
  if (gameState.timerRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}



export function renderDayControls() {
  const currentSubPhase = gameState.daySubPhase || 'discussion';
  const isDiscussion = (currentSubPhase === 'discussion');

  // Sub-Phase Tabs
  const tabDiscussion = document.getElementById('day-tab-discussion');
  const tabLynch = document.getElementById('day-tab-lynch');
  if (tabDiscussion) tabDiscussion.classList.toggle('active', isDiscussion);
  if (tabLynch) tabLynch.classList.toggle('active', !isDiscussion);

  // Section Visibility
  const secDiscussion = document.getElementById('day-section-discussion');
  const secLynch = document.getElementById('day-section-lynch');
  if (secDiscussion) secDiscussion.style.display = isDiscussion ? 'flex' : 'none';
  if (secLynch) secLynch.style.display = isDiscussion ? 'none' : 'flex';

  // Section 1: Discussion controls
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

  // Section 2: Voting & Lynch controls
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

  // Update Vote Tally Pill
  const tallyPill = document.getElementById('day-vote-tally-pill');
  if (tallyPill) {
    tallyPill.textContent = `${currentTotalVotes}/${maxAllowedVotes} Votes`;
  }

  // Update Vote Hint
  const voteHint = document.getElementById('day-vote-hint');
  if (voteHint) {
    voteHint.innerHTML = `👉 Tap player card for +1 vote. Tap badge for −1 vote. <span style="color: #60a5fa; font-weight: 600;">(Total: ${currentTotalVotes}/${maxAllowedVotes})</span>`;
  }

  let maxVotes = 0;
  alive.forEach(p => {
    if ((p.votes || 0) > maxVotes) {
      maxVotes = p.votes;
    }
  });

  const leaders = maxVotes > 0 ? alive.filter(p => (p.votes || 0) === maxVotes) : [];
  const lynchBtn = document.getElementById('day-lynch-btn');
  const leaderStatus = document.getElementById('day-vote-leader-status');
  const sleepNightBtn = document.getElementById('day-sleep-night-btn');
  const skipLynchBtn = document.getElementById('day-skip-lynch-btn');

  if (gameState.dayLynchedPlayer) {
    if (leaderStatus) {
      leaderStatus.innerHTML = `💀 <strong style="color: #ef4444;">${gameState.dayLynchedPlayer}</strong> was executed today. Ready to sleep.`;
    }
    if (sleepNightBtn) {
      sleepNightBtn.style.display = 'inline-flex';
      sleepNightBtn.textContent = `🌙 Sleep (Night ${gameState.currentNight + 1})`;
    }
    if (skipLynchBtn) {
      skipLynchBtn.style.display = 'none';
    }
    if (lynchBtn) {
      lynchBtn.style.display = 'none';
    }
  } else {
    if (sleepNightBtn) {
      sleepNightBtn.style.display = 'none';
    }
    if (skipLynchBtn) {
      skipLynchBtn.style.display = 'inline-flex';
    }
    if (lynchBtn) {
      lynchBtn.style.display = 'inline-flex';
    }

    if (leaderStatus) {
      if (leaders.length === 1) {
        leaderStatus.innerHTML = `👑 Leading Suspect: <strong style="color: #ef4444;">#${leaders[0].seat} ${leaders[0].name}</strong> with <strong>${maxVotes}</strong> vote${maxVotes > 1 ? 's' : ''}`;
      } else if (leaders.length > 1) {
        const names = leaders.map(l => `#${l.seat} ${l.name}`).join(' & ');
        leaderStatus.innerHTML = `⚖️ Vote Tie: <strong style="color: #fbbf24;">${names}</strong> (${maxVotes} votes each)`;
      } else {
        leaderStatus.innerHTML = `🕊️ No votes cast yet. Tap player cards or skip lynch.`;
      }
    }

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
  }

  // Update Day Auto-Fill Button visibility
  const unknownCount = gameState.players.filter(p => p.role === 'Unknown').length;
  const dayAutofillBtn = document.getElementById('day-autofill-btn');
  if (dayAutofillBtn) {
    dayAutofillBtn.style.display = unknownCount > 0 ? 'inline-flex' : 'none';
    dayAutofillBtn.textContent = `⚡ Auto-Fill (${unknownCount})`;
  }

  // Always keep discussion timer bar in sync
  updateTimerDisplay();
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
    if (checkWinFn) checkWinFn(callbacks);
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
      gameState.dayLynchedPlayer = `#${leader.seat} ${leader.name}`;
      if (leader.id === gameState.priestShieldTarget) {
        gameState.priestShieldTarget = null;
        if (typeof callbacks.addHistoryLog === 'function') {
          callbacks.addHistoryLog('Holy Shield Shattered', `Priest's shield on #${leader.seat} ${leader.name} broke due to daytime lynch.`);
        }
      }
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
              if (partner.id === gameState.priestShieldTarget) {
                gameState.priestShieldTarget = null;
              }
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

export function skipLynchAndStartNight(callbacks = {}) {
  showCustomConfirm(`Pass Day ${gameState.currentDay} peacefully without executing anyone and begin Night ${gameState.currentNight + 1}?`, {
    icon: '🕊️',
    title: 'Peaceful Day (No Lynch)',
    confirmText: '🕊️ No Lynch (Sleep)',
    confirmClass: 'btn-primary',
    onConfirm: () => {
      if (typeof callbacks.addHistoryLog === 'function') {
        callbacks.addHistoryLog(`Day ${gameState.currentDay} Lynch`, 'Town decided on No Lynch. Peaceful day.');
      }
      executeNightfallTransition(callbacks);
    }
  });
}

export function startNightPhase(callbacks = {}) {
  if (typeof callbacks.cancelAutoAdvance === 'function') callbacks.cancelAutoAdvance();
  const targetNight = gameState.currentNight + 1;
  const promptText = gameState.dayLynchedPlayer
    ? `Send village to sleep and begin Night ${targetNight}? (${gameState.dayLynchedPlayer} was executed today)`
    : `Send village to sleep and begin Night ${targetNight}?`;

  showCustomConfirm(promptText, {
    icon: '🌙',
    title: 'Begin Nightfall',
    confirmText: '🌙 Begin Night',
    confirmClass: 'btn-primary',
    onConfirm: () => {
      executeNightfallTransition(callbacks);
    }
  });
}

export function executeNightfallTransition(callbacks = {}) {
  if (typeof callbacks.cancelAutoAdvance === 'function') callbacks.cancelAutoAdvance();
  gameState.phase = 'NIGHT';
  gameState.currentNight++;
  gameState.currentDay++;
  gameState.daySubPhase = 'discussion';
  gameState.dayLynchedPlayer = null;
  gameState.wizardStepIndex = 0;
  uiState.callerSubMode = 'target'; // Night 2+ is purely for skill targeting!
  gameState.priestWakesTonight = (gameState.currentNight === 1 || !gameState.priestShieldTarget);
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

  // Instant direct DOM transition:
  const callerBox = document.getElementById('night-caller-box');
  if (callerBox) callerBox.style.display = 'block';
  const dayControlsBar = document.getElementById('day-controls-bar');
  if (dayControlsBar) dayControlsBar.style.display = 'none';
  const phasePill = document.getElementById('game-phase-pill');
  if (phasePill) {
    phasePill.className = 'game-phase-pill night';
    phasePill.textContent = `🌙 Night ${gameState.currentNight}`;
  }

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
    const renderCallerFn = (typeof callbacks.renderNightCaller === 'function')
      ? callbacks.renderNightCaller
      : (typeof globalThis.renderNightCaller === 'function' ? globalThis.renderNightCaller : null);
    if (renderCallerFn) renderCallerFn();
  }

  showGameToast(`🌙 Night ${gameState.currentNight} has begun!`);
}
