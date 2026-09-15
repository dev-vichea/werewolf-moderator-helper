/**
 * Night Phase Caller & Wizard Step Controller
 */
import { gameState, lobbyState, uiState } from '../../state/store.js';
import { isRoleInGame as checkRoleInGame, getRoleTargetCount as checkRoleTargetCount } from '../../state/roles.js';
import { soundManager } from '../../audio/sound.js';
import { saveAppState } from '../../state/storage.js';
import { previewNightDeaths, getInfectedCursedPlayer } from './witch-potions.js';
import { showGameToast } from '../../ui/toast.js';

let autoAdvanceTimeout = null;

export function isRoleInGame(roleName) {
  return checkRoleInGame(roleName, gameState, lobbyState);
}

export function getRoleTargetCount(roleName) {
  return checkRoleTargetCount(roleName, lobbyState);
}

export function isStepRoleDead(step) {
  if (!step || !step.targetRole) return false;
  if (step.id === 'resolution') return false;
  const holders = gameState.players.filter(p => p.role === step.targetRole);
  return holders.length > 0 && holders.every(p => p.status === 'dead');
}

export function getActiveNightSteps() {
  const steps = [];

  // NIGHT 0: SEATING SETUP
  if (gameState.currentNight === 0) {
    steps.push({
      id: 'seating',
      name: 'Seating Setup',
      icon: '🪑',
      script: `"Moderator: Tap any two players to swap seats, or rotate the table so the screen matches your room. When ready, tap Begin Night 1."`,
      hasSkill: false,
      actionName: 'Begin Night 1 ▶',
      night0Only: true
    });
    return steps;
  }

  // 1. NIGHT 1 ONLY SPECIAL ROLES
  if (gameState.currentNight === 1) {
    // Doppelgänger (Night 1 only - chooses a player to mimic if they die)
    if (isRoleInGame('Doppelganger')) {
      steps.push({
        id: 'doppelganger',
        targetRole: 'Doppelganger',
        name: 'Doppelgänger',
        icon: '🎭',
        script: `"Doppelgänger, wake up. Look around and silently point to one player. If that player dies, you will secretly assume their role and abilities."`,
        hasSkill: true,
        actionName: 'Choose Player',
        night1Only: true
      });
    }

    // Cupid (Night 1 only)
    if (isRoleInGame('Cupid')) {
      steps.push({
        id: 'cupid',
        targetRole: 'Cupid',
        name: 'Cupid',
        icon: '🏹',
        script: `"Cupid, wake up and silently choose two lovers to bind together."`,
        hasSkill: true,
        actionName: 'Pick 2 Lovers',
        night1Only: true
      });
    }

    // Mason (Night 1 only recognition)
    if (isRoleInGame('Mason')) {
      steps.push({
        id: 'mason',
        targetRole: 'Mason',
        name: 'Masons',
        icon: '🤝',
        script: `"Masons, open your eyes and look around to recognize your fellow Mason."`,
        hasSkill: false,
        actionName: 'Recognize Each Other',
        night1Only: true
      });
    }

    // Lycan (Night 1 only recognition)
    if (isRoleInGame('Lycan')) {
      steps.push({
        id: 'lycan',
        targetRole: 'Lycan',
        name: 'Lycan',
        icon: '🐺',
        script: `"Lycan, open your eyes so the moderator knows you appear evil to the Seer."`,
        hasSkill: false,
        actionName: 'Recognize Lycan',
        night1Only: true
      });
    }

    // Hunter (Night 1 recognition only - moderator notes who holds Hunter card, or skip)
    if (isRoleInGame('Hunter')) {
      steps.push({
        id: 'hunter',
        targetRole: 'Hunter',
        name: 'Hunter',
        icon: '🏹',
        script: `"Hunter, open your eyes so the moderator knows who you are. Hunter, close your eyes."`,
        hasSkill: false,
        actionName: 'Recognize Hunter',
        night1Only: true
      });
    }

    // Cursed (Night 1 recognition only)
    if (isRoleInGame('Cursed')) {
      steps.push({
        id: 'cursed',
        targetRole: 'Cursed',
        name: 'Cursed',
        icon: '🧟',
        script: `"Cursed, open your eyes so the moderator knows who you are. Cursed, close your eyes."`,
        hasSkill: false,
        actionName: 'Recognize Cursed',
        night1Only: true
      });
    }
  }

  // 2. ACTIVE NIGHT SKILL ROLES
  // Priest (Night 1, and subsequent nights only if shield broke / not currently active)
  const priestHolders = gameState.players.filter(p => p.role === 'Priest');
  const priestAlive = (priestHolders.length === 0 || priestHolders.some(p => p.status === 'alive'));
  const shouldPriestWake = isRoleInGame('Priest') && priestAlive && (
    gameState.priestWakesTonight !== undefined
      ? Boolean(gameState.priestWakesTonight)
      : (gameState.currentNight === 1 || !gameState.priestShieldTarget)
  );

  if (shouldPriestWake) {
    steps.push({
      id: 'priest',
      targetRole: 'Priest',
      name: 'Priest',
      icon: '✝️',
      script: `"Priest, wake up and silently point to one player to place your Holy Shield upon them. Priest, close your eyes."`,
      hasSkill: true,
      actionName: 'Place Holy Shield'
    });
  }

  // Vampires wake before Werewolves (independent evil team)
  if (isRoleInGame('Vampire')) {
    steps.push({
      id: 'vampires',
      targetRole: 'Vampire',
      name: 'Vampires',
      icon: '🧛',
      script: `"Vampires, wake up! Silently choose one player as your victim tonight. Vampires, close your eyes."`,
      hasSkill: true,
      actionName: 'Choose Victim'
    });
  }

  steps.push({
    id: 'werewolves',
    targetRole: 'Werewolf',
    name: 'Werewolves',
    icon: '🐺',
    script: `"Werewolves, wake up! Silently choose your victim to eliminate tonight."`,
    hasSkill: true,
    actionName: 'Kill Victim'
  });

  if (isRoleInGame('Witch')) {
    steps.push({
      id: 'witch',
      targetRole: 'Witch',
      name: 'Witch',
      icon: '🧪',
      script: `"Witch, wake up. A victim was attacked tonight. You may use your healing potion, your poison potion, or both."`,
      hasSkill: true,
      actionName: 'Heal / Poison'
    });
  }

  if (isRoleInGame('Seer')) {
    steps.push({
      id: 'seer',
      targetRole: 'Seer',
      name: 'Seer',
      icon: '🔮',
      script: `"Seer, open your eyes. Whose identity do you want to inspect?"`,
      hasSkill: true,
      actionName: 'Inspect Player'
    });
  }

  // Sorceress wakes after Seer (wolf-aligned spy — searches for Seer)
  if (isRoleInGame('Sorceress')) {
    steps.push({
      id: 'sorceress',
      targetRole: 'Sorceress',
      name: 'Sorceress',
      icon: '🔮',
      script: `"Sorceress, wake up. Silently point to one player. The moderator will signal whether they are the Seer."`,
      hasSkill: true,
      actionName: 'Check for Seer'
    });
  }

  if (isRoleInGame('Bodyguard')) {
    steps.push({
      id: 'bodyguard',
      targetRole: 'Bodyguard',
      name: 'Bodyguard',
      icon: '🛡️',
      script: `"Bodyguard, wake up. Who do you want to protect tonight?"`,
      hasSkill: true,
      actionName: 'Protect Target'
    });
  }

  if (isRoleInGame('Spellcaster')) {
    steps.push({
      id: 'spellcaster',
      targetRole: 'Spellcaster',
      name: 'Spellcaster',
      icon: '✨',
      script: `"Spellcaster, wake up. Who do you want to silence tomorrow?"`,
      hasSkill: true,
      actionName: 'Silence Target'
    });
  }

  // 3. SUNRISE (RESOLUTION)
  steps.push({
    id: 'resolution',
    name: 'Sunrise',
    icon: '🌅',
    script: `"Night ends. Announce morning casualties and start day discussion."`,
    hasSkill: false
  });

  return steps;
}

