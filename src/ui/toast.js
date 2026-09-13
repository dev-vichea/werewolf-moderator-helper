/**
 * Floating Minimal Toast Notifications (Single active instance to avoid screen clutter)
 */
let activeToastTimeout = null;

export function showGameToast(message, duration = 1500) {
  const container = document.getElementById('game-toast-container');
  if (!container) return;

  if (activeToastTimeout) {
    clearTimeout(activeToastTimeout);
    activeToastTimeout = null;
  }

  // Clear any existing toasts to avoid messy stacking
  container.innerHTML = '';

  const toast = document.createElement('div');
  toast.className = 'game-toast';
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  activeToastTimeout = setTimeout(() => {
    toast.classList.add('toast-fadeout');
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 220);
  }, duration);
}
