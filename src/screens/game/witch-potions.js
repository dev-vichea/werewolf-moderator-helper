/**
 * Witch 2-Potion Middle of Table Interactive Logic & State Handlers
 */
import { gameState, uiState } from '../../state/store.js';
import { soundManager } from '../../audio/sound.js';
import { saveAppState } from '../../state/storage.js';
import { showCustomAlert, showCustomConfirm } from '../../ui/dialog.js';
import { showGameToast } from '../../ui/toast.js';

export function handleWitchPotionBtnTap(type, event, callbacks = {}) {
  if (event && event.stopPropagation) event.stopPropagation();
  soundManager.playBeep();

  const witchHolders = gameState.players.filter(p => p.role === 'Witch');
  const isWitchDead = (witchHolders.length > 0 && witchHolders.every(p => p.status === 'dead'));
  if (isWitchDead) {
    showGameToast('💀 The Witch is dead! Cannot use potions.');
    return;
  }

  if (type === 'heal') {
    // 1. Check if Heal potion was already used in an earlier night
    if (!gameState.potions.witchHealAvailable && !gameState.nightActions.witchHealed) {
      showCustomAlert('⚠️ The Healing Potion has already been used in this game!\n\nThe Witch can only use her healing potion once per game.', {
        title: 'Heal Depleted',
        icon: '💚',
        confirmText: 'Got It',
        confirmClass: 'btn-warning'
      });
      return;
    }

    // 2. Toggle off if already healed tonight
    if (gameState.nightActions.witchHealed) {
      gameState.nightActions.witchHealed = false;
      gameState.nightActions.witchHealTarget = null;
      uiState.witchSelectionMode = null;
      const cancelFn = typeof callbacks.cancelAutoAdvance === 'function' ? callbacks.cancelAutoAdvance : (typeof globalThis.cancelAutoAdvance === 'function' ? globalThis.cancelAutoAdvance : null);
      if (cancelFn) cancelFn();
      showGameToast('💚 Healing potion cancelled.');
      saveAppState();
      if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller(callbacks);
      else if (typeof globalThis.renderNightCaller === 'function') globalThis.renderNightCaller();
      if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
      else if (typeof globalThis.renderTouchTable === 'function') globalThis.renderTouchTable();
      return;
    }

    // 3. Enforce: Heal strictly means heal who wolves killed
    const wolfVictim = gameState.players.find(p => p.id === gameState.nightActions.wolfTarget && p.status === 'alive');
    if (!wolfVictim) {
      showCustomAlert('💚 Nobody was attacked by the Werewolves tonight!\n\nThe Healing Potion can only be used to save the player attacked by Werewolves.', {
        title: 'No Wolf Victim',
        icon: '💚',
        confirmText: 'Got It',
        confirmClass: 'btn-primary'
      });
      return;
    }

    // Save the wolf victim directly!
    gameState.nightActions.witchHealed = true;
    gameState.nightActions.witchHealTarget = wolfVictim.id;
    uiState.witchSelectionMode = null;
    soundManager.playChime();
    showGameToast(`💚 #${wolfVictim.seat} ${wolfVictim.name} was saved from Werewolves!`);
    saveAppState();
    if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller(callbacks);
    else if (typeof globalThis.renderNightCaller === 'function') globalThis.renderNightCaller();
    if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
    else if (typeof globalThis.renderTouchTable === 'function') globalThis.renderTouchTable();

    // Auto advance after heal selection
    const scheduleFn = typeof callbacks.scheduleAutoAdvance === 'function' ? callbacks.scheduleAutoAdvance : (typeof globalThis.scheduleAutoAdvance === 'function' ? globalThis.scheduleAutoAdvance : null);
    if (scheduleFn) scheduleFn(900, callbacks);

  } else if (type === 'poison') {
    // 1. Check if Poison potion was already used in an earlier night
    if (!gameState.potions.witchPoisonAvailable && !gameState.nightActions.witchPoisonTarget) {
      showCustomAlert('⚠️ The Poison Potion has already been used in this game!\n\nThe Witch can only use her poison potion once per game.', {
        title: 'Poison Depleted',
        icon: '🧪',
        confirmText: 'Got It',
        confirmClass: 'btn-warning'
      });
      return;
    }

    // 2. Toggle off if already targeted someone tonight
    if (gameState.nightActions.witchPoisonTarget) {
      const poisoned = gameState.players.find(p => p.id === gameState.nightActions.witchPoisonTarget);
      gameState.nightActions.witchPoisonTarget = null;
      uiState.witchSelectionMode = null;
      const cancelFn = typeof callbacks.cancelAutoAdvance === 'function' ? callbacks.cancelAutoAdvance : (typeof globalThis.cancelAutoAdvance === 'function' ? globalThis.cancelAutoAdvance : null);
      if (cancelFn) cancelFn();
      showGameToast(`☠️ Poison on ${poisoned ? poisoned.name : 'player'} cancelled.`);
      saveAppState();
      if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller(callbacks);
      else if (typeof globalThis.renderNightCaller === 'function') globalThis.renderNightCaller();
      if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
      else if (typeof globalThis.renderTouchTable === 'function') globalThis.renderTouchTable();
      return;
    }

    // 3. Toggle off selection mode if currently arming
    if (uiState.witchSelectionMode === 'poison') {
      uiState.witchSelectionMode = null;
      if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller(callbacks);
      else if (typeof globalThis.renderNightCaller === 'function') globalThis.renderNightCaller();
      if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
      else if (typeof globalThis.renderTouchTable === 'function') globalThis.renderTouchTable();
      return;
    }

    // Cancel pending auto-advance so Witch can pick a target
    const cancelFn = typeof callbacks.cancelAutoAdvance === 'function' ? callbacks.cancelAutoAdvance : (typeof globalThis.cancelAutoAdvance === 'function' ? globalThis.cancelAutoAdvance : null);
    if (cancelFn) cancelFn();

    // 4. Arm Poison: target who you want
    uiState.witchSelectionMode = 'poison';
    showGameToast('🧪 Poison Potion: Tap any alive player on the table to eliminate!');
    if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller(callbacks);
    else if (typeof globalThis.renderNightCaller === 'function') globalThis.renderNightCaller();
    if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
    else if (typeof globalThis.renderTouchTable === 'function') globalThis.renderTouchTable();
  }
}

