/**
 * Floating Toast Notifications
 */
export function showGameToast(message, duration = 3800) {
  const container = document.getElementById('game-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'game-toast';
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fadeout');
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 350);
  }, duration);
}
