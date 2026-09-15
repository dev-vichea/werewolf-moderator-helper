/**
 * Circular / Elliptical Touch Table Controller
 * Calculates perimeter distribution, renders touch nodes, and coordinates node hold & tap actions.
 */
import { gameState, lobbyState, uiState } from '../../state/store.js';
import { getRoleImage, getRoleTargetCount } from '../../state/roles.js';
import { soundManager } from '../../audio/sound.js';
import { saveAppState } from '../../state/storage.js';
import { showCustomAlert } from '../../ui/dialog.js';
import { showGameToast } from '../../ui/toast.js';
import { getEvenlySpacedEllipseAngles } from '../../utils/math.js';
import { openPlayerActionSheet } from '../../ui/modal/action-sheet.js';
import { previewNightDeaths, getInfectedCursedPlayer, handleWitchDirectPlayerTap, shouldWitchAutoAdvance } from './witch-potions.js';
import { getActiveNightSteps, setCallerSubMode, cancelAutoAdvance, scheduleAutoAdvance, nextWizardStep, renderNightCaller, isStepRoleDead, startNight1FromNight0 } from './night-caller.js';
import { addPlayerVote, renderDayControls } from './day-phase.js';
import { smartAutoFillRemainingRoles } from './autofill.js';

let tableResizeObserver = null;
let holdTimeout = null;
let isHolding = false;
let holdTriggered = false;

export function toggleTableExpand() {
  const container = document.getElementById('touch-table');
  if (!container) return;
  container.classList.toggle('expanded');
  const isExp = container.classList.contains('expanded');
  soundManager.playBeep();
  renderTouchTable();
  showGameToast(isExp ? '⛶ Table Expanded' : '🗗 Standard Table View');
}

export function setupTableResizeObserver() {
  const container = document.getElementById('touch-table');
  if (!container || tableResizeObserver) return;
  if (typeof ResizeObserver !== 'undefined') {
    let resizeTimer = null;
    tableResizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (gameState.inProgress && uiState.activeTab === 'game') {
          renderTouchTable();
        }
      }, 50);
    });
    tableResizeObserver.observe(container);
  }
}

