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
  const REGION_ORDER = [
    'North East',
    'North West',
    'Yorkshire and The Humber',
    'East Midlands',
    'West Midlands',
    'East of England',
    'London',
    'South East',
    'South West',
    'Wales',
    'Scotland',
    'Northern Ireland'
  ];
  const CACHE_KEY = 'tcm_event_region_cache_v1';

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

  function normalizePostcode(value) {
    const raw = String(value || '').toUpperCase().replace(/\s+/g, ' ').trim();
    const match = raw.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
    if (!match) return '';
    const compact = match[1].replace(/\s+/g, '');
    return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
  }

  function eventPostcode(event) {
    return normalizePostcode([event?.postcode, event?.address, event?.venue].filter(Boolean).join(' '));
  }

  function regionFromLookup(result) {
    if (!result) return '';
    if (result.country === 'Scotland' || result.country === 'Wales' || result.country === 'Northern Ireland') {
      return result.country;
    }
    return result.region || '';
  }

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function writeCache(cache) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
    catch (_) {}
  }

  function populateRegionSelect(events) {
    const previous = select.value;
    const available = new Set(events.map(e => e.region).filter(Boolean));
    const ordered = REGION_ORDER.filter(r => available.has(r));
    const extras = [...available].filter(r => !REGION_ORDER.includes(r)).sort((a, b) => a.localeCompare(b));
    const regions = [...ordered, ...extras];

    select.replaceChildren();
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'All UK';
    select.appendChild(all);

    for (const region of regions) {
      const opt = document.createElement('option');
      opt.value = region;
      opt.textContent = region;
      select.appendChild(opt);
    }

    if ([...select.options].some(opt => opt.value === previous)) select.value = previous;
    syncButton();
  }

  async function hydrateRegions() {
    let events = null;
    for (let i = 0; i < 80; i += 1) {
      try {
        if (typeof currentEvents !== 'undefined' && Array.isArray(currentEvents) && currentEvents.length) {
          events = currentEvents;
          break;
        }
      } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    if (!events) return;

    // Show any regions already present immediately (e.g. demo/fallback data).
    populateRegionSelect(events);

    const cache = readCache();
    const needed = new Set();

    for (const event of events) {
      if (event.region) continue;
      const postcode = eventPostcode(event);
      if (!postcode) continue;
      if (cache[postcode]) event.region = cache[postcode];
      else needed.add(postcode);
    }

    if (needed.size) {
      try {
        const response = await fetch('https://api.postcodes.io/postcodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postcodes: [...needed].slice(0, 100) })
        });
        if (response.ok) {
          const payload = await response.json();
          for (const row of payload.result || []) {
            const postcode = normalizePostcode(row.query);
            const region = regionFromLookup(row.result);
            if (postcode && region) cache[postcode] = region;
          }
          writeCache(cache);
        }
      } catch (error) {
        console.warn('Region lookup unavailable:', error);
      }

      for (const event of events) {
        if (event.region) continue;
        const postcode = eventPostcode(event);
        if (postcode && cache[postcode]) event.region = cache[postcode];
      }
    }

    populateRegionSelect(events);
    try { if (typeof render === 'function') render(); } catch (_) {}
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
  hydrateRegions();
})();