export function setCallerSubMode(mode, callbacks = {}) {
  uiState.callerSubMode = mode;
  uiState.userExplicitRoleMode = (mode === 'role');
  soundManager.playBeep();
  renderNightCaller();
  if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
}

export function syncCallerSubMode() {
  if (gameState.phase !== 'NIGHT') return;
  const steps = getActiveNightSteps();
  if (!steps || steps.length === 0) return;
  const step = steps[gameState.wizardStepIndex] || steps[0];
  if (!step) return;

  if (gameState.currentNight === 0) {
    uiState.callerSubMode = 'seatSwap';
    return;
  }

  if (isStepRoleDead(step)) {
    uiState.callerSubMode = 'dead';
    return;
  }

  if (gameState.currentNight >= 2) {
    uiState.callerSubMode = 'target';
    return;
  }

  if (!step.hasSkill) {
    uiState.callerSubMode = 'role';
    return;
  }

  if (step.targetRole) {
    const holders = gameState.players.filter(p => p.role === step.targetRole);
    const targetCount = getRoleTargetCount(step.targetRole);
    if (holders.length === 0) {
      uiState.callerSubMode = 'role';
      return;
    }
    if (holders.length >= targetCount && targetCount > 0 && !uiState.userExplicitRoleMode) {
      uiState.callerSubMode = 'target';
    }
  }
}