export function renderTouchTable() {
  const container = document.getElementById('touch-table');
  if (!container) return;

  if (typeof globalThis.renderGameTopBar === 'function') {
    globalThis.renderGameTopBar();
  }

  setupTableResizeObserver();

  const existingNodes = new Map();
  container.querySelectorAll('.table-touch-node').forEach(n => {
    if (n.dataset && n.dataset.playerId) {
      existingNodes.set(n.dataset.playerId, n);
    } else {
      n.remove();
    }
  });

  const currentPlayerIds = new Set(gameState.players.map(p => p.id));
  for (const [id, node] of existingNodes.entries()) {
    if (!currentPlayerIds.has(id)) {
      node.remove();
      existingNodes.delete(id);
    }
  }

  const total = gameState.players.length;
  if (total === 0) return;

  // Dense roster class for scaling when 10+ players
  if (total >= 10) {
    container.classList.add('dense-roster');
  } else {
    container.classList.remove('dense-roster');
  }

  // Synchronize phase classes for animated ambient backgrounds (Sunrise vs Night)
  const isNight = (gameState.phase === 'NIGHT');
  const nightSteps = isNight ? getActiveNightSteps() : [];
  const activeNightStep = nightSteps[gameState.wizardStepIndex];
  const isSunriseStep = (isNight && activeNightStep && activeNightStep.id === 'resolution');

  if (isSunriseStep) {
    container.classList.remove('phase-night');
    container.classList.add('phase-day', 'phase-sunrise');
  } else if (isNight) {
    container.classList.remove('phase-day', 'phase-sunrise');
    container.classList.add('phase-night');
  } else {
    container.classList.remove('phase-night', 'phase-sunrise');
    container.classList.add('phase-day');
  }

  const width = container.clientWidth || 550;
  const height = container.clientHeight || 480;

  // Responsive node dimensions based on count and width (Vertical Playing Card ~1:1.4 aspect ratio)
  const isMobile = width < 480;
  let nodeWidth = isMobile ? (total >= 10 ? 64 : 72) : (total > 11 ? 76 : (total > 8 ? 86 : 96));
  const nodeHeight = isMobile ? (total >= 10 ? 90 : 100) : (total > 11 ? 106 : (total > 8 ? 120 : 134));

  const centerX = width / 2;
  const centerY = height / 2;

  // Safe radius margins to guarantee cards track the outer perimeter without clipping
  const cardHalfWidth = nodeWidth / 2;
  const cardHalfHeight = nodeHeight / 2;
  const paddingX = isMobile ? 8 : 14;
  const paddingY = isMobile ? 8 : 16;
  const maxSafeRadiusX = centerX - cardHalfWidth - paddingX;
  const maxSafeRadiusY = centerY - cardHalfHeight - paddingY;

  // Safe clearance from center hub
  const hubEl = document.getElementById('table-center-hub');
  const hubRadius = (hubEl && hubEl.offsetWidth ? hubEl.offsetWidth / 2 : 48);
  const minSafeRadiusX = hubRadius + cardHalfWidth + 12;
  const minSafeRadiusY = hubRadius + cardHalfHeight + 12;

  // Independent horizontal & vertical radii matching the table shape
  const radiusX = Math.max(minSafeRadiusX, maxSafeRadiusX);
  const radiusY = Math.max(minSafeRadiusY, maxSafeRadiusY);

  // --- Dynamic Center Hub with Status & Emoji ---
  const hubIcon = document.getElementById('table-hub-icon');
  const hubPhase = document.getElementById('table-hub-phase');
  const hubSub = document.getElementById('table-hub-sub');

  if (hubEl && hubIcon && hubPhase && hubSub) {
    let hubEmoji = '🌙';
    let hubTitle = `Night ${gameState.currentNight}`;
    let hubSubtitle = 'Tap to Advance ▶';
    let hubReady = false;
    let activeStep = null;

    if (gameState.phase === 'NIGHT') {
      const activeSteps = getActiveNightSteps();
      activeStep = activeSteps[gameState.wizardStepIndex];

      if (gameState.currentNight === 0) {
        const selectedP = uiState.selectedSwapSeatId ? gameState.players.find(p => p.id === uiState.selectedSwapSeatId) : null;
        hubEmoji = '🪑';
        hubTitle = selectedP ? `#${selectedP.seat} Selected` : 'Seating Setup';
        hubSubtitle = selectedP ? 'Tap partner to swap' : 'Begin Night 1 ▶';
        hubReady = true;
      } else if (!activeStep) {
        hubEmoji = '🌙';
        hubTitle = `Night ${gameState.currentNight}`;
        hubSubtitle = 'In Progress';
      } else if (activeStep.id === 'resolution') {
        const deaths = previewNightDeaths();
        const infectedCursed = getInfectedCursedPlayer();
        hubEmoji = '☀️';
        hubTitle = 'Sunrise';
        if (infectedCursed && !deaths.some(d => d.id === infectedCursed.id)) {
          hubSubtitle = deaths.length > 0 ? `💀 ${deaths.length} Dead • 🐺 Cursed Bitten • Tap ☀️` : `🐺 #${infectedCursed.seat} Turns Wolf • Tap ☀️`;
        } else {
          hubSubtitle = deaths.length > 0 ? `💀 ${deaths.length} Dead • Tap ☀️` : 'Peaceful • Tap ☀️';
        }
        hubReady = true;
      } else if (isStepRoleDead(activeStep)) {
        hubEmoji = '💀';
        hubTitle = `${activeStep.name} (Dead)`;
        hubSubtitle = 'Deceased • Tap Next ▶';
        hubReady = true;
      } else if (!activeStep.hasSkill) {
        const holders = gameState.players.filter(p => p.role === activeStep.targetRole);
        const targetCount = getRoleTargetCount(activeStep.targetRole);
        hubEmoji = activeStep.icon || '🤝';
        hubTitle = `${activeStep.targetRole} (${holders.length}/${targetCount})`;
        if (holders.length >= targetCount) {
          hubSubtitle = 'Ready! Tap to Next ▶';
          hubReady = true;
        } else {
          hubSubtitle = 'Tap player to set';
          hubReady = false;
        }
      } else {
        const holders = gameState.players.filter(p => p.role === activeStep.targetRole);
        const targetCount = getRoleTargetCount(activeStep.targetRole);

        if (uiState.callerSubMode === 'role') {
          hubEmoji = activeStep.icon || '🎭';
          hubTitle = `${activeStep.targetRole} (${holders.length}/${targetCount})`;
          if (holders.length >= targetCount) {
            hubSubtitle = 'Ready! Tap Target 🎯';
            hubReady = true;
          } else {
            hubSubtitle = 'Tap player to set';
            hubReady = false;
          }
        } else {
          if (activeStep.id === 'werewolves') {
            const victim = gameState.players.find(p => p.id === gameState.nightActions.wolfTarget);
            if (victim) {
              hubEmoji = '🎯';
              hubTitle = `#${victim.seat} ${victim.name}`;
              hubSubtitle = '💀 Target Set! ▶';
              hubReady = true;
            } else {
              hubEmoji = '🐺';
              hubTitle = 'Wolf Kill';
              hubSubtitle = 'Tap victim';
              hubReady = false;
            }
          } else if (activeStep.id === 'seer') {
            const inspected = gameState.players.find(p => p.id === gameState.nightActions.seerTarget);
            if (inspected) {
              const isWerewolf = (inspected.role === 'Werewolf' || inspected.role === 'Lycan');
              hubEmoji = isWerewolf ? '🐺' : '🧑';
              hubTitle = `#${inspected.seat} ${inspected.name}`;
              hubSubtitle = isWerewolf ? '🟢 Correct: Wolf! ▶' : '🔴 Wrong: Not Wolf ▶';
              hubReady = true;
            } else {
              hubEmoji = '🔮';
              hubTitle = 'Seer Check';
              hubSubtitle = 'Tap player to inspect';
              hubReady = false;
            }
          } else if (activeStep.id === 'bodyguard') {
            const shielded = gameState.players.find(p => p.id === gameState.nightActions.bodyguardTarget);
            if (shielded) {
              hubEmoji = '🛡️';
              hubTitle = `#${shielded.seat} ${shielded.name}`;
              hubSubtitle = '🛡️ Protected ▶';
              hubReady = true;
            } else {
              hubEmoji = '🛡️';
              hubTitle = 'Bodyguard';
              hubSubtitle = 'Tap to protect';
              hubReady = false;
            }
          } else if (activeStep.id === 'witch') {
            hubEmoji = '🧪';
            hubTitle = 'Witch';
            const victim = gameState.players.find(p => p.id === gameState.nightActions.wolfTarget);
            const isHealed = gameState.nightActions.witchHealed;
            const poisonVictim = gameState.players.find(p => p.id === gameState.nightActions.witchPoisonTarget);
            const hasAnyPotions = Boolean((gameState.potions.witchHealAvailable || isHealed) || (gameState.potions.witchPoisonAvailable || poisonVictim));

            if (!hasAnyPotions) {
              hubSubtitle = 'No Potions Left ▶';
            } else if (isHealed && poisonVictim) {
              hubSubtitle = `💚 Saved & ☠️ #${poisonVictim.seat}`;
            } else if (isHealed) {
              hubSubtitle = `💚 #${victim ? victim.seat : ''} Saved ▶`;
            } else if (poisonVictim) {
              hubSubtitle = `☠️ #${poisonVictim.seat} Poisoned ▶`;
            } else if (victim) {
              hubSubtitle = `Victim: #${victim.seat} ▶`;
            } else {
              hubSubtitle = 'Heal or Poison ▶';
            }
            hubReady = true;
          } else if (activeStep.id === 'cupid') {
            const l1 = gameState.players.find(p => p.id === gameState.nightActions.cupidLover1);
            const l2 = gameState.players.find(p => p.id === gameState.nightActions.cupidLover2);
            if (l1 && l2) {
              hubEmoji = '💘';
              hubTitle = `#${l1.seat} & #${l2.seat}`;
              hubSubtitle = '💘 Lovers Bound! ▶';
              hubReady = true;
            } else if (l1) {
              hubEmoji = '🏹';
              hubTitle = 'Lovers (1/2)';
              hubSubtitle = 'Tap 2nd player';
              hubReady = false;
            } else {
              hubEmoji = '🏹';
              hubTitle = 'Cupid';
              hubSubtitle = 'Tap 2 lovers';
              hubReady = false;
            }
          } else if (activeStep.id === 'spellcaster') {
            const silenced = gameState.players.find(p => p.id === gameState.nightActions.spellcasterTarget);
            if (silenced) {
              hubEmoji = '🤐';
              hubTitle = `#${silenced.seat} ${silenced.name}`;
              hubSubtitle = '🤐 Silenced ▶';
              hubReady = true;
            } else {
              hubEmoji = '✨';
              hubTitle = 'Spellcaster';
              hubSubtitle = 'Tap to silence';
              hubReady = false;
            }
          } else if (activeStep.id === 'doppelganger') {
            const copyTarget = gameState.players.find(p => p.id === gameState.nightActions.doppelgangerTarget);
            if (copyTarget) {
              hubEmoji = '🎭';
              hubTitle = `#${copyTarget.seat} ${copyTarget.name}`;
              hubSubtitle = '🎭 Target Linked! ▶';
              hubReady = true;
            } else {
              hubEmoji = '🎭';
              hubTitle = 'Doppelgänger';
              hubSubtitle = 'Tap player to link';
              hubReady = false;
            }
          } else if (activeStep.id === 'priest') {
            const shielded = gameState.players.find(p => p.id === gameState.priestShieldTarget);
            if (shielded) {
              hubEmoji = '✝️';
              hubTitle = `#${shielded.seat} ${shielded.name}`;
              hubSubtitle = '✝️ Holy Shield! ▶';
              hubReady = true;
            } else {
              hubEmoji = '✝️';
              hubTitle = 'Priest';
              hubSubtitle = 'Tap to shield';
              hubReady = false;
            }
          } else {
            hubEmoji = activeStep.icon || '🌙';
            hubTitle = activeStep.name || 'Night Action';
            hubSubtitle = 'Tap to Advance ▶';
            hubReady = true;
          }
        }
      }
    } else {
      // DAY PHASE
      const alive = gameState.players.filter(p => p.status === 'alive');
      let maxVotes = 0;
      alive.forEach(p => {
        if ((p.votes || 0) > maxVotes) maxVotes = p.votes;
      });
      const leaders = maxVotes > 0 ? alive.filter(p => (p.votes || 0) === maxVotes) : [];

      if (leaders.length === 1 && maxVotes > 0) {
        hubEmoji = '💀';
        hubTitle = `#${leaders[0].seat} ${leaders[0].name}`;
        hubSubtitle = `${maxVotes} Vote${maxVotes > 1 ? 's' : ''} (Lynch)`;
        hubReady = true;
      } else if (leaders.length > 1 && maxVotes > 0) {
        hubEmoji = '⚖️';
        hubTitle = `Tied (${maxVotes}v)`;
        hubSubtitle = 'Break Tie or Sleep';
        hubReady = false;
      } else {
        hubEmoji = '☀️';
        hubTitle = `Day ${gameState.currentDay}`;
        hubSubtitle = 'Tap for Night 🌙';
        hubReady = false;
      }
    }

    hubIcon.textContent = hubEmoji;
    hubPhase.textContent = hubTitle;
    hubSub.textContent = hubSubtitle;

    if (hubReady) {
      hubEl.classList.add('hub-ready');
    } else {
      hubEl.classList.remove('hub-ready');
    }

    if (activeStep && isStepRoleDead(activeStep)) {
      hubEl.classList.add('hub-role-dead');
    } else {
      hubEl.classList.remove('hub-role-dead');
    }

    // --- Witch 2-Potion Interactive Middle of Table Display ---
    const defaultHubContent = document.getElementById('table-hub-default-content');
    const witchHubContent = document.getElementById('table-hub-witch-content');
    const isWitchStep = (gameState.phase === 'NIGHT' && activeStep && activeStep.id === 'witch' && uiState.callerSubMode === 'target' && !isStepRoleDead(activeStep));
    const hasAnyPotions = Boolean(
      (gameState.potions.witchHealAvailable || gameState.nightActions.witchHealed) ||
      (gameState.potions.witchPoisonAvailable || gameState.nightActions.witchPoisonTarget)
    );

    if (isWitchStep && witchHubContent && hasAnyPotions) {
      hubEl.classList.add('witch-turn-hub');
      if (defaultHubContent) defaultHubContent.style.display = 'none';
      witchHubContent.style.display = 'flex';

      const victim = gameState.players.find(p => p.id === gameState.nightActions.wolfTarget);
      const victimEl = document.getElementById('witch-hub-victim');
      if (victimEl) {
        victimEl.style.display = 'none';
        if (victim) {
          victimEl.textContent = `🐺 Victim: #${victim.seat} ${victim.name}`;
        } else {
          victimEl.textContent = 'Peaceful Night (No Wolf Victim)';
        }
      }

      // Heal circle button state
      const healBtn = document.getElementById('witch-hub-heal-btn');
      const healBadge = document.getElementById('witch-hub-heal-badge');
      const healTitle = document.getElementById('witch-hub-heal-title');
      const healDesc = document.getElementById('witch-hub-heal-desc');
      if (healBtn) {
        if (!gameState.potions.witchHealAvailable && !gameState.nightActions.witchHealed) {
          healBtn.className = 'witch-hub-btn heal disabled';
          healBtn.title = 'Heal Potion (Used in earlier night)';
          if (healBadge) healBadge.style.display = 'none';
          if (healTitle) healTitle.textContent = 'Heal Potion';
          if (healDesc) healDesc.textContent = 'Used (0 Left)';
        } else if (gameState.nightActions.witchHealed) {
          healBtn.className = 'witch-hub-btn heal active-used';
          const hPlayer = gameState.players.find(p => p.id === (gameState.nightActions.witchHealTarget || gameState.nightActions.wolfTarget));
          healBtn.title = `Saved #${hPlayer ? hPlayer.seat + ' ' + hPlayer.name : 'Victim'} (Tap to Cancel)`;
          if (healBadge) {
            healBadge.style.display = 'flex';
            healBadge.textContent = '✓';
          }
          if (healTitle) healTitle.textContent = `💚 Saved #${hPlayer ? hPlayer.seat : ''}`;
          if (healDesc) healDesc.textContent = `${hPlayer ? hPlayer.name : 'Victim'} (Cancel)`;
        } else if (!victim) {
          healBtn.className = 'witch-hub-btn heal ready';
          healBtn.title = 'Nobody attacked by wolves tonight';
          if (healBadge) healBadge.style.display = 'none';
          if (healTitle) healTitle.textContent = 'Heal Potion';
          if (healDesc) healDesc.textContent = 'No Victim';
        } else {
          healBtn.className = 'witch-hub-btn heal ready';
          healBtn.title = `Save victim #${victim.seat} ${victim.name} (Tap to save)`;
          if (healBadge) healBadge.style.display = 'none';
          if (healTitle) healTitle.textContent = 'Heal Potion';
          if (healDesc) healDesc.textContent = `Save #${victim.seat}`;
        }
      }

      // Poison circle button state
      const poisonBtn = document.getElementById('witch-hub-poison-btn');
      const poisonBadge = document.getElementById('witch-hub-poison-badge');
      const poisonTitle = document.getElementById('witch-hub-poison-title');
      const poisonDesc = document.getElementById('witch-hub-poison-desc');
      if (poisonBtn) {
        if (!gameState.potions.witchPoisonAvailable && !gameState.nightActions.witchPoisonTarget) {
          poisonBtn.className = 'witch-hub-btn poison disabled';
          poisonBtn.title = 'Poison Potion (Used in earlier night)';
          if (poisonBadge) poisonBadge.style.display = 'none';
          if (poisonTitle) poisonTitle.textContent = 'Poison Potion';
          if (poisonDesc) poisonDesc.textContent = 'Used (0 Left)';
        } else if (uiState.witchSelectionMode === 'poison') {
          poisonBtn.className = 'witch-hub-btn poison selecting';
          poisonBtn.title = 'Poisoning... Tap player on table';
          if (poisonBadge) poisonBadge.style.display = 'none';
          if (poisonTitle) poisonTitle.textContent = 'Poisoning...';
          if (poisonDesc) poisonDesc.textContent = '👉 Tap Player';
        } else if (gameState.nightActions.witchPoisonTarget) {
          poisonBtn.className = 'witch-hub-btn poison active-used';
          const pPlayer = gameState.players.find(p => p.id === gameState.nightActions.witchPoisonTarget);
          poisonBtn.title = `Poisoned #${pPlayer ? pPlayer.seat + ' ' + pPlayer.name : ''} (Tap to Cancel)`;
          if (poisonBadge) {
            poisonBadge.style.display = 'flex';
            poisonBadge.textContent = '☠️';
          }
          if (poisonTitle) poisonTitle.textContent = `☠️ Poison #${pPlayer ? pPlayer.seat : ''}`;
          if (poisonDesc) poisonDesc.textContent = `${pPlayer ? pPlayer.name : ''} (Cancel)`;
        } else {
          poisonBtn.className = 'witch-hub-btn poison ready';
          poisonBtn.title = 'Poison Potion (Ready - Tap to arm)';
          if (poisonBadge) poisonBadge.style.display = 'none';
          if (poisonTitle) poisonTitle.textContent = 'Poison Potion';
          if (poisonDesc) poisonDesc.textContent = '1 Left (Ready)';
        }
      }

      // Keep auxiliary text hidden for clean & simple two circle buttons
      const instrEl = document.getElementById('witch-hub-instruction');
      if (instrEl) instrEl.style.display = 'none';

      const doneBtn = document.getElementById('witch-hub-done-btn');
      if (doneBtn) doneBtn.style.display = 'none';
    } else if (hubEl) {
      hubEl.classList.remove('witch-turn-hub');
      if (defaultHubContent) defaultHubContent.style.display = 'flex';
      if (witchHubContent) witchHubContent.style.display = 'none';
    }
  }

  // Update Toolbar Expand Button text
  const expandBtn = document.getElementById('table-expand-btn');
  if (expandBtn) {
    const isExp = container.classList.contains('expanded');
    expandBtn.textContent = isExp ? '⛷ Compact Table' : '⛶ Expand Table';
  }

  // Update Toolbar Hint for Night 0 vs regular play
  const toolbarHint = document.querySelector('.table-toolbar-hint');
  if (toolbarHint) {
    if (gameState.phase === 'NIGHT' && gameState.currentNight === 0) {
      const selP = uiState.selectedSwapSeatId ? gameState.players.find(p => p.id === uiState.selectedSwapSeatId) : null;
      toolbarHint.innerHTML = selP 
        ? `🔄 <em>Selected #${selP.seat} ${selP.name} • Tap another to swap</em>`
        : `🪑 <em>Night 0: Tap any 2 players to swap seats!</em>`;
    } else {
      toolbarHint.innerHTML = `💡 <em>Hold card to edit role/status</em>`;
    }
  }

  // Night 0 Toolbar Actions: Rotate & Start Night 1
  const rotateBtn = document.getElementById('table-rotate-btn');
  if (rotateBtn) {
    rotateBtn.style.display = (gameState.phase === 'NIGHT' && gameState.currentNight === 0) ? 'inline-flex' : 'none';
  }
  const startNight1Btn = document.getElementById('table-start-night1-btn');
  if (startNight1Btn) {
    startNight1Btn.style.display = (gameState.phase === 'NIGHT' && gameState.currentNight === 0) ? 'inline-flex' : 'none';
  }

  // Update Toolbar Random Roles Button visibility & label
  const unknownCount = gameState.players.filter(p => p.role === 'Unknown').length;
  const tableAutofillBtn = document.getElementById('table-autofill-btn');
  if (tableAutofillBtn) {
    tableAutofillBtn.style.display = 'inline-flex';
    if (unknownCount === 0) {
      tableAutofillBtn.textContent = '🎲 Re-Randomize All';
    } else if (unknownCount === gameState.players.length) {
      tableAutofillBtn.textContent = '🎲 Random All Roles';
    } else {
      tableAutofillBtn.textContent = `🎲 Random Roles (${unknownCount})`;
    }
  }

  const steps = (gameState.phase === 'NIGHT') ? getActiveNightSteps() : [];
  const currentStep = steps[gameState.wizardStepIndex];

  // Active turn players whose cards animate to the middle of the table
  const activeTurnPlayers = (gameState.phase === 'NIGHT' && currentStep && currentStep.targetRole)
    ? gameState.players.filter(p => p.status === 'alive' && p.role === currentStep.targetRole)
    : [];

  if (activeTurnPlayers.length > 0) {
    container.classList.add('has-active-turn-actor');
  } else {
    container.classList.remove('has-active-turn-actor');
  }

  // Evenly distribute cards along the perimeter of the ellipse
  const angles = getEvenlySpacedEllipseAngles(total, radiusX, radiusY);

  gameState.players.forEach((p, idx) => {
    const angle = angles[idx];

    const isCurrentTurn = (
      gameState.phase === 'NIGHT' &&
      currentStep &&
      currentStep.targetRole &&
      p.role === currentStep.targetRole &&
      p.status === 'alive'
    );

    let x, y;
    if (isCurrentTurn) {
      // Animate card inward towards the middle of the table
      const minActiveRadiusX = hubRadius + cardHalfWidth + (isMobile ? 8 : 14);
      const minActiveRadiusY = hubRadius + cardHalfHeight + (isMobile ? 8 : 14);
      const activeRadiusX = Math.max(minActiveRadiusX, radiusX * 0.44);
      const activeRadiusY = Math.max(minActiveRadiusY, radiusY * 0.44);

      let radiusScale = 1.0;
      if (activeTurnPlayers.length === 2) {
        const turnIdx = activeTurnPlayers.findIndex(tp => tp.id === p.id);
        const otherIdx = 1 - turnIdx;
        const otherP = activeTurnPlayers[otherIdx];
        const otherAngle = angles[gameState.players.findIndex(x => x.id === otherP.id)];
        const angleDiff = Math.abs(angle - otherAngle);
        if (angleDiff < 1.05 || (Math.PI * 2 - angleDiff) < 1.05) {
          radiusScale = (turnIdx === 0) ? 0.90 : 1.15;
        }
      }

      x = centerX + (activeRadiusX * radiusScale) * Math.cos(angle);
      y = centerY + (activeRadiusY * radiusScale) * Math.sin(angle);
    } else {
      x = centerX + radiusX * Math.cos(angle);
      y = centerY + radiusY * Math.sin(angle);
    }

    const isWolfTarget = (gameState.nightActions.wolfTarget === p.id);
    const isShieldTarget = Boolean(p.isShielded || (gameState.nightActions.bodyguardTarget === p.id) || (gameState.nightActions.bodyguardLastTarget === p.id));
    const isPriestShieldTarget = Boolean(gameState.priestShieldTarget === p.id);
    const isPoisonTarget = (gameState.nightActions.witchPoisonTarget === p.id);
    const isHealTarget = (gameState.nightActions.witchHealed && (gameState.nightActions.witchHealTarget === p.id || (!gameState.nightActions.witchHealTarget && gameState.nightActions.wolfTarget === p.id)));
    const isSilenced = Boolean(p.isSilenced || gameState.nightActions.spellcasterTarget === p.id);
    const isMirrorTarget = Boolean(gameState.nightActions.doppelgangerTarget === p.id);
    const isCupidTarget = (gameState.phase === 'NIGHT' && currentStep && currentStep.id === 'cupid' && uiState.callerSubMode === 'target' && (gameState.nightActions.cupidLover1 === p.id || gameState.nightActions.cupidLover2 === p.id));
    const isSeerTarget = (gameState.phase === 'NIGHT' && currentStep && currentStep.id === 'seer' && gameState.nightActions.seerTarget === p.id);
    const isSeerWolf = isSeerTarget && (p.role === 'Werewolf' || p.role === 'Lycan');

    let targetClass = '';
    if (p.status === 'alive') {
      if (isWolfTarget && isHealTarget) targetClass = 'targeted-heal';
      else if (isHealTarget) targetClass = 'targeted-heal';
      else if (isWolfTarget) targetClass = 'targeted-wolf';
      else if (isShieldTarget) targetClass = 'targeted-shield';
      else if (isPriestShieldTarget) targetClass = 'targeted-priest';
      else if (isPoisonTarget) targetClass = 'targeted-poison';
      else if (isSilenced) targetClass = 'targeted-silence';
      else if (isMirrorTarget) targetClass = 'targeted-mirror';
      else if (isCupidTarget) targetClass = 'targeted-cupid';
      else if (isSeerTarget) targetClass = isSeerWolf ? 'targeted-seer-wolf' : 'targeted-seer-town';
    }

    // Highlight and style active role holders (only if alive!)
    if (isCurrentTurn) {
      const roleLower = (p.role || '').toLowerCase();
      targetClass += ` is-turn-actor active-role-actor actor-${roleLower}`;
    } else if (gameState.phase === 'NIGHT' && currentStep && currentStep.targetRole && p.role === currentStep.targetRole && p.status === 'alive') {
      targetClass += (uiState.callerSubMode === 'role' ? ' role-selected' : ' active-role-actor');
    }

    const isSwapSelected = (gameState.phase === 'NIGHT' && gameState.currentNight === 0 && uiState.selectedSwapSeatId === p.id);
    if (isSwapSelected) {
      targetClass += ' seat-swap-selected';
    }

    let turnBadgeText = '';
    if (isSwapSelected) {
      turnBadgeText = '🔄 SWAP';
    } else if (isCurrentTurn) {
      switch (p.role) {
        case 'Werewolf': turnBadgeText = '🐺 WOLF TURN'; break;
        case 'Seer': turnBadgeText = '🔮 SEER CHECK'; break;
        case 'Witch': turnBadgeText = '🧪 WITCH'; break;
        case 'Bodyguard': turnBadgeText = '🛡️ SHIELD'; break;
        case 'Cupid': turnBadgeText = '💘 CUPID'; break;
        case 'Hunter': turnBadgeText = '🏹 HUNTER'; break;
        case 'Mason': turnBadgeText = '🤝 MASON'; break;
        case 'Spellcaster': turnBadgeText = '✨ SILENCE'; break;
        case 'Doppelganger': turnBadgeText = '🎭 MIMIC'; break;
        case 'Priest': turnBadgeText = '✝️ PRIEST'; break;
        case 'Cursed': turnBadgeText = '🧟 CURSED'; break;
        default: turnBadgeText = '👁️ ACTIVE'; break;
      }
    }

    // Collect ALL active status emojis (supports 1+ simultaneous emojis)
    const statusEmojis = [];
    if (p.status === 'dead') {
      statusEmojis.push({ emoji: '💀', title: 'Dead' });
      if (p.isMayor) statusEmojis.push({ emoji: '👑', title: 'Former Mayor' });
      if (p.isLover) statusEmojis.push({ emoji: '💘', title: 'Lover' });
    } else {
      if (isShieldTarget) statusEmojis.push({ emoji: '🛡️', title: 'Shielded (Protected)' });
      if (isPriestShieldTarget) statusEmojis.push({ emoji: '✝️', title: 'Holy Shield (Protected from next night kill)' });
      if (p.isLover) statusEmojis.push({ emoji: '💘', title: 'Lover' });
      if (p.isMayor) statusEmojis.push({ emoji: '👑', title: 'Mayor' });
      if (isSilenced) statusEmojis.push({ emoji: '🤐', title: 'Silenced (Cannot Speak)' });
      if (p.checkedBySeer) statusEmojis.push({ emoji: '👁️', title: 'Inspected by Seer' });
      if (isHealTarget) statusEmojis.push({ emoji: '💚', title: 'Healed by Witch' });
      if (isPoisonTarget) statusEmojis.push({ emoji: '☠️', title: 'Poisoned by Witch' });
      if (isWolfTarget) statusEmojis.push({ emoji: '🐺', title: 'Targeted by Werewolves' });
      if (isMirrorTarget) statusEmojis.push({ emoji: '🎭', title: 'Doppelgänger Target' });
      if (isSeerTarget) statusEmojis.push({ emoji: isSeerWolf ? '🟢' : '🔴', title: isSeerWolf ? 'Seer: Wolf!' : 'Seer: Town' });
      if (isSwapSelected) statusEmojis.push({ emoji: '🔄', title: 'Selected to swap seat' });
    }

    let node = existingNodes.get(p.id);
    const isNew = !node;
    if (isNew) {
      node = document.createElement('div');
      node.dataset.playerId = p.id;
      setupPlayerNodeHold(node, p.id);
      container.appendChild(node);
    }

    node.className = `table-touch-node ${p.status === 'dead' ? 'dead' : ''} ${statusEmojis.length > 0 ? 'has-status-emojis' : ''} ${targetClass}`.trim();
    node.style.left = `${Math.round(x)}px`;
    node.style.top = `${Math.round(y)}px`;
    node.style.width = `${Math.round(nodeWidth)}px`;
    node.style.height = `${Math.round(nodeHeight)}px`;

    node.innerHTML = `
      <div class="node-seat-header">
        <span class="node-seat-badge" title="${p.name}">${p.name}</span>
      </div>
      ${statusEmojis.length > 0 ? `
        <div class="node-status-emojis" title="${statusEmojis.map(s => s.title).join(' • ')}">
          ${statusEmojis.map(s => `<span class="status-emoji" title="${s.title}">${s.emoji}</span>`).join('')}
        </div>
      ` : ''}
      ${turnBadgeText ? `<span class="node-turn-indicator-badge">${turnBadgeText}</span>` : ''}
      <div class="node-card-art-frame node-avatar-wrapper">
        <img src="${getRoleImage(p.role)}" class="node-card-full-img node-avatar" alt="${p.role}" onerror="this.src='images/anonymous.jpeg'">
        <div class="node-card-gradient-overlay"></div>
        <div class="node-role-label ${p.role === 'Unknown' ? 'role-unknown' : ''}">${p.role === 'Unknown' ? '? Unknown' : p.role}</div>
        ${p.status === 'alive' && p.votes && p.votes > 0 ? `<span class="node-vote-badge" onclick="decrementPlayerVote('${p.id}', event)" title="Tap to -1 vote">${p.votes}v<span class="vote-minus-symbol">-</span></span>` : ''}
      </div>
    `;
  });
}

