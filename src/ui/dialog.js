/**
 * Themed Custom Modal Dialog System
 * Replaces native browser alert & confirm with stylized RPG dialogs.
 */
import { soundManager } from '../audio/sound.js';
import { uiState } from '../state/store.js';

export function parseDialogMeta(message, customTitle, customIcon) {
  let text = (message || '').toString();
  let title = customTitle || '';
  let icon = customIcon || '';

  // Smart metadata inference based on message contents
  if (!icon || !title) {
    if (text.includes('SEER INSPECTION') || text.includes('CORRECT: WEREWOLF') || text.includes('WRONG: NOT WEREWOLF') || text.includes('Correct: Werewolf') || text.includes('Wrong: Not Werewolf') || text.includes('Seer checked') || text.includes('Seer Inspection')) {
      if (text.includes('WRONG') || text.includes('NOT WEREWOLF') || text.includes('Not Werewolf') || text.includes('GOOD (Town)')) {
        icon = icon || '❌';
        title = title || '🔴 Wrong: Not Werewolf';
      } else {
        icon = icon || '🐺';
        title = title || '🟢 Correct: Werewolf!';
      }
    } else if (text.includes('DOPPELGANGER TRANSFORMED') || text.includes('DOPPELGANGER TRIGGER') || text.includes('Doppelganger')) {
      icon = icon || '🎭';
      title = title || 'Doppelganger';
    } else if (text.includes('PRINCE')) {
      icon = icon || '👑';
      title = title || 'Prince Royalty';
    } else if (text.includes('Vote Tie')) {
      icon = icon || '⚖️';
      title = title || 'Vote Tied';
    } else if (text.includes('Discussion time is up') || text.includes('time is up')) {
      icon = icon || '⏰';
      title = title || "Time's Up!";
    } else if (text.includes('Please add at least 3 players')) {
      icon = icon || '🧑‍🤝‍🧑';
      title = title || 'Minimum Players Needed';
    } else if (text.includes('Role count') || text.includes('Balance the deck')) {
      icon = icon || '⚖️';
      title = title || 'Deck Unbalanced';
    } else if (text.includes('Restart current game') || text.includes('Restart')) {
      icon = icon || '↺';
      title = title || 'Restart Game?';
    } else if (text.includes('Exit game') || text.includes('Lobby')) {
      icon = icon || '🏠';
      title = title || 'Exit to Lobby?';
    } else if (text.includes('Execute #') || text.includes('Execute')) {
      icon = icon || '💀';
      title = title || 'Execute Player?';
    } else if (text.includes('heartbreak')) {
      icon = icon || '💔';
      title = title || 'Heartbreak Tragedy';
    } else if (text.includes('village to sleep') || text.includes('Send village')) {
      icon = icon || '🌙';
      title = title || 'Begin Nightfall?';
    } else if (text.includes('Clear game event history')) {
      icon = icon || '📜';
      title = title || 'Clear Event Log?';
    } else if (text.includes('already assigned') || text.includes('Limit reached') || text.includes('Cannot target') || text.includes('already been used')) {
      icon = icon || '⚠️';
      title = title || 'Action Blocked';
    } else {
      icon = icon || '🐺';
      title = title || 'Notice';
    }
  }

  return { title, icon, text };
}

export function showCustomAlert(message, options = {}) {
  const text = (message || '').toString();
  if (typeof lastAlert !== 'undefined') lastAlert = text;
  if (typeof window !== 'undefined') window.lastAlert = text;
  if (typeof global !== 'undefined') global.lastAlert = text;
  if (typeof alert === 'function' && alert !== showCustomAlert) {
    try { alert(text); } catch (e) {}
  } else if (typeof global !== 'undefined' && typeof global.alert === 'function' && global.alert !== showCustomAlert) {
    try { global.alert(text); } catch (e) {}
  }

  const overlay = typeof document !== 'undefined' ? document.getElementById('custom-dialog-overlay') : null;
  const iconEl = typeof document !== 'undefined' ? document.getElementById('custom-dialog-icon') : null;
  const titleEl = typeof document !== 'undefined' ? document.getElementById('custom-dialog-title') : null;
  const bodyEl = typeof document !== 'undefined' ? document.getElementById('custom-dialog-body') : null;
  const cancelBtn = typeof document !== 'undefined' ? document.getElementById('custom-dialog-cancel-btn') : null;
  const confirmBtn = typeof document !== 'undefined' ? document.getElementById('custom-dialog-confirm-btn') : null;

  const meta = parseDialogMeta(message, options.title, options.icon);

  if (iconEl) iconEl.textContent = meta.icon;
  if (titleEl) {
    titleEl.textContent = meta.title;
    if (meta.title.includes('🟢')) {
      titleEl.style.color = '#34d399';
    } else if (meta.title.includes('🔴')) {
      titleEl.style.color = '#f87171';
    } else {
      titleEl.style.color = '#f8fafc';
    }
  }
  if (bodyEl) bodyEl.textContent = meta.text;

  if (cancelBtn) cancelBtn.style.display = 'none';

  if (confirmBtn) {
    const btnClass = options.confirmClass || (meta.title.includes('🟢') ? 'btn-success' : (meta.title.includes('🔴') ? 'btn-danger-solid' : 'btn-primary'));
    confirmBtn.className = `btn ${btnClass} custom-dialog-btn`;
    confirmBtn.textContent = options.confirmText || (meta.title.includes('🟢') ? 'Got It (Werewolf) 👍' : (meta.title.includes('🔴') ? 'Got It (Not Werewolf) 👎' : 'Got It'));
  }

  if (overlay) {
    const cardEl = overlay.querySelector ? overlay.querySelector('.custom-dialog-card') : null;
    if (cardEl) {
      if (options.cardBorder) {
        cardEl.style.borderColor = options.cardBorder;
        cardEl.style.boxShadow = `0 20px 50px rgba(0, 0, 0, 0.75), 0 0 35px ${options.cardGlow || options.cardBorder}`;
      } else if (meta.title.includes('🟢')) {
        cardEl.style.borderColor = '#10b981';
        cardEl.style.boxShadow = '0 20px 50px rgba(0, 0, 0, 0.75), 0 0 35px rgba(16, 185, 129, 0.4)';
      } else if (meta.title.includes('🔴')) {
        cardEl.style.borderColor = '#ef4444';
        cardEl.style.boxShadow = '0 20px 50px rgba(0, 0, 0, 0.75), 0 0 35px rgba(239, 68, 68, 0.4)';
      } else {
        cardEl.style.borderColor = '';
        cardEl.style.boxShadow = '';
      }
    }
    overlay.style.display = 'flex';
    if (overlay.classList && overlay.classList.add) overlay.classList.add('active');
  }

  soundManager.playBeep();

  return new Promise((resolve) => {
    uiState.activeDialogResolver = (val) => {
      if (options.onOk) options.onOk();
      resolve(val);
    };

    if (!overlay || !iconEl || !titleEl || !bodyEl || !confirmBtn) {
      if (options.onOk) options.onOk();
      resolve(true);
      return;
    }

    try { if (confirmBtn && confirmBtn.focus) confirmBtn.focus(); } catch (e) {}
  });
}