export function renderNightCaller(callbacks = {}) {
  if (gameState.phase !== 'NIGHT') return;
  const cb = (callbacks && Object.keys(callbacks).length > 0) ? callbacks : (globalThis.appCallbacks || {});

  if (gameState.priestWakesTonight === undefined) {
    gameState.priestWakesTonight = (gameState.currentNight === 1 || !gameState.priestShieldTarget);
  }

  syncCallerSubMode();

  const steps = getActiveNightSteps();
  if (gameState.wizardStepIndex >= steps.length) gameState.wizardStepIndex = steps.length - 1;
  const step = steps[gameState.wizardStepIndex];
  if (!step) return;

  const roleIconEl = document.getElementById('caller-role-icon');
  const roleNameEl = document.getElementById('caller-role-name');
  const spokenTextEl = document.getElementById('caller-spoken-text');
  const dotsEl = document.getElementById('caller-step-dots');
  const modePillsEl = document.getElementById('caller-mode-pills');
  const targetBadge = document.getElementById('caller-target-badge');
  const targetName = document.getElementById('caller-target-name');
  const instructionText = document.getElementById('caller-instruction-text');
  const witchControls = document.getElementById('caller-witch-controls');
  const resolveBtn = document.getElementById('caller-resolve-btn');
  const nextBtn = document.getElementById('caller-next-btn');
  const prevBtn = document.getElementById('caller-prev-btn');

  if (roleIconEl) roleIconEl.textContent = step.icon;
  if (roleNameEl) roleNameEl.textContent = `${step.name} (${gameState.wizardStepIndex + 1}/${steps.length})`;
  if (spokenTextEl) spokenTextEl.textContent = step.script;

  if (dotsEl) {
    dotsEl.innerHTML = steps.map((s, idx) => `
      <span style="width: 8px; height: 8px; border-radius: 50%; background: ${idx === gameState.wizardStepIndex ? '#a855f7' : (idx < gameState.wizardStepIndex ? '#10b981' : 'rgba(255,255,255,0.2)')};"></span>
    `).join('');
  }

  if (witchControls) witchControls.style.display = 'none';
  if (targetBadge) targetBadge.style.display = 'none';
  if (resolveBtn) resolveBtn.style.display = 'none';
  if (nextBtn) {
    nextBtn.style.display = 'inline-flex';
    nextBtn.className = 'btn btn-primary caller-mini-btn';
    nextBtn.style.background = '';
    nextBtn.style.borderColor = '';
    nextBtn.style.color = '';
    nextBtn.textContent = 'Next ▶';
    nextBtn.onclick = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      cancelAutoAdvance();
      nextWizardStep(cb);
    };
  }
  if (prevBtn) {
    prevBtn.style.display = 'inline-flex';
    prevBtn.disabled = (gameState.wizardStepIndex === 0);
    prevBtn.onclick = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      cancelAutoAdvance();
      prevWizardStep(cb);
    };
  }

  // Night 0 Seating Step
  if (step.id === 'seating') {
    if (roleNameEl) roleNameEl.textContent = '🪑 Seating Setup';
    if (dotsEl) dotsEl.innerHTML = '<span style="width: 10px; height: 10px; border-radius: 50%; background: #38bdf8; display: inline-block;"></span>';
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) {
      nextBtn.style.display = 'inline-flex';
      nextBtn.className = 'btn btn-primary caller-mini-btn';
      nextBtn.style.background = '#10b981';
      nextBtn.style.borderColor = '#059669';
      nextBtn.style.color = '#ffffff';
      nextBtn.style.fontWeight = '800';
      nextBtn.textContent = '🌙 Begin Night 1 ▶';
      nextBtn.onclick = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        startNight1FromNight0(cb);
      };
    }
    const selectedP = uiState.selectedSwapSeatId ? gameState.players.find(p => p.id === uiState.selectedSwapSeatId) : null;
    if (modePillsEl) {
      modePillsEl.innerHTML = `
        <button class="caller-mode-btn ${selectedP ? 'active' : ''}" style="font-weight: 700;">
          ${selectedP ? `🔄 Selected: #${selectedP.seat} ${selectedP.name} (Tap another player to swap)` : `👉 Tap any 2 players to swap seats`}
        </button>
        <button class="caller-mode-btn" style="border-color: rgba(192, 132, 252, 0.6); color: #c084fc; font-weight: 800;" onclick="randomizeAllRoles(true)">
          🎲 Random Roles to All
        </button>
        <button class="caller-mode-btn" style="border-color: rgba(56, 189, 248, 0.5); color: #38bdf8;" onclick="rotateTable('clockwise')">
          ↻ Rotate Clockwise
        </button>
        <button class="caller-mode-btn" style="border-color: rgba(56, 189, 248, 0.5); color: #38bdf8;" onclick="rotateTable('counterclockwise')">
          ↺ Rotate Counter
        </button>
      `;
    }
    if (instructionText) {
      instructionText.style.display = 'block';
      if (selectedP) {
        instructionText.innerHTML = `<span>🔄</span> <strong>Selected #${selectedP.seat} ${selectedP.name}. Tap another player to swap positions! (Tap #${selectedP.seat} again to cancel)</strong>`;
      } else {
        instructionText.innerHTML = `<span>🪑</span> <strong>Night 0: Tap any two players to swap seats so the screen matches your room. Tap 'Begin Night 1' when done.</strong>`;
      }
    }
    return;
  }

  // Sunrise Resolution Step
  if (step.id === 'resolution') {
    const deaths = previewNightDeaths();
    const infectedCursed = getInfectedCursedPlayer();

    // Compute vampire mark (who the vampires chose — dies at end of day, not now)
    let vampireMarkedDesc = '';
    if (gameState.nightActions.vampireTarget) {
      const vampTarget = gameState.players.find(p => p.id === gameState.nightActions.vampireTarget);
      if (vampTarget && vampTarget.status === 'alive') {
        const savedByGuard = (gameState.nightActions.bodyguardTarget === vampTarget.id);
        const savedByPriest = (gameState.priestShieldTarget === vampTarget.id);
        if (!savedByGuard && !savedByPriest) {
          vampireMarkedDesc = `🧛 ${vampTarget.name} (Marked — dies at nightfall)`;
        }
      }
    }

    let summary = deaths.length > 0 ? deaths.map(d => `${d.name} (${d.reason})`).join(', ') : 'Nobody died!';
    if (infectedCursed && !deaths.some(d => d.id === infectedCursed.id)) {
      summary += ` • 🐺 #${infectedCursed.seat} ${infectedCursed.name} turns Werewolf!`;
    }
    if (vampireMarkedDesc) {
      summary += (deaths.length > 0 || infectedCursed) ? ` • ${vampireMarkedDesc}` : vampireMarkedDesc;
    }

    const hasEvent = deaths.length > 0 || infectedCursed || vampireMarkedDesc;
    if (modePillsEl) {
      const pillBg = deaths.length > 0 ? 'rgba(239,68,68,0.25)' : (infectedCursed ? 'rgba(168,85,247,0.25)' : (vampireMarkedDesc ? 'rgba(220,38,38,0.18)' : 'rgba(16,185,129,0.25)'));
      const pillBorder = deaths.length > 0 ? '#f87171' : (infectedCursed ? '#c084fc' : (vampireMarkedDesc ? '#dc2626' : '#34d399'));
      modePillsEl.innerHTML = `<span class="caller-mode-btn active" style="cursor: default; background: ${pillBg}; border-color: ${pillBorder}; color: white;">☀️ Morning Report: <strong>${summary}</strong></span>`;
    }
    if (instructionText) {
      const textColor = deaths.length > 0 ? '#f87171' : (infectedCursed ? '#c084fc' : (vampireMarkedDesc ? '#fca5a5' : '#4ade80'));
      instructionText.innerHTML = `Morning Report: <strong style="color: ${textColor}; margin-left: 0.3rem;">${summary}</strong>`;
    }
    if (nextBtn) nextBtn.style.display = 'none';
    if (resolveBtn) {
      resolveBtn.style.display = 'inline-flex';
      resolveBtn.onclick = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const resolveFn = typeof callbacks.resolveNightAndStartDay === 'function'
          ? callbacks.resolveNightAndStartDay
          : (typeof globalThis.resolveNightAndStartDay === 'function' ? globalThis.resolveNightAndStartDay : null);
        if (resolveFn) resolveFn(callbacks);
      };
    }
    return;
  }

  // Deceased Role Step: Called aloud to conceal death from players, but cannot take actions
  const isDeadRole = isStepRoleDead(step);
  if (isDeadRole) {
    if (roleNameEl) {
      roleNameEl.innerHTML = `${step.name} (${gameState.wizardStepIndex + 1}/${steps.length}) <span class="caller-dead-pill">💀 DEAD</span>`;
    }
    if (modePillsEl) {
      modePillsEl.innerHTML = `
        <span class="caller-mode-btn active" style="cursor: default; background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.5); color: #fca5a5;">
          💀 ${step.targetRole} is Dead • Fake Call (No Action)
        </span>
      `;
    }
    if (instructionText) {
      instructionText.style.display = 'block';
      instructionText.innerHTML = `💀 <strong>${step.targetRole} is dead.</strong> Call aloud to keep death secret, then tap <strong>Next ▶</strong>.`;
    }
    if (targetBadge) targetBadge.style.display = 'none';
    if (witchControls) witchControls.style.display = 'none';
    if (resolveBtn) resolveBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'inline-flex';
    return;
  }

  const holders = gameState.players.filter(p => p.role === step.targetRole);

  // Night 1 Recognition-only steps (Masons, Lycan, Hunter)
  if (!step.hasSkill) {
    uiState.callerSubMode = 'role';
    const isHunter = (step.id === 'hunter');
    if (modePillsEl) {
      modePillsEl.innerHTML = `
        <button class="caller-mode-btn active" style="cursor: default;">
          ${step.icon} Set ${step.targetRole} (${holders.length} set) - Eye Contact Only
        </button>
        ${isHunter ? `<button class="btn btn-outline" style="font-size: 0.72rem; padding: 0.2rem 0.6rem; margin-left: 0.5rem; border-color: rgba(255,255,255,0.25);" onclick="nextWizardStep()">⏭️ Skip / Don't Call</button>` : ''}
      `;
    }
    if (instructionText) {
      instructionText.innerHTML = `<span>👉</span> <strong>Tap players who opened their eyes as ${step.targetRole}${isHunter ? ' (or skip)' : ''}</strong>`;
    }
    if (targetBadge && targetName) {
      targetBadge.style.display = 'inline-flex';
      targetBadge.style.backgroundColor = 'rgba(168, 85, 247, 0.2)';
      targetBadge.style.borderColor = 'rgba(168, 85, 247, 0.4)';
      targetBadge.style.color = '#c084fc';
      targetName.textContent = `${holders.length} ${step.targetRole}(s)`;
    }
    return;
  }

  // Active Skill Steps
  let currentTargetDesc = 'None';
  let targetColor = '#c084fc';
  let targetBg = 'rgba(168, 85, 247, 0.2)';
  let targetBorder = 'rgba(168, 85, 247, 0.4)';

  if (step.id === 'werewolves') {
    if (gameState.nightActions.wolfTarget) {
      const p = gameState.players.find(x => x.id === gameState.nightActions.wolfTarget);
      currentTargetDesc = p ? `#${p.seat} ${p.name}` : 'None';
      targetColor = '#f87171';
      targetBg = 'rgba(239, 68, 68, 0.2)';
      targetBorder = 'rgba(239, 68, 68, 0.4)';
    }
  } else if (step.id === 'bodyguard') {
    if (gameState.nightActions.bodyguardTarget) {
      const p = gameState.players.find(x => x.id === gameState.nightActions.bodyguardTarget);
      currentTargetDesc = p ? `#${p.seat} ${p.name}` : 'None';
      targetColor = '#fbbf24';
      targetBg = 'rgba(245, 158, 11, 0.2)';
      targetBorder = 'rgba(245, 158, 11, 0.4)';
    }
  } else if (step.id === 'spellcaster') {
    if (gameState.nightActions.spellcasterTarget) {
      const p = gameState.players.find(x => x.id === gameState.nightActions.spellcasterTarget);
      currentTargetDesc = p ? `🤐 #${p.seat} ${p.name}` : 'None';
      targetColor = '#c084fc';
      targetBg = 'rgba(139, 92, 246, 0.2)';
      targetBorder = 'rgba(139, 92, 246, 0.4)';
    }
  } else if (step.id === 'seer') {
    if (gameState.nightActions.seerTarget) {
      const p = gameState.players.find(x => x.id === gameState.nightActions.seerTarget);
      if (p) {
        const isWerewolf = (p.role === 'Werewolf' || p.role === 'Lycan');
        currentTargetDesc = isWerewolf ? `🟢 #${p.seat} ${p.name} (Werewolf)` : `🔴 #${p.seat} ${p.name} (Not Wolf)`;
        targetColor = isWerewolf ? '#34d399' : '#f87171';
        targetBg = isWerewolf ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
        targetBorder = isWerewolf ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
      }
    }
  } else if (step.id === 'witch') {
    const victim = gameState.players.find(x => x.id === gameState.nightActions.wolfTarget);
    const healed = gameState.nightActions.witchHealed;
    const poisonTarget = gameState.players.find(x => x.id === gameState.nightActions.witchPoisonTarget);
    const hasAnyPotions = Boolean(
      (gameState.potions.witchHealAvailable || healed) ||
      (gameState.potions.witchPoisonAvailable || poisonTarget)
    );

    if (!hasAnyPotions) {
      currentTargetDesc = 'No Potions Left';
      targetColor = '#94a3b8';
      targetBg = 'rgba(148, 163, 184, 0.15)';
      targetBorder = 'rgba(148, 163, 184, 0.3)';
    } else if (healed && poisonTarget) {
      currentTargetDesc = `💚 #${victim ? victim.seat : '?'} & ☠️ #${poisonTarget.seat}`;
      targetColor = '#34d399';
      targetBg = 'rgba(16, 185, 129, 0.2)';
      targetBorder = 'rgba(16, 185, 129, 0.4)';
    } else if (healed) {
      currentTargetDesc = `💚 Saved #${victim ? victim.seat : '?'}`;
      targetColor = '#34d399';
      targetBg = 'rgba(16, 185, 129, 0.2)';
      targetBorder = 'rgba(16, 185, 129, 0.4)';
    } else if (poisonTarget) {
      currentTargetDesc = `☠️ Poison #${poisonTarget.seat}`;
      targetColor = '#f87171';
      targetBg = 'rgba(239, 68, 68, 0.2)';
      targetBorder = 'rgba(239, 68, 68, 0.4)';
    } else {
      currentTargetDesc = victim ? `#${victim.seat} ${victim.name}` : 'Nobody';
    }
  } else if (step.id === 'vampires') {
    if (gameState.nightActions.vampireTarget) {
      const p = gameState.players.find(x => x.id === gameState.nightActions.vampireTarget);
      currentTargetDesc = p ? `#${p.seat} ${p.name}` : 'None';
      targetColor = '#dc2626';
      targetBg = 'rgba(220, 38, 38, 0.2)';
      targetBorder = 'rgba(220, 38, 38, 0.45)';
    }
  } else if (step.id === 'sorceress') {
    if (gameState.nightActions.sorceressTarget) {
      const p = gameState.players.find(x => x.id === gameState.nightActions.sorceressTarget);
      if (p) {
        const isSeer = (p.role === 'Seer');
        currentTargetDesc = isSeer ? `✅ #${p.seat} ${p.name} (IS the Seer!)` : `❌ #${p.seat} ${p.name} (Not Seer)`;
        targetColor = isSeer ? '#34d399' : '#f87171';
        targetBg = isSeer ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
        targetBorder = isSeer ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
      }
    }
  } else if (step.id === 'doppelganger') {
    if (gameState.nightActions.doppelgangerTarget) {
      const p = gameState.players.find(x => x.id === gameState.nightActions.doppelgangerTarget);
      currentTargetDesc = p ? `#${p.seat} ${p.name}` : 'None';
      targetColor = '#ec4899';
      targetBg = 'rgba(236, 72, 153, 0.2)';
      targetBorder = 'rgba(236, 72, 153, 0.4)';
    }
  } else if (step.id === 'priest') {
    if (gameState.priestShieldTarget) {
      const p = gameState.players.find(x => x.id === gameState.priestShieldTarget);
      currentTargetDesc = p ? `✝️ #${p.seat} ${p.name}` : 'None';
      targetColor = '#38bdf8';
      targetBg = 'rgba(56, 189, 248, 0.2)';
      targetBorder = 'rgba(56, 189, 248, 0.4)';
    }
  } else if (step.id === 'cupid') {
    const l1 = gameState.players.find(x => x.id === gameState.nightActions.cupidLover1);
    const l2 = gameState.players.find(x => x.id === gameState.nightActions.cupidLover2);
    currentTargetDesc = (l1 && l2) ? `${l1.name} & ${l2.name}` : (l1 ? `${l1.name} & ?` : 'None');
  }

  // Mode Pills in Caller Box
  if (modePillsEl) {
    if (gameState.currentNight >= 2) {
      uiState.callerSubMode = 'target';
      modePillsEl.innerHTML = `
        <button class="caller-mode-btn active" style="cursor: default;">
          🎯 ${step.actionName}: <strong>${currentTargetDesc}</strong>
        </button>
      `;
    } else {
      modePillsEl.innerHTML = `
        <button class="caller-mode-btn ${uiState.callerSubMode === 'role' ? 'active' : ''}" onclick="setCallerSubMode('role')">
          ${step.icon} 1. Set ${step.targetRole} (${holders.length} set)
        </button>
        <button class="caller-mode-btn ${uiState.callerSubMode === 'target' ? 'active' : ''}" onclick="setCallerSubMode('target')">
          🎯 2. ${step.actionName}: <strong>${currentTargetDesc}</strong>
        </button>
      `;
    }
  }

  if (uiState.callerSubMode === 'role') {
    if (instructionText) {
      instructionText.innerHTML = `<span>👉</span> <strong>Tap players on table who opened their eyes as ${step.targetRole}</strong>`;
    }
    if (targetBadge && targetName) {
      targetBadge.style.display = 'inline-flex';
      targetBadge.style.backgroundColor = 'rgba(168, 85, 247, 0.2)';
      targetBadge.style.borderColor = 'rgba(168, 85, 247, 0.4)';
      targetBadge.style.color = '#c084fc';
      targetName.textContent = `${holders.length} ${step.targetRole}(s) set`;
    }
  } else {
    if (step.id === 'werewolves') {
      if (instructionText) instructionText.innerHTML = `<span>🐺</span> <strong>Ask Werewolves: "Who do you want to kill?" (Tap victim on table)</strong>`;
      if (currentTargetDesc !== 'None' && targetBadge && targetName) {
        targetBadge.style.display = 'inline-flex';
        targetBadge.style.backgroundColor = targetBg;
        targetBadge.style.borderColor = targetBorder;
        targetBadge.style.color = targetColor;
        targetName.textContent = currentTargetDesc;
      }
    } else if (step.id === 'bodyguard') {
      if (instructionText) instructionText.innerHTML = `<span>🛡️</span> <strong>Ask Bodyguard: "Who do you want to shield tonight?" (Tap target on table)</strong>`;
      if (currentTargetDesc !== 'None' && targetBadge && targetName) {
        targetBadge.style.display = 'inline-flex';
        targetBadge.style.backgroundColor = targetBg;
        targetBadge.style.borderColor = targetBorder;
        targetBadge.style.color = targetColor;
        targetName.textContent = currentTargetDesc;
      }
    } else if (step.id === 'spellcaster') {
      if (instructionText) instructionText.innerHTML = `<span>🤐</span> <strong>Ask Spellcaster: "Who do you want to silence tomorrow?" (Tap target on table)</strong>`;
      if (currentTargetDesc !== 'None' && targetBadge && targetName) {
        targetBadge.style.display = 'inline-flex';
        targetBadge.style.backgroundColor = targetBg;
        targetBadge.style.borderColor = targetBorder;
        targetBadge.style.color = targetColor;
        targetName.textContent = currentTargetDesc;
      }
    } else if (step.id === 'seer') {
      if (instructionText) instructionText.innerHTML = `<span>🔮</span> <strong>Ask Seer: "Whose identity do you want to inspect?" (Tap player on table)</strong>`;
      if (currentTargetDesc !== 'None' && targetBadge && targetName) {
        targetBadge.style.display = 'inline-flex';
        targetBadge.style.backgroundColor = targetBg;
        targetBadge.style.borderColor = targetBorder;
        targetBadge.style.color = targetColor;
        targetName.textContent = currentTargetDesc;
      }
    } else if (step.id === 'witch') {
      const victim = gameState.players.find(x => x.id === gameState.nightActions.wolfTarget);
      const victimName = victim ? `#${victim.seat} ${victim.name}` : 'Nobody';

      const healAvail = gameState.potions.witchHealAvailable;
      const poisonAvail = gameState.potions.witchPoisonAvailable;
      const alreadyHealed = Boolean(gameState.nightActions.witchHealed);
      const alreadyPoisoned = Boolean(gameState.nightActions.witchPoisonTarget);
      const hasAnyPotions = Boolean((healAvail || alreadyHealed) || (poisonAvail || alreadyPoisoned));

      if (witchControls) witchControls.style.display = hasAnyPotions ? 'flex' : 'none';

      if (instructionText) {
        if (!hasAnyPotions) {
          instructionText.innerHTML = `<span>🧪</span> <strong>Witch has no potions remaining. (Tap Center Hub or Next ▶ to continue)</strong>`;
        } else if (alreadyHealed && alreadyPoisoned) {
          const poisonedP = gameState.players.find(p => p.id === gameState.nightActions.witchPoisonTarget);
          instructionText.innerHTML = `💚 <strong>Saved: ${victimName}</strong> &nbsp;|&nbsp; ☠️ <strong>Poisoned: #${poisonedP ? poisonedP.seat + ' ' + poisonedP.name : 'Player'}</strong>`;
        } else if (alreadyHealed) {
          instructionText.innerHTML = `💚 <strong>Saved: ${victimName}</strong> <span style="color: #94a3b8; font-size: 0.85em;">(Poison potion ready to use)</span>`;
        } else if (alreadyPoisoned) {
          const poisonedP = gameState.players.find(p => p.id === gameState.nightActions.witchPoisonTarget);
          instructionText.innerHTML = `☠️ <strong>Poisoned: #${poisonedP ? poisonedP.seat + ' ' + poisonedP.name : 'Player'}</strong> <span style="color: #94a3b8; font-size: 0.85em;">(Heal potion ready to use)</span>`;
        } else {
          instructionText.innerHTML = `Attacked victim: <strong style="color: ${victim ? '#f87171' : '#4ade80'}; margin-left: 0.25rem;">${victimName}</strong> <span style="color: #94a3b8; font-size: 0.85em;">(Can use both potions)</span>`;
        }
      }

      const healBtn = document.getElementById('witch-heal-btn');
      const poisonBtn = document.getElementById('witch-poison-btn');

      if (healBtn) {
        if (alreadyHealed) {
          healBtn.className = 'btn btn-success';
          healBtn.textContent = '💚 Saved Victim (Cancel)';
          healBtn.disabled = false;
        } else if (!healAvail) {
          healBtn.className = 'btn btn-outline';
          healBtn.textContent = '💚 Heal (Used)';
          healBtn.disabled = true;
        } else if (!victim) {
          healBtn.className = 'btn btn-outline';
          healBtn.textContent = '💚 Heal (No Victim)';
          healBtn.disabled = false;
        } else {
          healBtn.className = 'btn btn-outline btn-success';
          healBtn.textContent = '💚 Heal Victim';
          healBtn.disabled = false;
        }
      }

      if (poisonBtn) {
        if (alreadyPoisoned) {
          const p = gameState.players.find(x => x.id === gameState.nightActions.witchPoisonTarget);
          poisonBtn.className = 'btn btn-danger';
          poisonBtn.textContent = `☠️ Poison: ${p ? p.name : 'Target'} (Cancel)`;
          poisonBtn.disabled = false;
        } else if (!poisonAvail) {
          poisonBtn.className = 'btn btn-outline';
          poisonBtn.textContent = '🧪 Poison (Used)';
          poisonBtn.disabled = true;
        } else {
          poisonBtn.className = uiState.witchSelectionMode === 'poison' ? 'btn btn-danger' : 'btn btn-outline btn-danger';
          poisonBtn.textContent = uiState.witchSelectionMode === 'poison' ? '👉 Tap target on table' : '🧪 Poison Player';
          poisonBtn.disabled = false;
        }
      }
    } else if (step.id === 'vampires') {
      if (instructionText) instructionText.innerHTML = `<span>🧛</span> <strong>Ask Vampires: "Who do you want to kill tonight?" (Tap victim on table — cannot target another Vampire)</strong>`;
      if (currentTargetDesc !== 'None' && targetBadge && targetName) {
        targetBadge.style.display = 'inline-flex';
        targetBadge.style.backgroundColor = targetBg;
        targetBadge.style.borderColor = targetBorder;
        targetBadge.style.color = targetColor;
        targetName.textContent = currentTargetDesc;
      }
    } else if (step.id === 'sorceress') {
      const sorceressTarget = gameState.nightActions.sorceressTarget
        ? gameState.players.find(x => x.id === gameState.nightActions.sorceressTarget)
        : null;
      const isSeer = sorceressTarget && (sorceressTarget.role === 'Seer');
      if (instructionText) {
        if (sorceressTarget) {
          instructionText.innerHTML = isSeer
            ? `✅ <strong>#${sorceressTarget.seat} ${sorceressTarget.name} IS the Seer!</strong> <span style="color: #94a3b8; font-size: 0.85em;">(Nod yes privately to Sorceress)</span>`
            : `❌ <strong>#${sorceressTarget.seat} ${sorceressTarget.name} is NOT the Seer.</strong> <span style="color: #94a3b8; font-size: 0.85em;">(Shake head no to Sorceress)</span>`;
        } else {
          instructionText.innerHTML = `<span>🔮</span> <strong>Ask Sorceress: "Point to the player you want to check." (Tap player on table)</strong>`;
        }
      }
      if (currentTargetDesc !== 'None' && targetBadge && targetName) {
        targetBadge.style.display = 'inline-flex';
        targetBadge.style.backgroundColor = targetBg;
        targetBadge.style.borderColor = targetBorder;
        targetBadge.style.color = targetColor;
        targetName.textContent = currentTargetDesc;
      }
    } else if (step.id === 'doppelganger') {
      if (instructionText) instructionText.innerHTML = `<span>🎭</span> <strong>Doppelgänger: Tap a living player on the table to secretly copy if they die:</strong>`;
      if (currentTargetDesc !== 'None' && targetBadge && targetName) {
        targetBadge.style.display = 'inline-flex';
        targetBadge.style.backgroundColor = targetBg;
        targetBadge.style.borderColor = targetBorder;
        targetBadge.style.color = targetColor;
        targetName.textContent = currentTargetDesc;
      }
    } else if (step.id === 'priest') {
      if (instructionText) instructionText.innerHTML = `<span>✝️</span> <strong>Ask Priest: "Who do you want to place the Holy Shield on?" (Tap player on table)</strong>`;
      if (currentTargetDesc !== 'None' && targetBadge && targetName) {
        targetBadge.style.display = 'inline-flex';
        targetBadge.style.backgroundColor = targetBg;
        targetBadge.style.borderColor = targetBorder;
        targetBadge.style.color = targetColor;
        targetName.textContent = currentTargetDesc;
      }
    } else if (step.id === 'cupid') {
      if (instructionText) instructionText.innerHTML = `<span>🏹</span> <strong>Tap Lover 1, then Lover 2 on table</strong>`;
      if (currentTargetDesc !== 'None' && targetBadge && targetName) {
        targetBadge.style.display = 'inline-flex';
        targetBadge.style.backgroundColor = targetBg;
        targetBadge.style.borderColor = targetBorder;
        targetBadge.style.color = targetColor;
        targetName.textContent = currentTargetDesc;
      }
    }
  }
}