export function setupPlayerNodeHold(node, playerId) {
  const onHoldStart = (e) => {
    holdTriggered = false;
    isHolding = true;
    node.classList.add('holding');
    holdTimeout = setTimeout(() => {
      if (isHolding) {
        holdTriggered = true;
        node.classList.remove('holding');
        if (navigator.vibrate) {
          try { navigator.vibrate(40); } catch(err){}
        }
        soundManager.playBeep();
        openPlayerActionSheet(playerId);
      }
    }, 450);
  };

  const onHoldEnd = () => {
    isHolding = false;
    node.classList.remove('holding');
    if (holdTimeout) {
      clearTimeout(holdTimeout);
      holdTimeout = null;
    }
  };

  // Touch handlers
  node.addEventListener('touchstart', onHoldStart, { passive: true });
  node.addEventListener('touchend', onHoldEnd);
  node.addEventListener('touchcancel', onHoldEnd);
  node.addEventListener('touchmove', onHoldEnd);

  // Mouse handlers (desktop)
  node.addEventListener('mousedown', (e) => {
    if (e.button === 0) onHoldStart(e);
  });
  node.addEventListener('mouseup', onHoldEnd);
  node.addEventListener('mouseleave', onHoldEnd);

  // Context menu (right click)
  node.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    onHoldEnd();
    openPlayerActionSheet(playerId);
  });

  // Regular click
  node.onclick = () => {
    if (holdTriggered) {
      holdTriggered = false;
      return;
    }
    handleTableNodeTap(playerId);
  };
}

