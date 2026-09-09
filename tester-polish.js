/* THE CARD MAP v26 — tester feedback polish
   - Exact UK postcode lookup using the free Postcodes.io API
   - Forgiving postcode formatting (e.g. dn401aa -> DN40 1AA)
   - Optional dark mode stored on the device
   - Does not touch Supabase configuration or Scout logic
*/
(() => {
  "use strict";

  const THEME_KEY = "tcm_theme";
  const POSTCODE_API = "https://api.postcodes.io/postcodes/";

  function normaliseUkPostcode(value) {
    const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!compact) return "";
    if (compact === "GIR0AA") return "GIR 0AA";
    if (compact.length < 5 || compact.length > 7) return "";
    const formatted = `${compact.slice(0, -3)} ${compact.slice(-3)}`;
    const ukPattern = /^(?:[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2})$/;
    return ukPattern.test(formatted) ? formatted : "";
  }

  function looksLikePostcode(value) {
    return /^[A-Za-z]{1,2}\s*\d/.test(String(value || "").trim());
  }

  function setTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");

    const btn = document.getElementById("themeToggleBtn");
    if (btn) {
      btn.textContent = dark ? "☀️ Light" : "🌙 Dark";
      btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0d0e12" : "#f7f7fb");
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    setTheme(saved === "dark" ? "dark" : "light");
    const btn = document.getElementById("themeToggleBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        setTheme(next);
      });
    }
  }

  async function exactPostcodeLookup(value) {
    const formatted = normaliseUkPostcode(value);
    if (!formatted) return { ok: false, invalid: true };

    const compact = formatted.replace(/\s/g, "");
    const response = await fetch(`${POSTCODE_API}${encodeURIComponent(compact)}`, {
      headers: { "Accept": "application/json" }
    });
    if (!response.ok) {
      if (response.status === 404) return { ok: false, notFound: true, formatted };
      throw new Error(`Postcode lookup returned ${response.status}`);
    }

    const payload = await response.json();
    const result = payload && payload.result;
    if (!result || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
      return { ok: false, notFound: true, formatted };
    }

    return {
      ok: true,
      postcode: result.postcode || formatted,
      latitude: result.latitude,
      longitude: result.longitude
    };
  }

  const originalUseEnteredPlace =
    typeof useEnteredPlace === "function" ? useEnteredPlace : null;

  async function useBetterEnteredPlace() {
    const input = document.getElementById("placeInput");
    const value = input ? input.value.trim() : "";

    if (!value) {
      if (typeof setLocationStatus === "function") {
        setLocationStatus("Enter a town or postcode first.", true);
      }
      return;
    }

    if (!looksLikePostcode(value)) {
      if (originalUseEnteredPlace) originalUseEnteredPlace();
      return;
    }

    const formatted = normaliseUkPostcode(value);
    if (!formatted) {
      if (typeof setLocationStatus === "function") {
        setLocationStatus("That doesn't look like a complete UK postcode. Try something like DN40 1AA.", true);
      }
      return;
    }

    if (input) input.value = formatted;
    if (typeof setLocationStatus === "function") {
      setLocationStatus(`Finding ${formatted}…`);
    }

    try {
      const result = await exactPostcodeLookup(formatted);

      if (!result.ok) {
        // Keep the old built-in postcode-area fallback available if the
        // postcode service cannot find the exact code.
        if (originalUseEnteredPlace) {
          originalUseEnteredPlace();
          if (typeof setLocationStatus === "function") {
            setLocationStatus(
              `Couldn't find ${formatted} exactly, so I'm using its postcode area instead. Distance is approximate.`,
              false
            );
          }
        }
        return;
      }

      userPlace = result.postcode;
      userLocation = {
        latitude: result.latitude,
        longitude: result.longitude,
        accuracy: null,
        approximate: false,
        postcode: true
      };

      localStorage.setItem("csp_user_place", result.postcode);
      if (input) input.value = result.postcode;

      if (typeof setLocationStatus === "function") {
        setLocationStatus(
          `📍 Using ${result.postcode} — shows are sorted nearest first. Mileage is approximate straight-line distance; Maps gives the real driving route.`
        );
      }

      const clearBtn = document.getElementById("clearLocationBtn");
      if (clearBtn) clearBtn.hidden = false;
      if (typeof render === "function") render();
    } catch (error) {
      console.warn("Exact postcode lookup unavailable:", error);
      if (originalUseEnteredPlace) {
        originalUseEnteredPlace();
        if (typeof setLocationStatus === "function") {
          setLocationStatus(
            `Exact postcode lookup is unavailable right now, so I'm using the built-in postcode area instead. Distance is approximate.`,
            false
          );
        }
      }
    }
  }

  function installPostcodeUpgrade() {
    const button = document.getElementById("placeBtn");
    const input = document.getElementById("placeInput");

    // app.js already has listeners. Capture-phase listeners let v26 handle
    // postcode entries first while leaving all existing town behaviour alone.
    if (button) {
      button.addEventListener("click", (event) => {
        const value = input ? input.value.trim() : "";
        if (!looksLikePostcode(value)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        useBetterEnteredPlace();
      }, true);
    }

    if (input) {
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || !looksLikePostcode(input.value)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        useBetterEnteredPlace();
      }, true);

      input.addEventListener("blur", () => {
        const formatted = normaliseUkPostcode(input.value);
        if (formatted) input.value = formatted;
      });
    }
  }

  initTheme();
  installPostcodeUpgrade();
})();