export function cancelAutoAdvance() {
  if (autoAdvanceTimeout) {
    clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = null;
  }
  const nextBtn = document.getElementById('caller-next-btn');
  if (nextBtn) {
    nextBtn.classList.remove('auto-advancing');
  }
}

export function scheduleAutoAdvance(delayMs = 600, callbacks = {}) {
  cancelAutoAdvance();
  const nextBtn = document.getElementById('caller-next-btn');
  if (nextBtn) {
    nextBtn.classList.add('auto-advancing');
  }
  const cb = (callbacks && Object.keys(callbacks).length > 0) ? callbacks : (globalThis.appCallbacks || {});
  autoAdvanceTimeout = setTimeout(() => {
    cancelAutoAdvance();
    nextWizardStep(cb);
  }, delayMs);
}

export function startNight1FromNight0(callbacks = {}) {
  const cb = (callbacks && Object.keys(callbacks).length > 0) ? callbacks : (globalThis.appCallbacks || {});
  gameState.currentNight = 1;
  gameState.wizardStepIndex = 0;
  gameState.priestWakesTonight = true;
  uiState.callerSubMode = 'role';
  uiState.selectedSwapSeatId = null;
  soundManager.playGong();
  showGameToast('🌙 Night 1 has begun');
  if (typeof cb.addHistoryLog === 'function') {
    cb.addHistoryLog('Night 1', 'Seating setup finalized. Night 1 started.');
  }
  saveAppState();
  if (typeof cb.renderGameScreen === 'function') cb.renderGameScreen();
  else if (typeof globalThis.renderGameScreen === 'function') globalThis.renderGameScreen();
  if (typeof cb.renderNightCaller === 'function') cb.renderNightCaller(cb);
  else if (typeof globalThis.renderNightCaller === 'function') globalThis.renderNightCaller();
  if (typeof cb.renderTouchTable === 'function') cb.renderTouchTable();
  else if (typeof globalThis.renderTouchTable === 'function') globalThis.renderTouchTable();
}