export function showCustomConfirm(message, options = {}) {
  const text = (message || '').toString();
  const overlay = document.getElementById('custom-dialog-overlay');

  // Fallback for headless test environments (Node.js) or without real DOM
  if (!globalThis.IS_DIALOG_TEST && (!overlay || (typeof process !== 'undefined' && process.versions && process.versions.node))) {
    let result = true;
    if (typeof confirm === 'function' && confirm !== showCustomConfirm) {
      try { result = confirm(message); } catch (e) { result = true; }
    }
    if (result && options.onConfirm) options.onConfirm();
    if (!result && options.onCancel) options.onCancel();
    return Promise.resolve(result);
  }

  return new Promise((resolve) => {
    const iconEl = document.getElementById('custom-dialog-icon');
    const titleEl = document.getElementById('custom-dialog-title');
    const bodyEl = document.getElementById('custom-dialog-body');
    const cancelBtn = document.getElementById('custom-dialog-cancel-btn');
    const confirmBtn = document.getElementById('custom-dialog-confirm-btn');

    if (!iconEl || !titleEl || !bodyEl || !confirmBtn) {
      if (options.onConfirm) options.onConfirm();
      resolve(true);
      return;
    }

    const meta = parseDialogMeta(message, options.title || 'Please Confirm', options.icon || '❓');

    iconEl.textContent = meta.icon;
    titleEl.textContent = meta.title;
    bodyEl.textContent = meta.text;

    if (cancelBtn) {
      cancelBtn.style.display = 'inline-flex';
      cancelBtn.textContent = options.cancelText || 'Cancel';
    }

    const btnClass = options.confirmClass || (meta.text.includes('Execute') || meta.text.includes('Restart') || meta.text.includes('Clear') || meta.text.includes('die of heartbreak') ? 'btn-danger' : 'btn-primary');
    confirmBtn.className = `btn ${btnClass} custom-dialog-btn`;
    confirmBtn.textContent = options.confirmText || 'Confirm';

    uiState.activeDialogResolver = (val) => {
      if (val && options.onConfirm) options.onConfirm();
      if (!val && options.onCancel) options.onCancel();
      resolve(val);
    };

    overlay.style.display = 'flex';
    void overlay.offsetHeight;
    overlay.classList.add('active');

    soundManager.playBeep();
    try { confirmBtn.focus(); } catch (e) {}
  });
}

export function handleCustomDialogResolve(result) {
  const overlay = document.getElementById('custom-dialog-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.style.display = 'none';
      const cardEl = overlay.querySelector ? overlay.querySelector('.custom-dialog-card') : null;
      if (cardEl) {
        cardEl.style.borderColor = '';
        cardEl.style.boxShadow = '';
      }
      const titleEl = document.getElementById('custom-dialog-title');
      if (titleEl) titleEl.style.color = '';
    }, 200);
  }
  soundManager.playBeep();
  if (uiState.activeDialogResolver) {
    const resolver = uiState.activeDialogResolver;
    uiState.activeDialogResolver = null;
    resolver(result);
  }
}

export function handleDialogBackdropClick(event) {
  if (event.target && event.target.id === 'custom-dialog-overlay') {
    handleCustomDialogResolve(false);
  }
}

export function initDialogKeyboardListeners() {
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('keydown', (e) => {
      const overlay = document.getElementById('custom-dialog-overlay');
      if (overlay && overlay.classList && overlay.classList.contains && overlay.classList.contains('active')) {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCustomDialogResolve(false);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleCustomDialogResolve(true);
        }
      }
    });
  }
}
