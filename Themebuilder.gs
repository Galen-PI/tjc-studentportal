/* ============================================================
   CUSTOM THEME BUILDER
   ------------------------------------------------------------
   Lets a student pick their own colors instead of only choosing
   from the 20 preset themes. Uses native <input type="color">,
   which gives a real color-wheel/picker on every modern browser
   and phone — no extra library needed. Saved to localStorage per
   device, applied as a "custom" theme layered on top of whichever
   base theme (dark/light/etc.) they were last using, so anything
   they DON'T customize still looks sensible.
   ============================================================ */

const CUSTOM_THEME_KEY = 'tjcCustomTheme';

// The variables students can actually customize. Keeping this to a
// curated handful (not all 30+ CSS vars) so the builder stays simple
// and every combination still looks coherent — e.g. --text-muted,
// --border, and the shadow variables stay derived from the base
// theme rather than becoming their own sliders.
const CUSTOMIZABLE_VARS = [
  { key: '--bg-nav',   label: 'Banner / Nav Bar' },
  { key: '--accent',   label: 'Accent Color' },
  { key: '--bg',       label: 'Page Background' },
  { key: '--bg2',      label: 'Card Background' },
  { key: '--text',     label: 'Text Color' },
];

const CUSTOM_FONTS = [
  { key: "'Figtree', system-ui, sans-serif",              label: 'Figtree (default)' },
  { key: "'Georgia', serif",                              label: 'Georgia' },
  { key: "'Courier New', monospace",                      label: 'Courier New' },
  { key: "'Trebuchet MS', sans-serif",                     label: 'Trebuchet MS' },
  { key: "'Comic Sans MS', 'Comic Sans', cursive",          label: 'Comic Sans' },
  { key: "'Palatino Linotype', 'Book Antiqua', serif",      label: 'Palatino' },
];

function openThemeBuilder() {
  closeThemeDropdown();

  const saved = _loadCustomTheme();
  const currentBase = document.documentElement.getAttribute('data-theme') || 'dark';

  const overlay = document.createElement('div');
  overlay.id = 'themeBuilderOverlay';
  overlay.className = 'explainer-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeThemeBuilder(); };

  overlay.innerHTML = `
    <div class="explainer-box" style="max-width:420px;">
      <div class="explainer-title">Build Your Own Theme</div>
      <p class="explainer-text">Pick your own colors and font. Anything you don't change stays part of your current theme (${esc(currentBase)}).</p>

      <div id="themeBuilderFields" style="display:flex;flex-direction:column;gap:14px;margin-bottom:18px;"></div>

      <div style="margin-bottom:18px;">
        <label class="login-label" style="margin-bottom:8px;">Font</label>
        <select id="themeBuilderFont" style="
          width:100%;padding:10px 12px;background:var(--bg3);border:1px solid var(--border);
          border-radius:7px;color:var(--text);font-family:var(--font);font-size:14px;
        ">
          ${CUSTOM_FONTS.map(f => `<option value="${esc(f.key)}" ${saved && saved['--font'] === f.key ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}
        </select>
      </div>

      <div style="display:flex;gap:10px;">
        <button class="explainer-close" style="flex:1;" onclick="resetCustomTheme()">Reset to Preset</button>
        <button class="login-btn" style="flex:1;margin-top:0;" onclick="closeThemeBuilder()">Done</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const fieldsEl = document.getElementById('themeBuilderFields');
  fieldsEl.innerHTML = CUSTOMIZABLE_VARS.map(v => {
    const currentVal = saved && saved[v.key]
      ? saved[v.key]
      : _rgbToHex(getComputedStyle(document.documentElement).getPropertyValue(v.key).trim());
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <label style="font-size:13px;font-weight:600;color:var(--text-soft);">${esc(v.label)}</label>
        <input type="color" data-var="${esc(v.key)}" value="${esc(currentVal)}"
          oninput="_onThemeBuilderColorChange(this)"
          style="width:44px;height:34px;border:1px solid var(--border);border-radius:6px;
                 padding:0;cursor:pointer;background:none;">
      </div>`;
  }).join('');

  document.getElementById('themeBuilderFont').addEventListener('change', (e) => {
    _applyCustomThemeVar('--font', e.target.value);
    _saveCustomThemeVar('--font', e.target.value);
  });
}

function closeThemeBuilder() {
  const el = document.getElementById('themeBuilderOverlay');
  if (el) el.remove();
}

function _onThemeBuilderColorChange(input) {
  const varName = input.getAttribute('data-var');
  const hex = input.value;
  _applyCustomThemeVar(varName, hex);
  _saveCustomThemeVar(varName, hex);

  // A few colors imply sensible companions so things don't look broken —
  // e.g. changing the page background should nudge the "card" shadow
  // and border tone along with it rather than leaving high-contrast
  // borders from the old theme sitting on a totally different backdrop.
  if (varName === '--bg') {
    document.documentElement.style.setProperty('--bg3', _shiftLightness(hex, 6));
    document.documentElement.style.setProperty('--bg4', _shiftLightness(hex, 12));
  }
}

function _applyCustomThemeVar(key, value) {
  document.documentElement.style.setProperty(key, value);
}

function _saveCustomThemeVar(key, value) {
  const current = _loadCustomTheme() || {};
  current[key] = value;
  try { localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(current)); } catch(e) {}
}

function _loadCustomTheme() {
  try {
    const raw = localStorage.getItem(CUSTOM_THEME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function applyCustomThemeOnLoad() {
  const saved = _loadCustomTheme();
  if (!saved) return;
  Object.entries(saved).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
}

function resetCustomTheme() {
  try { localStorage.removeItem(CUSTOM_THEME_KEY); } catch(e) {}
  // Clear all inline overrides so the preset theme's own values show again
  CUSTOMIZABLE_VARS.forEach(v => document.documentElement.style.removeProperty(v.key));
  document.documentElement.style.removeProperty('--font');
  document.documentElement.style.removeProperty('--bg3');
  document.documentElement.style.removeProperty('--bg4');
  closeThemeBuilder();
}

// ── Small color-math helpers (no library — plain hex math) ─────
function _rgbToHex(rgbStr) {
  if (!rgbStr) return '#000000';
  if (rgbStr.startsWith('#')) return rgbStr;
  const m = rgbStr.match(/\d+/g);
  if (!m || m.length < 3) return '#000000';
  return '#' + m.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('');
}

function _shiftLightness(hex, amount) {
  const h = hex.replace('#', '');
  const r = Math.min(255, Math.max(0, parseInt(h.substring(0,2),16) + amount));
  const g = Math.min(255, Math.max(0, parseInt(h.substring(2,4),16) + amount));
  const b = Math.min(255, Math.max(0, parseInt(h.substring(4,6),16) + amount));
  return '#' + [r,g,b].map(n => Math.round(n).toString(16).padStart(2,'0')).join('');
}

// Apply any saved custom theme as soon as the page loads, right after
// the preset theme is applied (see the IIFE near the bottom of the
// theme section — add a call to applyCustomThemeOnLoad() there).