export function nextWizardStep(callbacks = {}) {
  cancelAutoAdvance();
  uiState.witchSelectionMode = null;
  uiState.userExplicitRoleMode = false;

  const cb = (callbacks && Object.keys(callbacks).length > 0) ? callbacks : (globalThis.appCallbacks || {});

  if (gameState.currentNight === 0) {
    startNight1FromNight0(cb);
    return;
  }

  const steps = getActiveNightSteps();

  if (gameState.wizardStepIndex < steps.length - 1) {
    gameState.wizardStepIndex++;
    const nextStep = steps[gameState.wizardStepIndex];
    if (nextStep && nextStep.targetRole) {
      const holders = gameState.players.filter(p => p.role === nextStep.targetRole);
      const targetCount = getRoleTargetCount(nextStep.targetRole);
      uiState.callerSubMode = (nextStep.hasSkill && (holders.length >= targetCount || gameState.currentNight >= 2)) ? 'target' : 'role';
    }
    soundManager.playBeep();
    saveAppState();
    renderNightCaller(cb);
    const renderTableFn = typeof cb.renderTouchTable === 'function' ? cb.renderTouchTable : (typeof globalThis.renderTouchTable === 'function' ? globalThis.renderTouchTable : null);
    if (renderTableFn) renderTableFn();
  }
}

export function prevWizardStep(callbacks = {}) {
  cancelAutoAdvance();
  uiState.witchSelectionMode = null;
  uiState.userExplicitRoleMode = false;

  const cb = (callbacks && Object.keys(callbacks).length > 0) ? callbacks : (globalThis.appCallbacks || {});

  if (gameState.wizardStepIndex > 0) {
    gameState.wizardStepIndex--;
    const prevStep = getActiveNightSteps()[gameState.wizardStepIndex];
    if (prevStep && prevStep.targetRole) {
      const holders = gameState.players.filter(p => p.role === prevStep.targetRole);
      const targetCount = getRoleTargetCount(prevStep.targetRole);
      uiState.callerSubMode = (prevStep.hasSkill && (holders.length >= targetCount || gameState.currentNight >= 2)) ? 'target' : 'role';
    }
    soundManager.playBeep();
    saveAppState();
    renderNightCaller(cb);
    const renderTableFn = typeof cb.renderTouchTable === 'function' ? cb.renderTouchTable : (typeof globalThis.renderTouchTable === 'function' ? globalThis.renderTouchTable : null);
    if (renderTableFn) renderTableFn();
  }
}