export function handleTableNodeTap(playerId, callbacks = {}) {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return;

  // 1. DAY PHASE: Tapping adds a vote!
  if (gameState.phase === 'DAY') {
    if (player.status !== 'alive') return;
    addPlayerVote(player.id, { renderTouchTable, ...callbacks });
    return;
  }

  // 2. NIGHT PHASE - NIGHT 0: SEAT SWAPPING
  if (gameState.phase === 'NIGHT' && gameState.currentNight === 0) {
    handleSeatSwapTap(playerId, callbacks);
    return;
  }

  // NIGHT 1+: ROLE CALLER & ACTIONS
  const steps = getActiveNightSteps();
  const currentStep = steps[gameState.wizardStepIndex];
  if (!currentStep) return;

  if (currentStep.id === 'resolution') {
    openPlayerActionSheet(playerId);
    return;
  }

  // If this step's role is dead, they cannot take any night action!
  if (isStepRoleDead(currentStep)) {
    soundManager.playBeep();
    showGameToast(`💀 ${currentStep.targetRole} is dead! No night action can be taken.`);
    return;
  }

  if (gameState.currentNight >= 2) {
    uiState.callerSubMode = 'target';
  }

  // SUB-MODE A: SET ROLE
  if (uiState.callerSubMode === 'role' && gameState.currentNight === 1) {
    const holders = gameState.players.filter(p => p.role === currentStep.targetRole);
    const targetCount = getRoleTargetCount(currentStep.targetRole);

    if (player.role === currentStep.targetRole) {
      player.role = 'Unknown';
      cancelAutoAdvance();
      soundManager.playBeep();
      if (typeof callbacks.addHistoryLog === 'function') {
        callbacks.addHistoryLog('Set Role', `Removed ${currentStep.targetRole} from #${player.seat} ${player.name}`);
      }
      saveAppState();
      renderNightCaller();
      renderTouchTable();
      return;
    }

    // If all holders for this step are already assigned, and the step has a skill (e.g. Werewolves, Seer):
    // Automatically transition to target mode and let the tap execute the skill action!
    if (holders.length >= targetCount && currentStep.hasSkill) {
      uiState.callerSubMode = 'target';
      uiState.userExplicitRoleMode = false;
      renderNightCaller();
      // Falls through to SUB-MODE B (Skill Targeting)
    } else {
      if (player.role !== 'Unknown') {
        soundManager.playBeep();
        showCustomAlert(`⚠️ #${player.seat} ${player.name} is already assigned as "${player.role}"!\nCannot replace with "${currentStep.targetRole}".\nTo reassign, tap them in the ${player.role} step to unassign first.`);
        return;
      }

      if (holders.length >= targetCount) {
        soundManager.playBeep();
        showCustomAlert(`⚠️ Limit reached! Exactly ${targetCount} ${currentStep.targetRole}(s) configured in deck.\nTap an existing ${currentStep.targetRole} to unselect if you made a mistake.`);
        return;
      }

      player.role = currentStep.targetRole;
      soundManager.playChime();
      if (typeof callbacks.addHistoryLog === 'function') {
        callbacks.addHistoryLog('Set Role', `Set #${player.seat} ${player.name} to ${player.role}`);
      }
      smartAutoFillRemainingRoles(false, callbacks);

      const updatedHolders = gameState.players.filter(p => p.role === currentStep.targetRole);

      if (updatedHolders.length >= targetCount) {
        if (currentStep.hasSkill) {
          uiState.callerSubMode = 'target';
          uiState.userExplicitRoleMode = false;
          soundManager.playChime();
        } else {
          soundManager.playChime();
          scheduleAutoAdvance(500, callbacks);
        }
      }

      saveAppState();
      renderNightCaller();
      renderTouchTable();
      return;
    }
  }

  // SUB-MODE B: SKILL TARGETING
  if (currentStep.id === 'doppelganger') {
    const doppel = gameState.players.find(p => p.role === 'Doppelganger' && p.status === 'alive') ||
                   gameState.players.find(p => p.role === 'Doppelganger');

    if (doppel && doppel.id === player.id) {
      soundManager.playBeep();
      showCustomAlert(`⚠️ #${player.seat} ${player.name} is the Doppelgänger!\n\nShe must choose another player to copy if they die.`);
      return;
    }

    if (player.status !== 'alive') {
      soundManager.playBeep();
      showCustomAlert(`⚠️ #${player.seat} ${player.name} is dead!\n\nPlease choose a living player on Night 1.`);
      return;
    }

    if (gameState.nightActions.doppelgangerTarget === playerId) {
      gameState.nightActions.doppelgangerTarget = null;
      if (doppel) doppel.doppelTarget = null;
      cancelAutoAdvance();
      soundManager.playBeep();
    } else {
      gameState.nightActions.doppelgangerTarget = playerId;
      if (doppel) {
        doppel.doppelTarget = playerId;
        gameState.nightActions.doppelgangerPlayer = doppel.id;
      }
      soundManager.playChime();
      showGameToast(`🎭 Doppelgänger linked with #${player.seat} ${player.name}`);
      if (typeof callbacks.addHistoryLog === 'function') {
        callbacks.addHistoryLog('Doppelgänger Link', `Doppelgänger (${doppel ? doppel.name : 'Doppelgänger'}) chose #${player.seat} ${player.name} to copy if they die.`);
      }
      scheduleAutoAdvance(650, callbacks);
    }
    saveAppState();
    renderNightCaller();
    renderTouchTable();
    return;
  }

  if (player.status !== 'alive') {
    showCustomAlert(`⚠️ #${player.seat} ${player.name} is dead!\nCannot target dead players.`, {
      title: 'Action Blocked',
      icon: '💀',
      confirmText: 'Got It',
      confirmClass: 'btn-danger-solid'
    });
    return;
  }

  if (currentStep.id === 'werewolves') {
    if (player.role === 'Werewolf') {
      soundManager.playBeep();
      showCustomAlert(`⚠️ #${player.seat} ${player.name} is a Werewolf!\n\nWerewolves cannot eliminate fellow pack members. Please choose a non-werewolf victim.`);
      return;
    }
    if (gameState.nightActions.wolfTarget === playerId) {
      gameState.nightActions.wolfTarget = null;
      cancelAutoAdvance();
      soundManager.playBeep();
    } else {
      gameState.nightActions.wolfTarget = playerId;
      soundManager.playBeep();
      scheduleAutoAdvance(600, callbacks);
    }
    saveAppState();
    renderNightCaller();
    renderTouchTable();
  } else if (currentStep.id === 'bodyguard') {
    if (playerId === gameState.nightActions.bodyguardLastTarget) {
      showCustomAlert(`⚠️ Bodyguard shielded #${player.seat} ${player.name} last night!\nCannot guard the same person two nights in a row.`, {
        title: 'Action Blocked',
        icon: '🛡️',
        confirmText: 'Choose Someone Else',
        confirmClass: 'btn-warning'
      });
      return;
    }
    if (gameState.nightActions.bodyguardTarget === playerId) {
      gameState.nightActions.bodyguardTarget = null;
      player.isShielded = false;
      cancelAutoAdvance();
      soundManager.playBeep();
    } else {
      gameState.players.forEach(x => { if (x.id !== playerId) x.isShielded = false; });
      gameState.nightActions.bodyguardTarget = playerId;
      player.isShielded = true;
      soundManager.playBeep();
      scheduleAutoAdvance(600, callbacks);
    }
    saveAppState();
    renderNightCaller();
    renderTouchTable();
  } else if (currentStep.id === 'spellcaster') {
    if (gameState.nightActions.spellcasterTarget === playerId) {
      gameState.nightActions.spellcasterTarget = null;
      player.isSilenced = false;
      cancelAutoAdvance();
      soundManager.playBeep();
    } else {
      gameState.players.forEach(x => { if (x.id !== playerId) x.isSilenced = false; });
      gameState.nightActions.spellcasterTarget = playerId;
      player.isSilenced = true;
      soundManager.playBeep();
      scheduleAutoAdvance(600, callbacks);
    }
    saveAppState();
    renderNightCaller();
    renderTouchTable();
  } else if (currentStep.id === 'witch') {
    const hasAnyPotions = Boolean((gameState.potions.witchHealAvailable || gameState.nightActions.witchHealed) || (gameState.potions.witchPoisonAvailable || gameState.nightActions.witchPoisonTarget));
    if (!hasAnyPotions) {
      soundManager.playBeep();
      showGameToast('🧪 Witch has no potions remaining.');
      return;
    }

    if (uiState.witchSelectionMode === 'heal') {
      if (playerId !== gameState.nightActions.wolfTarget) {
        soundManager.playBeep();
        const wolfVictim = gameState.players.find(p => p.id === gameState.nightActions.wolfTarget);
        showGameToast(`⚠️ The Witch can only heal the werewolf victim (${wolfVictim ? '#' + wolfVictim.seat + ' ' + wolfVictim.name : 'Nobody'})!`);
        return;
      }
      gameState.nightActions.witchHealed = true;
      gameState.nightActions.witchHealTarget = playerId;
      uiState.witchSelectionMode = null;
      soundManager.playChime();
      saveAppState();
      renderNightCaller(callbacks);
      renderTouchTable();
      if (shouldWitchAutoAdvance()) {
        showGameToast(`💚 #${player.seat} ${player.name} saved with Healing Potion! (Both potions used)`);
        scheduleAutoAdvance(900, callbacks);
      } else {
        cancelAutoAdvance();
        showGameToast(`💚 #${player.seat} ${player.name} saved! (Poison potion still available)`);
      }
      return;
    } else if (uiState.witchSelectionMode === 'poison' || gameState.nightActions.witchArmPoison) {
      if (player.status !== 'alive') {
        soundManager.playBeep();
        showGameToast('⚠️ Cannot poison deceased players.');
        return;
      }
      gameState.nightActions.witchPoisonTarget = (gameState.nightActions.witchPoisonTarget === playerId) ? null : playerId;
      uiState.witchSelectionMode = null;
      gameState.nightActions.witchArmPoison = false;
      soundManager.playBeep();
      if (gameState.nightActions.witchPoisonTarget) {
        soundManager.playChime();
        if (shouldWitchAutoAdvance()) {
          showGameToast(`☠️ #${player.seat} ${player.name} targeted for poison! (Both potions used)`);
          scheduleAutoAdvance(650, callbacks);
        } else {
          cancelAutoAdvance();
          showGameToast(`☠️ #${player.seat} ${player.name} targeted for poison! (Heal potion still available)`);
        }
      } else {
        showGameToast('☠️ Poison cancelled.');
        cancelAutoAdvance();
      }
      saveAppState();
      renderNightCaller(callbacks);
      renderTouchTable();
      return;
    } else {
      handleWitchDirectPlayerTap(player, callbacks);
      return;
    }
  } else if (currentStep.id === 'seer') {
    gameState.nightActions.seerTarget = playerId;
    player.checkedBySeer = true;
    soundManager.playChime();
    const isWerewolf = (player.role === 'Werewolf' || player.role === 'Lycan');

    if (isWerewolf) {
      const roleText = player.role === 'Lycan' ? 'Lycan (Appears as Werewolf)' : 'Werewolf';
      showCustomAlert(
        `#${player.seat} ${player.name}\n\nRole: ${roleText}`,
        {
          title: '🟢 Correct: Werewolf!',
          icon: '🐺',
          confirmText: 'Got It (Werewolf) 👍',
          confirmClass: 'btn-success',
          cardBorder: '#10b981',
          cardGlow: 'rgba(16, 185, 129, 0.4)'
        }
      );
      if (typeof callbacks.addHistoryLog === 'function') {
        callbacks.addHistoryLog('Seer Check', `Seer checked #${player.seat} ${player.name} -> 🟢 Correct: Werewolf (${player.role})`);
      }
    } else {
      showCustomAlert(
        `#${player.seat} ${player.name}\n\nRole: ${player.role}`,
        {
          title: '🔴 Wrong: Not Werewolf',
          icon: '❌',
          confirmText: 'Got It (Not Werewolf) 👎',
          confirmClass: 'btn-danger-solid',
          cardBorder: '#ef4444',
          cardGlow: 'rgba(239, 68, 68, 0.4)'
        }
      );
      if (typeof callbacks.addHistoryLog === 'function') {
        callbacks.addHistoryLog('Seer Check', `Seer checked #${player.seat} ${player.name} -> 🔴 Wrong: Not Werewolf (${player.role})`);
      }
    }

    saveAppState();
    renderNightCaller();
    renderTouchTable();
    scheduleAutoAdvance(500, callbacks);
  } else if (currentStep.id === 'cupid') {
    if (gameState.nightActions.cupidLover1 === playerId) {
      gameState.nightActions.cupidLover1 = null;
      player.isLover = false;
      cancelAutoAdvance();
      soundManager.playBeep();
    } else if (gameState.nightActions.cupidLover2 === playerId) {
      gameState.nightActions.cupidLover2 = null;
      player.isLover = false;
      cancelAutoAdvance();
      soundManager.playBeep();
    } else if (!gameState.nightActions.cupidLover1) {
      gameState.nightActions.cupidLover1 = playerId;
      player.isLover = true;
      soundManager.playBeep();
    } else if (!gameState.nightActions.cupidLover2) {
      gameState.nightActions.cupidLover2 = playerId;
      player.isLover = true;
      soundManager.playChime();
      const p1 = gameState.players.find(p => p.id === gameState.nightActions.cupidLover1);
      if (typeof callbacks.addHistoryLog === 'function') {
        callbacks.addHistoryLog('Cupid', `Bound in love: #${p1.seat} ${p1.name} & #${player.seat} ${player.name}`);
      }
      scheduleAutoAdvance(650, callbacks);
    } else {
      const oldLover2 = gameState.players.find(p => p.id === gameState.nightActions.cupidLover2);
      if (oldLover2) oldLover2.isLover = false;
      gameState.nightActions.cupidLover2 = playerId;
      player.isLover = true;
      soundManager.playChime();
      const p1 = gameState.players.find(p => p.id === gameState.nightActions.cupidLover1);
      if (typeof callbacks.addHistoryLog === 'function') {
        callbacks.addHistoryLog('Cupid', `Bound in love: #${p1.seat} ${p1.name} & #${player.seat} ${player.name}`);
      }
      scheduleAutoAdvance(650, callbacks);
    }

    gameState.players.forEach(p => {
      p.isLover = (p.id === gameState.nightActions.cupidLover1 || p.id === gameState.nightActions.cupidLover2);
    });

    saveAppState();
    renderNightCaller();
    renderTouchTable();
    return;
  } else if (currentStep.id === 'priest') {
    if (gameState.priestShieldTarget === playerId) {
      gameState.priestShieldTarget = null;
      cancelAutoAdvance();
      soundManager.playBeep();
      showGameToast(`✝️ Holy Shield removed from #${player.seat} ${player.name}`);
    } else {
      gameState.priestShieldTarget = playerId;
      soundManager.playChime();
      showGameToast(`✝️ Blessed #${player.seat} ${player.name} with Holy Shield!`);
      if (typeof callbacks.addHistoryLog === 'function') {
        callbacks.addHistoryLog('Holy Shield', `Priest placed Holy Shield on #${player.seat} ${player.name}`);
      }
      scheduleAutoAdvance(650, callbacks);
    }
    saveAppState();
    renderNightCaller();
    renderTouchTable();
    return;
  } else {
    openPlayerActionSheet(playerId);
  }
}

