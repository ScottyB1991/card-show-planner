(() => {
  const installBtn = document.getElementById('installAppBtn');
  const installDialog = document.getElementById('installDialog');
  const installText = document.getElementById('installInstructions');
  let deferredPrompt = null;

  const ua = navigator.userAgent || '';
  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isSamsungInternet = /SamsungBrowser/i.test(ua);

  function hideInstallButton() {
    if (installBtn) installBtn.hidden = true;
  }

  function showInstallButton() {
    if (installBtn && !isStandalone()) installBtn.hidden = false;
  }

  function showInstructions(html) {
    if (!installDialog || !installText) return;
    installText.innerHTML = html;
    installDialog.showModal();
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();

    // Samsung Internet can package installed PWAs in a way that triggers a
    // Play Protect "unsafe / unrecognised app" warning. Avoid launching that
    // installer from our own button; offer the cleaner Chrome route instead.
    if (isSamsungInternet) {
      deferredPrompt = null;
      showInstallButton();
      return;
    }

    deferredPrompt = event;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallButton();
  });

  if (isStandalone()) {
    hideInstallButton();
  } else if (isIOS || isSamsungInternet) {
    showInstallButton();
  }

  installBtn?.addEventListener('click', async () => {
    if (isSamsungInternet) {
      showInstructions(
        '<strong>Samsung tip:</strong> for the cleanest install, open THE CARD MAP in <strong>Chrome</strong>, ' +
        'then tap the Chrome menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.<br><br>' +
        '<span class="muted">Samsung Internet can trigger a Play Protect warning when it packages a web app. ' +
        'That warning is about the install route, not your Card Map account or data.</span>'
      );
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      hideInstallButton();
      return;
    }

    if (isIOS) {
      showInstructions(
        'In Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.'
      );
    } else {
      showInstructions(
        'Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.'
      );
    }
  });
})();