export function handleWitchDirectPlayerTap(player, callbacks = {}) {
  const witchHolders = gameState.players.filter(p => p.role === 'Witch');
  const isWitchDead = (witchHolders.length > 0 && witchHolders.every(p => p.status === 'dead'));
  if (isWitchDead) {
    showGameToast('💀 The Witch is dead! Cannot use potions.');
    return;
  }

  if (player.status !== 'alive') {
    showGameToast('⚠️ Cannot target deceased players.');
    return;
  }

  const healAvail = gameState.potions.witchHealAvailable && !gameState.nightActions.witchHealed;
  const poisonAvail = gameState.potions.witchPoisonAvailable && !gameState.nightActions.witchPoisonTarget;

  if (!healAvail && !poisonAvail && !gameState.nightActions.witchHealed && !gameState.nightActions.witchPoisonTarget) {
    showCustomAlert('Both Witch potions have already been used in this game!', {
      title: 'No Potions Left',
      icon: '🧪',
      confirmText: 'Got It'
    });
    return;
  }

  // If Witch is currently arming poison, tapping any alive player sets poison
  if (uiState.witchSelectionMode === 'poison') {
    if (gameState.nightActions.witchPoisonTarget === player.id) {
      gameState.nightActions.witchPoisonTarget = null;
      uiState.witchSelectionMode = null;
      const cancelFn = typeof callbacks.cancelAutoAdvance === 'function' ? callbacks.cancelAutoAdvance : (typeof globalThis.cancelAutoAdvance === 'function' ? globalThis.cancelAutoAdvance : null);
      if (cancelFn) cancelFn();
      showGameToast(`☠️ Poison on #${player.seat} ${player.name} cancelled.`);
      saveAppState();
      if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller(callbacks);
      else if (typeof globalThis.renderNightCaller === 'function') globalThis.renderNightCaller();
      if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
      else if (typeof globalThis.renderTouchTable === 'function') globalThis.renderTouchTable();
      return;
    }
    showCustomConfirm(`Use Witch's Poison Potion to eliminate #${player.seat} ${player.name}?`, {
      title: 'Poison Player?',
      icon: '☠️',
      confirmText: '☠️ Poison Player',
      confirmClass: 'btn-danger-solid',
      onConfirm: () => {
        gameState.nightActions.witchPoisonTarget = player.id;
        uiState.witchSelectionMode = null;
        soundManager.playChime();
        showGameToast(`☠️ #${player.seat} ${player.name} targeted for poison!`);
        saveAppState();
        if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller(callbacks);
        else if (typeof globalThis.renderNightCaller === 'function') globalThis.renderNightCaller();
        if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
        else if (typeof globalThis.renderTouchTable === 'function') globalThis.renderTouchTable();

        const scheduleFn = typeof callbacks.scheduleAutoAdvance === 'function' ? callbacks.scheduleAutoAdvance : (typeof globalThis.scheduleAutoAdvance === 'function' ? globalThis.scheduleAutoAdvance : null);
        if (scheduleFn) scheduleFn(650, callbacks);
      }
    });
    return;
  }

  // Check if player is the currently healed wolf victim -> prompt to cancel heal
  if (gameState.nightActions.witchHealed && player.id === (gameState.nightActions.witchHealTarget || gameState.nightActions.wolfTarget)) {
    showCustomConfirm(`Cancel healing on #${player.seat} ${player.name}?`, {
      title: 'Cancel Heal?',
      icon: '💚',
      confirmText: 'Cancel Heal',
      confirmClass: 'btn-warning',
      onConfirm: () => {
        gameState.nightActions.witchHealed = false;
        gameState.nightActions.witchHealTarget = null;
        const cancelFn = typeof callbacks.cancelAutoAdvance === 'function' ? callbacks.cancelAutoAdvance : (typeof globalThis.cancelAutoAdvance === 'function' ? globalThis.cancelAutoAdvance : null);
        if (cancelFn) cancelFn();
        showGameToast('💚 Healing cancelled.');
        saveAppState();
        if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller(callbacks);
        else if (typeof globalThis.renderNightCaller === 'function') globalThis.renderNightCaller();
        if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
        else if (typeof globalThis.renderTouchTable === 'function') globalThis.renderTouchTable();
      }
    });
    return;
  }

  // Check if player is the currently poisoned target -> prompt to cancel poison
  if (gameState.nightActions.witchPoisonTarget && player.id === gameState.nightActions.witchPoisonTarget) {
    showCustomConfirm(`Cancel poison on #${player.seat} ${player.name}?`, {
      title: 'Cancel Poison?',
      icon: '☠️',
      confirmText: 'Cancel Poison',
      confirmClass: 'btn-warning',
      onConfirm: () => {
        gameState.nightActions.witchPoisonTarget = null;
        const cancelFn = typeof callbacks.cancelAutoAdvance === 'function' ? callbacks.cancelAutoAdvance : (typeof globalThis.cancelAutoAdvance === 'function' ? globalThis.cancelAutoAdvance : null);
        if (cancelFn) cancelFn();
        showGameToast('☠️ Poison cancelled.');
        saveAppState();
        if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller(callbacks);
        else if (typeof globalThis.renderNightCaller === 'function') globalThis.renderNightCaller();
        if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
        else if (typeof globalThis.renderTouchTable === 'function') globalThis.renderTouchTable();
      }
    });
    return;
  }

  const isWolfVictim = (gameState.nightActions.wolfTarget === player.id);

  if (isWolfVictim) {
    if (healAvail) {
      showCustomConfirm(`Use Witch's Healing Potion to save #${player.seat} ${player.name} from the Werewolf attack?`, {
        title: 'Save Victim with Heal?',
        icon: '💚',
        confirmText: '💚 Yes, Heal Victim',
        confirmClass: 'btn-success',
        onConfirm: () => {
          gameState.nightActions.witchHealed = true;
          gameState.nightActions.witchHealTarget = player.id;
          uiState.witchSelectionMode = null;
          soundManager.playChime();
          showGameToast(`💚 #${player.seat} ${player.name} was saved with Healing Potion!`);
          saveAppState();
          if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller(callbacks);
          else if (typeof globalThis.renderNightCaller === 'function') globalThis.renderNightCaller();
          if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
          else if (typeof globalThis.renderTouchTable === 'function') globalThis.renderTouchTable();

          const scheduleFn = typeof callbacks.scheduleAutoAdvance === 'function' ? callbacks.scheduleAutoAdvance : (typeof globalThis.scheduleAutoAdvance === 'function' ? globalThis.scheduleAutoAdvance : null);
          if (scheduleFn) scheduleFn(900, callbacks);
        }
      });
      return;
    }

    if (poisonAvail) {
      showCustomConfirm(`Use Witch's Poison Potion to eliminate #${player.seat} ${player.name}?`, {
        title: 'Poison Player?',
        icon: '☠️',
        confirmText: '☠️ Poison Player',
        confirmClass: 'btn-danger-solid',
        onConfirm: () => {
          gameState.nightActions.witchPoisonTarget = player.id;
          uiState.witchSelectionMode = null;
          soundManager.playChime();
          showGameToast(`☠️ #${player.seat} ${player.name} targeted for poison!`);
          saveAppState();
          if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller(callbacks);
          else if (typeof globalThis.renderNightCaller === 'function') globalThis.renderNightCaller();
          if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
          else if (typeof globalThis.renderTouchTable === 'function') globalThis.renderTouchTable();

          const scheduleFn = typeof callbacks.scheduleAutoAdvance === 'function' ? callbacks.scheduleAutoAdvance : (typeof globalThis.scheduleAutoAdvance === 'function' ? globalThis.scheduleAutoAdvance : null);
          if (scheduleFn) scheduleFn(650, callbacks);
        }
      });
      return;
    }
  } else {
    // Player is NOT the wolf victim: they can be poisoned if poison available
    if (poisonAvail) {
      showCustomConfirm(`Use Witch's Poison Potion to eliminate #${player.seat} ${player.name}?`, {
        title: 'Poison Player?',
        icon: '☠️',
        confirmText: '☠️ Poison Player',
        confirmClass: 'btn-danger-solid',
        onConfirm: () => {
          gameState.nightActions.witchPoisonTarget = player.id;
          uiState.witchSelectionMode = null;
          soundManager.playChime();
          showGameToast(`☠️ #${player.seat} ${player.name} targeted for poison!`);
          saveAppState();
          if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller(callbacks);
          else if (typeof globalThis.renderNightCaller === 'function') globalThis.renderNightCaller();
          if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
          else if (typeof globalThis.renderTouchTable === 'function') globalThis.renderTouchTable();

          const scheduleFn = typeof callbacks.scheduleAutoAdvance === 'function' ? callbacks.scheduleAutoAdvance : (typeof globalThis.scheduleAutoAdvance === 'function' ? globalThis.scheduleAutoAdvance : null);
          if (scheduleFn) scheduleFn(650, callbacks);
        }
      });
      return;
    }

    // Poison is already depleted and this player is not the wolf victim
    const wolfVictim = gameState.players.find(p => p.id === gameState.nightActions.wolfTarget);
    showCustomAlert(`⚠️ The Healing Potion can ONLY save the player attacked by Werewolves tonight (${wolfVictim ? '#' + wolfVictim.seat + ' ' + wolfVictim.name : 'Nobody'})!\n\nAnd the Poison potion has already been used in this game.`, {
      title: 'Cannot Heal Player',
      icon: '💚',
      confirmText: 'Got It'
    });
    return;
  }
}