/**
 * Handles seat selection and swapping during Night 0
 */
export function handleSeatSwapTap(playerId, callbacks = {}) {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return;

  if (!uiState.selectedSwapSeatId) {
    // First seat selected
    uiState.selectedSwapSeatId = playerId;
    soundManager.playPop();
    showGameToast(`🪑 ${player.name} • Tap another to swap`, 1200);
    renderTouchTable();
    renderNightCaller();
    return;
  }

  if (uiState.selectedSwapSeatId === playerId) {
    // Tapping the same seat again cancels selection
    uiState.selectedSwapSeatId = null;
    soundManager.playBeep();
    showGameToast(`Deselected ${player.name}`, 1000);
    renderTouchTable();
    renderNightCaller();
    return;
  }

  // Second seat selected -> perform swap!
  const firstPlayerId = uiState.selectedSwapSeatId;
  swapPlayerSeats(firstPlayerId, playerId, callbacks);
}

/**
 * Swaps seats between two players and updates seat numbers (1..N)
 */
export function swapPlayerSeats(playerAId, playerBId, callbacks = {}) {
  const idxA = gameState.players.findIndex(p => p.id === playerAId);
  const idxB = gameState.players.findIndex(p => p.id === playerBId);
  if (idxA === -1 || idxB === -1) return;

  const playerA = gameState.players[idxA];
  const playerB = gameState.players[idxB];

  // Swap array elements
  gameState.players[idxA] = playerB;
  gameState.players[idxB] = playerA;

  // Re-assign seat numbers 1..N based on new array order
  gameState.players.forEach((p, idx) => {
    p.seat = idx + 1;
  });

  // Keep lobbyState players synchronized if matching length
  if (lobbyState && Array.isArray(lobbyState.players) && lobbyState.players.length === gameState.players.length) {
    lobbyState.players = gameState.players.map(p => p.name);
  }

  uiState.selectedSwapSeatId = null;
  soundManager.playChime();
  showGameToast(`🔄 ${playerA.name} ↔ ${playerB.name}`, 1200);

  if (typeof callbacks.addHistoryLog === 'function') {
    callbacks.addHistoryLog('Seating Swap', `Swapped seats between #${playerA.seat} ${playerA.name} and #${playerB.seat} ${playerB.name}`);
  }

  saveAppState();
  renderTouchTable();
  renderNightCaller();
}

/**
 * Rotates the entire table arrangement clockwise or counter-clockwise
 */
export function rotateTable(direction = 'clockwise', callbacks = {}) {
  if (!gameState.players || gameState.players.length < 2) return;

  if (direction === 'clockwise' || direction === 'cw') {
    const last = gameState.players.pop();
    gameState.players.unshift(last);
  } else {
    const first = gameState.players.shift();
    gameState.players.push(first);
  }

  gameState.players.forEach((p, idx) => {
    p.seat = idx + 1;
  });

  if (lobbyState && Array.isArray(lobbyState.players) && lobbyState.players.length === gameState.players.length) {
    lobbyState.players = gameState.players.map(p => p.name);
  }

  soundManager.playPop();
  showGameToast(direction === 'clockwise' || direction === 'cw' ? '↻ Rotated Clockwise' : '↺ Rotated Counter', 1000);

  saveAppState();
  renderTouchTable();
  renderNightCaller();
}

