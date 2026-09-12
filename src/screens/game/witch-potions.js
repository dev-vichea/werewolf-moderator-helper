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
    if (!gameState.potions.witchHealAvailable && !gameState.nightActions.witchHealed) {
      showCustomAlert('⚠️ The Healing Potion has already been used in this game!\n\nThe Witch can only use her healing potion once per game.', {
        title: 'Potion Depleted',
        icon: '💚',
        confirmText: 'Got It',
        confirmClass: 'btn-warning'
      });
      return;
    }

    if (gameState.nightActions.witchHealed) {
      gameState.nightActions.witchHealed = false;
      gameState.nightActions.witchHealTarget = null;
      uiState.witchSelectionMode = null;
      showGameToast('💚 Healing potion cancelled.');
      saveAppState();
      if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller();
      if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
      return;
    }

    if (uiState.witchSelectionMode === 'heal') {
      uiState.witchSelectionMode = null;
      if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller();
      if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
      return;
    }

    uiState.witchSelectionMode = 'heal';
    const victim = gameState.players.find(p => p.id === gameState.nightActions.wolfTarget);
    if (victim) {
      showGameToast(`💚 Heal Potion: Tap #${victim.seat} ${victim.name} (or any player) on the table to heal!`);
    } else {
      showGameToast('💚 Heal Potion: Tap a player on the table to heal!');
    }
    if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller();
    if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
  } else if (type === 'poison') {
    if (!gameState.potions.witchPoisonAvailable && !gameState.nightActions.witchPoisonTarget) {
      showCustomAlert('⚠️ The Poison Potion has already been used in this game!\n\nThe Witch can only use her poison potion once per game.', {
        title: 'Potion Depleted',
        icon: '🧪',
        confirmText: 'Got It',
        confirmClass: 'btn-warning'
      });
      return;
    }

    if (gameState.nightActions.witchPoisonTarget) {
      const poisoned = gameState.players.find(p => p.id === gameState.nightActions.witchPoisonTarget);
      gameState.nightActions.witchPoisonTarget = null;
      uiState.witchSelectionMode = null;
      showGameToast(`☠️ Poison on ${poisoned ? poisoned.name : 'player'} cancelled.`);
      saveAppState();
      if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller();
      if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
      return;
    }

    if (uiState.witchSelectionMode === 'poison') {
      uiState.witchSelectionMode = null;
      if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller();
      if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
      return;
    }

    uiState.witchSelectionMode = 'poison';
    showGameToast('🧪 Poison Potion: Tap a player on the table to eliminate with poison!');
    if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller();
    if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
  }
}

export function handleWitchDirectPlayerTap(player, callbacks = {}) {
  const witchHolders = gameState.players.filter(p => p.role === 'Witch');
  const isWitchDead = (witchHolders.length > 0 && witchHolders.every(p => p.status === 'dead'));
  if (isWitchDead) {
    showGameToast('💀 The Witch is dead! Cannot use potions.');
    return;
  }

  const healAvail = gameState.potions.witchHealAvailable && !gameState.nightActions.witchHealed;
  const poisonAvail = gameState.potions.witchPoisonAvailable && !gameState.nightActions.witchPoisonTarget;

  if (!healAvail && !poisonAvail) {
    showCustomAlert('Both Witch potions have already been used in this game!', {
      title: 'No Potions Left',
      icon: '🧪',
      confirmText: 'Got It'
    });
    return;
  }

  const isWolfVictim = (gameState.nightActions.wolfTarget === player.id);
  if (isWolfVictim && healAvail) {
    showCustomConfirm(`Use Witch's Healing Potion to save #${player.seat} ${player.name} from the Werewolf attack?`, {
      title: 'Save Victim with Heal?',
      icon: '💚',
      confirmText: '💚 Yes, Heal Player',
      confirmClass: 'btn-success',
      onConfirm: () => {
        gameState.nightActions.witchHealed = true;
        gameState.nightActions.witchHealTarget = player.id;
        uiState.witchSelectionMode = null;
        soundManager.playChime();
        showGameToast(`💚 #${player.seat} ${player.name} was saved with Healing Potion!`);
        saveAppState();
        if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller();
        if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
      }
    });
    return;
  }

  if (!healAvail && poisonAvail) {
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
        if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller();
        if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
      }
    });
    return;
  }

  if (healAvail && !poisonAvail) {
    showCustomConfirm(`Use Witch's Healing Potion on #${player.seat} ${player.name}?`, {
      title: 'Heal Player?',
      icon: '💚',
      confirmText: '💚 Heal Player',
      confirmClass: 'btn-success',
      onConfirm: () => {
        gameState.nightActions.witchHealed = true;
        gameState.nightActions.witchHealTarget = player.id;
        uiState.witchSelectionMode = null;
        soundManager.playChime();
        showGameToast(`💚 #${player.seat} ${player.name} healed!`);
        saveAppState();
        if (typeof callbacks.renderNightCaller === 'function') callbacks.renderNightCaller();
        if (typeof callbacks.renderTouchTable === 'function') callbacks.renderTouchTable();
      }
    });
    return;
  }

  // Both potions available: remind moderator to select which potion in center hub first
  showGameToast('👉 Tap 💚 Heal Potion or 🧪 Poison Potion in the center of the table first!');
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
