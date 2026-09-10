(() => {
  const installBtn = document.getElementById('installAppBtn');
  const installDialog = document.getElementById('installDialog');
  const installText = document.getElementById('installInstructions');
  let deferredPrompt = null;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSamsung = /SamsungBrowser/i.test(navigator.userAgent);

  function hideInstallButton() {
    if (installBtn) installBtn.hidden = true;
  }

  function showInstallButton() {
    if (installBtn && !isStandalone()) installBtn.hidden = false;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallButton();
  });

  if (isStandalone()) {
    hideInstallButton();
  } else {
    // iPhone/iPad and Samsung Internet may not expose beforeinstallprompt consistently.
    if (isIOS || isSamsung) showInstallButton();
  }

  installBtn?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      hideInstallButton();
      return;
    }

    if (installDialog && installText) {
      if (isIOS) {
        installText.innerHTML = 'Tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.';
      } else if (isSamsung) {
        installText.innerHTML = 'Open the browser menu and choose <strong>Add page to</strong> → <strong>Home screen</strong>, or <strong>Install app</strong> if shown.';
      } else {
        installText.innerHTML = 'Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.';
      }
      installDialog.showModal();
    }
  });
})();