export function toggleWitchHealTouch(callbacks = {}) {
  handleWitchPotionBtnTap('heal', null, callbacks);
}

export function armWitchPoisonTouch(callbacks = {}) {
  handleWitchPotionBtnTap('poison', null, callbacks);
}

export function getInfectedCursedPlayer() {
  if (!gameState.nightActions || !gameState.nightActions.wolfTarget) return null;
  const victim = gameState.players.find(p => p.id === gameState.nightActions.wolfTarget);
  if (!victim || victim.role !== 'Cursed' || victim.status !== 'alive') return null;

  const savedByGuard = (gameState.nightActions.bodyguardTarget === victim.id);
  const savedByWitch = gameState.nightActions.witchHealed && (!gameState.nightActions.witchHealTarget || gameState.nightActions.witchHealTarget === victim.id);

  if (!savedByGuard && !savedByWitch) {
    return victim;
  }
  return null;
}

export function previewNightDeaths() {
  const deaths = [];

  if (gameState.nightActions.wolfTarget) {
    const victim = gameState.players.find(p => p.id === gameState.nightActions.wolfTarget);
    if (victim) {
      const savedByGuard = (gameState.nightActions.bodyguardTarget === victim.id);
      const savedByWitch = gameState.nightActions.witchHealed && (!gameState.nightActions.witchHealTarget || gameState.nightActions.witchHealTarget === victim.id);

      if (victim.role === 'Cursed' && !savedByGuard && !savedByWitch) {
        // Cursed player survives the wolf attack and will be infected into a Werewolf at dawn!
        // Do NOT add to deaths and do NOT mutate role during preview calls.
      } else if (!savedByGuard && !savedByWitch) {
        deaths.push({ id: victim.id, name: victim.name, reason: 'Killed by Werewolves' });
      }
    }
  }

  if (gameState.nightActions.witchPoisonTarget) {
    const poisonVictim = gameState.players.find(p => p.id === gameState.nightActions.witchPoisonTarget);
    if (poisonVictim && !deaths.some(d => d.id === poisonVictim.id)) {
      deaths.push({ id: poisonVictim.id, name: poisonVictim.name, reason: 'Poisoned by Witch' });
    }
  }

  const dyingIds = deaths.map(d => d.id);
  gameState.players.forEach(p => {
    if (p.isLover && dyingIds.includes(p.id)) {
      const partner = gameState.players.find(x => x.isLover && x.id !== p.id && x.status === 'alive');
      if (partner && !deaths.some(d => d.id === partner.id)) {
        deaths.push({ id: partner.id, name: partner.name, reason: 'Heartbreak' });
      }
    }
  });

  return deaths;
}
