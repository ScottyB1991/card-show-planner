(() => {
  const select = document.getElementById('regionSelect');
  if (!select || select.dataset.cardMapPicker === '1') return;
  select.dataset.cardMapPicker = '1';
  select.classList.add('region-native-select');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'region-picker-btn';
  button.setAttribute('aria-haspopup', 'dialog');
  select.insertAdjacentElement('afterend', button);

  const dialog = document.createElement('dialog');
  dialog.className = 'region-picker-dialog';
  dialog.setAttribute('aria-label', 'Choose a UK region');
  dialog.innerHTML = `
    <div class="region-picker-panel">
      <div class="region-picker-head">
        <strong>Choose region</strong>
        <button type="button" class="region-picker-close" aria-label="Close region picker">✕</button>
      </div>
      <div class="region-picker-options" role="radiogroup" aria-label="UK regions"></div>
    </div>`;
  document.body.appendChild(dialog);

  const optionsBox = dialog.querySelector('.region-picker-options');
  const closeBtn = dialog.querySelector('.region-picker-close');

  function selectedText() {
    return select.options[select.selectedIndex]?.textContent?.trim() || 'All UK';
  }

  function syncButton() {
    button.textContent = selectedText();
    button.setAttribute('aria-label', `Region: ${selectedText()}. Change region`);
  }

  function buildOptions() {
    optionsBox.replaceChildren();
    [...select.options].forEach(opt => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'region-picker-option';
      item.setAttribute('role', 'radio');
      item.setAttribute('aria-checked', String(opt.value === select.value));
      item.textContent = opt.textContent;
      item.addEventListener('click', () => {
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        syncButton();
        dialog.close();
        button.focus();
      });
      optionsBox.appendChild(item);
    });
  }

  button.addEventListener('click', () => {
    buildOptions();
    dialog.showModal();
  });
  closeBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', syncButton);
  select.addEventListener('change', syncButton);

  new MutationObserver(() => syncButton()).observe(select, { childList: true, subtree: true });
  syncButton();
})();
