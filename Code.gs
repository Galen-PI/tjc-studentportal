// ============================================================
// STUDENT SYSTEM DASHBOARD — Code.gs (Entry Point)
// ============================================================

// ── Spreadsheet IDs ─────────────────────────────────────────
const SS_HUB      = '1cVjsX_WidmHfFNXTBGcRqwJ5U7Iln0QI9_dargB_UMw';
const SS_ACADEMIC = '1IUA-_4LPasXMXp1qfcYiex-PC5WOT7cnY_K1XHCPJEg';
const SS_ADMIN  =   '1EIAtya9M3sVedSYYwvv81aQWUbPUsrdVoUrwyDtWTO0';

const ADMIN_EMAILS = [
  'galen.jobcorps1@gmail.com',
  'braydepike13@gmail.com',
];
const ADMIN_TOKEN = 'MS4245';

const SHEET_STAFF_ROLES     = 'Staff Roles';
const SHEET_SYSTEM_CONFIG   = 'System Config';
const SHEET_DIGEST_RECIPIENTS = 'Digest Recipients';

const ROLES = {
  ADMIN:               'Admin',
  PROGRAM_MANAGER:     'Program Manager',
  MANAGER:             'Manager',
  COUNSELOR:           'Counselor',
  ACADEMIC_INSTRUCTOR: 'Academic Instructor',
};

// ── Sheet / Tab Names (all in SS_HUB) ────────────────────────
const SHEET_HS            = 'High School Summary';
const SHEET_HISET         = 'HISET/GED Summary';
const SHEET_TRADES        = 'Trade Summary';
const SHEET_MAPPING       = 'Name Mapping';
const SHEET_TRADE_MONTHLY = 'Trade Monthly Percentage';
const SHEET_TIME          = 'TimeTable 2026';
const SHEET_WIR_LOG       = 'WIR Log';
const SHEET_OVERRIDES     = 'Manual Overrides';

// ── Data start rows ──────────────────────────────────────────
const DATA_START_ROW        = 7;
const TRADES_DATA_START_ROW = 6;
const TIME_DATA_START_ROW   = 3;
const TRADE_MONTHLY_START   = 3;

// ── Cache TTL (seconds) ──────────────────────────────────────
// 1800s (30 min) cache + a 10-minute warming trigger (see // keepDashboardCacheWarm below) means a cold cache should be rare:
// the trigger refreshes the cache well before it expires, so most users hit a warm cache on initial load instead of waiting for a full rebuild.
const CACHE_TTL = 1800;
// ────────────────────────────────────────────────────────────
// System enabled check
// ────────────────────────────────────────────────────────────
function _isSystemEnabled() {
  try {
    const adminSS = SpreadsheetApp.openById(SS_ADMIN);
    const sheet   = adminSS.getSheetByName(SHEET_SYSTEM_CONFIG);
    if (!sheet) return true;
    const values  = sheet.getDataRange().getValues();
    const row     = values.find(r => String(r[0]).trim() === 'SystemEnabled');
    if (!row) return true;
    return String(row[1]).trim().toUpperCase() === 'TRUE';
  } catch(e) {
    Logger.log('_isSystemEnabled error: ' + e.message);
    return true; 
  }
}

// ────────────────────────────────────────────────────────────
// Admin email check
// ────────────────────────────────────────────────────────────
function _isAdminEmail(email) {
  return ADMIN_EMAILS.map(e => e.toLowerCase()).includes((email || '').toLowerCase());
}

// ────────────────────────────────────────────────────────────
// Get role by employee ID
// ────────────────────────────────────────────────────────────
function getRoleByEmployeeId(employeeId) {
  try {
    employeeId = String(employeeId || '').trim();
    if (!employeeId) return { error: 'No Employee ID provided.' };

    // Admin token check — bypasses Staff Roles sheet entirely
    if (employeeId === ADMIN_TOKEN) {
      return {
        error:      null,
        employeeId: 'ADMIN',
        name:       'Galen',
        role:       ROLES.ADMIN,
        email:      'galen.jobcorps1@gmail.com',
      };
    }

    const adminSS = SpreadsheetApp.openById(SS_ADMIN);
    const sheet   = adminSS.getSheetByName(SHEET_STAFF_ROLES);
    if (!sheet) return { error: 'Staff Roles sheet not found.' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { error: 'No staff on file.' };

    const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    const row    = values.find(r => String(r[0]).trim() === employeeId);

    if (!row) return { error: 'Employee ID not recognized.' };

    const active = String(row[4]).trim().toUpperCase();
    if (active !== 'TRUE') return { error: 'Your account is inactive. Contact your administrator.' };

    return {
      error:      null,
      employeeId: String(row[0]).trim(),
      name:       String(row[1]).trim(),
      role:       String(row[2]).trim(),
      email:      String(row[3]).trim(),
    };

  } catch(e) {
    Logger.log('getRoleByEmployeeId error: ' + e.message);
    return { error: 'Something went wrong. Please try again.' };
  }
}

// ────────────────────────────────────────────────────────────
// Web App Entry Point
// ────────────────────────────────────────────────────────────
function doGet(e) {
  // ── Student view — no kill switch, loads instantly ─────────
  // Allow API calls with student ID parameter
  if (e && e.parameter && e.parameter.studentId) {
    const result = getStudentProfile(e.parameter.studentId);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.view === 'student') {
    return HtmlService
      .createTemplateFromFile('StudentView')
      .evaluate()
      .setTitle('My Progress — Tulsa Job Corps')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // ── Staff dashboard — kill switch applies ──────────────────
  if (!_isSystemEnabled()) {
    return HtmlService.createHtmlOutput(`
      <html><body style="font-family:sans-serif;display:flex;align-items:center;
      justify-content:center;height:100vh;margin:0;background:#1a1a18;color:#8a7a6a;">
        <div style="text-align:center;">
          <div style="font-size:32px;margin-bottom:16px;">🔒</div>
          <div style="font-size:18px;font-weight:700;color:#f0e8dc;margin-bottom:8px;">
            System Unavailable
          </div>
          <div style="font-size:13px;">
            The dashboard is currently offline for maintenance.<br>
            Contact your administrator for more information.
          </div>
        </div>
      </body></html>`)
      .setTitle('System Unavailable')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  const template = HtmlService.createTemplateFromFile('Dashboard');
  template.userRole   = '';
  template.userName   = '';
  template.employeeId = '';
  return template.evaluate()
    .setTitle('Student Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ────────────────────────────────────────────────────────────
// Master Data Fetch
// ────────────────────────────────────────────────────────────
// This is the "cold path" entry point called on initial page load.
// It checks the cache first — if the warming trigger has kept it
// fresh, this returns instantly without touching any sheets.
// ────────────────────────────────────────────────────────────
function getDashboardData() {
  try {
    const cache  = CacheService.getScriptCache();
    const cached = _cacheGetChunked(cache, 'dashboardData');
    if (cached) return JSON.parse(cached); return _rebuildDashboardData();
  } catch (err) { Logger.log('getDashboardData error: ' + err.message);
    return { error: err.message, profiles: [], metrics: {} };
  }
}

function refreshData() {
  _cacheRemoveChunked(CacheService.getScriptCache(), 'dashboardData');
  return _rebuildDashboardData();
}
function getStudentProfile(studentId) {
  try {
    studentId = String(studentId || '').trim();
    if (!studentId) return { error: 'No Student ID provided.' };
 
    const data = getDashboardData();
    if (data.error) return { error: 'Could not load data: ' + data.error };
 
    const profile = (data.profiles || []).find(p =>
      String(p.academicId || '').trim() === studentId ||
      String(p.tradesId   || '').trim() === studentId ||
      String(p.id         || '').trim() === studentId
    );
 
    if (!profile) return { error: null, profile: null };
 
    return { error: null, profile };
 
  } catch(e) {
    Logger.log('getStudentProfile error: ' + e.message);
    return { error: 'Something went wrong. Please try again.' };
  }
}

// ────────────────────────────────────────────────────────────
// Internal: actually rebuild the dashboard payload and cache it.
// Shared by getDashboardData (cold path), refreshData, and the
// time-based warming trigger.
// ────────────────────────────────────────────────────────────
function _rebuildDashboardData() {
  const cache = CacheService.getScriptCache();
  const hubSS = SpreadsheetApp.openById(SS_HUB);
  const nameMap          = getNameMapping(hubSS);
  const hsData           = getHighSchoolData(hubSS);
  const hisetData        = getHisetData(hubSS);
  const tradesData       = getTradesData(hubSS);
  const timeData         = getTimeData(hubSS);
  const tradeMonthlyData = getTradeMonthlyData(hubSS);
  const overrides        = getOverrides(hubSS);
  const wirData          = getWIRData();
  const scheduleData     = getScheduleData(hubSS);

  if (wirData && wirData.rows && wirData.rows.length) {
    try {
      const wirCache     = CacheService.getScriptCache();
      const lastWIRSheet = wirCache.get('lastWIRSheetName');
      if (lastWIRSheet !== wirData.sheetName) {
        appendToWIRLog(wirData, hubSS);
        wirCache.put('lastWIRSheetName', wirData.sheetName, CACHE_TTL);
        Logger.log('WIR log appended for new sheet: ' + wirData.sheetName);
      } else {
        Logger.log('WIR log skipped — sheet unchanged: ' + wirData.sheetName);
      }
    } catch(e) {
      Logger.log('WIR log append failed (non-fatal): ' + e.message);
    }
  }
  const profiles = buildStudentProfiles(
    nameMap, hsData, hisetData, tradesData,
    timeData, wirData, tradeMonthlyData,
    overrides, scheduleData
  );

  const metrics = computeSummaryMetrics(profiles);
  try { writeProgressSnapshots(profiles, hubSS); } catch(e) {
    Logger.log('Snapshot write failed (non-fatal): ' + e.message);
  }
  const result = {
    profiles,
    metrics,
    wirWeekLabel: wirData ? wirData.weekLabel : null,
    lastUpdated:  new Date().toISOString()
  };
  try { _cachePutChunked(cache, 'dashboardData', JSON.stringify(result), CACHE_TTL); } catch(e) {
    Logger.log('Cache put failed (non-fatal): ' + e.message);
  }
  return result;
}

// ────────────────────────────────────────────────────────────
// Chunked cache helpers
// ────────────────────────────────────────────────────────────
// CacheService caps each value at ~100KB. As the student roster
// grows, the full dashboardData JSON can exceed that, causing
// "Argument too large: value" errors. These helpers split the
// JSON string across multiple numbered keys (dashboardData_0,
// dashboardData_1, ...) plus a small meta key recording the chunk
// count, and reassemble on read.
// ────────────────────────────────────────────────────────────
const CACHE_CHUNK_SIZE = 90000; // stay safely under the ~100KB cap

function _cachePutChunked(cache, key, str, ttl) {
  const chunks = [];
  for (let i = 0; i < str.length; i += CACHE_CHUNK_SIZE) {
    chunks.push(str.slice(i, i + CACHE_CHUNK_SIZE));
  }

  // putAll caps out at 100 keys per call (plus our _meta key).
  // If the dataset is this large, caching it isn't going to help
  // anyway — skip caching rather than fail noisily.
  if (chunks.length > 99) {
    Logger.log('Dashboard data too large to cache (' + chunks.length + ' chunks) — skipping cache.');
    _cacheRemoveChunked(cache, key);
    return;
  }
  // Clear any previously-larger chunk set before writing the new one
  _cacheRemoveChunked(cache, key);
  const entries = {};
  entries[key + '_meta'] = String(chunks.length);
  chunks.forEach((chunk, i) => { entries[key + '_' + i] = chunk; });

  cache.putAll(entries, ttl);
}

function _cacheGetChunked(cache, key) {
  const meta = cache.get(key + '_meta');
  if (!meta) return null;
  const count = parseInt(meta, 10);
  if (!count || isNaN(count)) return null;
  const keys = [];
  for (let i = 0; i < count; i++) keys.push(key + '_' + i);
  const parts = cache.getAll(keys);
  let result = '';
  for (let i = 0; i < count; i++) {
    const part = parts[key + '_' + i];
    if (part === undefined || part === null) return null; // partial/expired — treat as miss
    result += part;
  }
  return result;
}

function _cacheRemoveChunked(cache, key) {
  const meta = cache.get(key + '_meta');
  if (!meta) {
    cache.remove(key); // legacy single-key cleanup, harmless if absent
    return;
  }
  const count = parseInt(meta, 10) || 0;
  const keys = [key + '_meta'];
  for (let i = 0; i < count; i++) keys.push(key + '_' + i);
  cache.removeAll(keys);
}

// ────────────────────────────────────────────────────────────
// Cache warming
// ────────────────────────────────────────────────────────────
// With 30-min cache TTL and a 10-min warming interval, the cache
// gets rebuilt roughly every 10 minutes regardless of whether anyone
// is actively viewing the dashboard — so the *first* person to load
// it after a data change rarely hits a cold cache and a full rebuild.
//
// Run installCacheWarmingTrigger() once (from the Apps Script editor,
// select it from the function dropdown and click Run) to set this up.
// Run removeCacheWarmingTrigger() to undo it.
// ────────────────────────────────────────────────────────────
function keepDashboardCacheWarm() {
  try {
    _rebuildDashboardData();
    const now = new Date().toISOString();
    Logger.log('Cache warmed at ' + now);

    // Write timestamp to admin spreadsheet so dashboard can show it
    try {
      const adminSS = SpreadsheetApp.openById(SS_ADMIN);
      const sheet   = adminSS.getSheetByName(SHEET_SYSTEM_CONFIG);
      if (sheet) {
        const values = sheet.getDataRange().getValues();
        let found = false;
        for (let i = 0; i < values.length; i++) {
          if (String(values[i][0]).trim() === 'LastCacheWarm') {
            sheet.getRange(i + 1, 2).setValue(now);
            found = true;
            break;
          }
        }
        if (!found) {
          sheet.appendRow(['LastCacheWarm', now]);
        }
      }
    } catch(e2) {
      Logger.log('Could not write LastCacheWarm timestamp (non-fatal): ' + e2.message);
    }

  } catch (e) {
    Logger.log('Cache warming failed (non-fatal): ' + e.message);
  }
}
function installCacheWarmingTrigger() {
  removeCacheWarmingTrigger(); // avoid duplicates
  ScriptApp.newTrigger('keepDashboardCacheWarm')
    .timeBased()
    .everyMinutes(10)
    .create();
  Logger.log('Cache warming trigger installed (every 10 min).');
}
// ────────────────────────────────────────────────────────────
// Scheduled Weekly Digest
// ────────────────────────────────────────────────────────────
// Runs automatically every Monday at 8am (Central).
// Recipients are stored in a named range or a dedicated cell
// in the hub spreadsheet so staff can update them without
// touching code.
//
// Setup:
//   1. In SS_HUB, go to any sheet and put email addresses
//      in a column, one per row, starting at the cell you
//      specify in DIGEST_RECIPIENTS_RANGE below.
//   2. Run installDigestTrigger() once from the editor.
//   3. Run removeDigestTrigger() to stop it.
// ────────────────────────────────────────────────────────────
const DIGEST_RECIPIENTS_SHEET = 'Manual Overrides'; // reuse hub

function getDigestRecipients() {
  try {
    const hubSS  = SpreadsheetApp.openById(SS_HUB);

    // Try a dedicated named range first ('DigestRecipients')
    try {
      const named = hubSS.getRangeByName('DigestRecipients');
      if (named) {
        const vals = named.getValues().flat()
          .map(v => String(v || '').trim())
          .filter(v => v.includes('@'));
        if (vals.length) return vals;
      }
    } catch(e) { /* no named range — fall through */ }

    // Fall back to a hardcoded list in Code.gs
    // Replace these with real addresses or leave empty to
    // rely solely on the named range.
    const FALLBACK_RECIPIENTS = [
      // 'coordinator@tulsajobcorps.gov',
      // 'director@tulsajobcorps.gov',
    ];

    return FALLBACK_RECIPIENTS.filter(e => e.includes('@'));

  } catch(e) {
    Logger.log('getDigestRecipients error: ' + e.message);
    return [];
  }
}

function scheduledWeeklyDigest() {
  try {
    const recipients = getDigestRecipients();

    if (!recipients.length) {
      Logger.log('Scheduled digest skipped — no recipients configured.');
      return;
    }

    const result = sendDigest(recipients, ROLES.ADMIN);
    Logger.log('Scheduled digest sent: ' + JSON.stringify(result));

  } catch(e) {
    Logger.log('Scheduled digest error: ' + e.message);
    // Non-fatal — log and continue. Apps Script will retry
    // on the next trigger run if this was a transient error.
  }
}

function installDigestTrigger() {
  removeDigestTrigger(); // avoid duplicates

  ScriptApp.newTrigger('scheduledWeeklyDigest')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)         // 8am in the script timezone (set to Central in project settings)
    .create();

  Logger.log('Weekly digest trigger installed — runs every Monday at 8am.');
}

function removeDigestTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'scheduledWeeklyDigest') {
      ScriptApp.deleteTrigger(t);
    }
  });
}
function removeCacheWarmingTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'keepDashboardCacheWarm') {
      ScriptApp.deleteTrigger(t);
    }
  });
}
// ────────────────────────────────────────────────────────────
// Email Digest
// ────────────────────────────────────────────────────────────
// Recipients are passed in from the dashboard UI — staff enter
// one or more email addresses in the digest modal before sending.
// ────────────────────────────────────────────────────────────
function sendDigest(recipientList, role) {
  _requirePermission(role || ROLES.ADMIN, 'send_digest');
  const data = getDashboardData();
  if (data.error) throw new Error('Could not load dashboard data: ' + data.error);

  const profiles = data.profiles || [];
  const metrics  = data.metrics  || {};
  const highRisk = profiles.filter(p => p.risk && p.risk.level === 'HIGH')
                           .sort((a, b) => b.risk.score - a.risk.score);

  const now       = new Date();
  const dateLabel = Utilities.formatDate(now, Session.getScriptTimeZone(), 'MMMM d, yyyy');

  // ── Build HTML email ─────────────────────────────────────
  const rows = highRisk.map(p => {
    const acPct  = p.academic  ? (p.academic.percent  !== null ? p.academic.percent.toFixed(0)  + '%' : '—') : '—';
    const trPct  = p.trades && p.trades.length ? (p.trades[0].overallPct !== null ? p.trades[0].overallPct.toFixed(0) + '%' : '—') : '—';
    const trade  = p.tradeNameOverride || (p.trades && p.trades.length ? p.trades[0].tarName : '') || (p.tradeComplete ? (p.completedTrades || []).join(', ') : '—');
    const wir    = p.intervention ? (p.intervention.adminPriority || p.intervention.priority || '—') : '—';
    const trend  = p.riskTrend === 'up' ? '▲' : p.riskTrend === 'down' ? '▼' : p.riskTrend === 'stable' ? '→' : '';
    const flags  = (p.risk.flags || []).slice(0, 3).map(f => `<li style="margin:2px 0;color:#555;">${f}</li>`).join('');
    const stale  = p.isStale ? '<span style="background:#fff3cd;color:#856404;padding:1px 6px;border-radius:4px;font-size:11px;">⏸ Stale</span>' : '';
      return `<tr style="border-bottom:1px solid #eee;">
    <td style="padding:10px 12px;font-weight:600;color:#1a1a2e;min-width:160px;">
      ${p.displayName}<br>
      <span style="font-size:11px;color:#888;">${p.academicId ? 'ID: ' + p.academicId : ''}</span>
      ${stale}
    </td>
    <td style="padding:10px 12px;text-align:center;">
      <span style="background:#fde8e8;color:#c0392b;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;">
        ${p.risk.score} ${trend}
      </span>
    </td>
    <td style="padding:10px 12px;text-align:center;color:#444;">${acPct}</td>
    <td style="padding:10px 12px;text-align:center;color:#444;">
      ${trade}<br><span style="color:#888;font-size:11px;">${trPct}</span>
    </td>
    <td style="padding:10px 12px;text-align:center;color:#444;">${wir}</td>
    <td style="padding:10px 12px;font-size:11px;color:#555;min-width:200px;">
      <ul style="margin:0;padding-left:16px;">${flags}</ul>
    </td>
  </tr>`;
}).join('');
  
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    margin: 0;
    padding: 0;
    background: #ffffff;
    -webkit-font-smoothing: antialiased;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  .summary td {
    padding: 12px;
    text-align: center;
    border-left: 1px solid #eee;
  }

  .summary td:first-child {
    border-left: none;
  }

  .title {
    background: linear-gradient(135deg,#1a1a3e,#2d2d6b);
    padding: 24px 28px;
    color: white;
  }

  .title h1 {
    margin: 0;
    font-size: 20px;
  }

  .title p {
    margin: 4px 0 0 0;
    font-size: 12px;
    color: #cfcff5;
  }

  thead tr {
    background: #f3f4f6;
    border-bottom: 2px solid #dcdcdc;
  }

  th {
    padding: 10px 14px;
    text-align: left;
    font-size: 12px;
    color: #333;
  }

  tbody tr {
    border-bottom: 1px solid #e6e6e6;
  }

  td {
    padding: 12px 14px;
    vertical-align: top;
    font-size: 13px;
    color: #333;
  }

  .risk-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
  }

  .high { background: #c0392b; }
  .med { background: #e67e22; }
  .low { background: #2ecc71; }

  .student-name {
    font-weight: 600;
    color: #1a1a1a;
  }

  .student-id {
    font-size: 11px;
    color: #666;
    margin-top: 3px;
  }

  .trade-sub {
    font-size: 11px;
    color: #666;
    margin-top: 2px;
  }

  .footer {
    background: #f8f8f8;
    padding: 14px 28px;
    font-size: 11px;
    color: #888;
    border-top: 1px solid #e6e6e6;
  }
</style>
</head>

<body>

<!-- HEADER -->
<div class="title">
  <h1>🎓 Student Dashboard Digest</h1>
  <p>Tulsa Job Corps — ${dateLabel}</p>
</div>

<!-- SUMMARY -->
<table class="summary" style="border-bottom:1px solid #ddd;">
  <tr>
    <td>
      <div style="font-size:22px;font-weight:700;color:#c0392b;">
        ${metrics.riskCounts ? metrics.riskCounts.HIGH || 0 : highRisk.length}
      </div>
      <div style="font-size:11px;color:#666;">High Risk</div>
    </td>

    <td>
      <div style="font-size:22px;font-weight:700;color:#e67e22;">
        ${metrics.riskCounts ? metrics.riskCounts.MEDIUM || 0 : 0}
      </div>
      <div style="font-size:11px;color:#666;">Medium Risk</div>
    </td>

    <td>
      <div style="font-size:22px;font-weight:700;color:#333;">
        ${metrics.withIntervention || 0}
      </div>
      <div style="font-size:11px;color:#666;">Open WIR</div>
    </td>

    <td>
      <div style="font-size:22px;font-weight:700;color:#555;">
        ${profiles.filter(p => p.isStale).length}
      </div>
      <div style="font-size:11px;color:#666;">Stale Data</div>
    </td>
  </tr>
</table>

<!-- HIGH RISK TABLE -->
<div style="padding:20px 28px;">
  <div style="font-size:14px;font-weight:700;margin-bottom:10px;color:#1a1a1a;">
    🔴 High Risk Students (${highRisk.length})
  </div>

  ${
    highRisk.length === 0
      ? '<p style="color:#777;font-style:italic;">No high-risk students this period.</p>'
      : `
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th style="text-align:center;">Risk</th>
            <th style="text-align:center;">Acad %</th>
            <th style="text-align:center;">Trade</th>
            <th style="text-align:center;">WIR</th>
            <th>Flags</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>
      </table>
      `
  }
</div>

<!-- FOOTER -->
<div class="footer">
  Sent from Student Dashboard · Tulsa Job Corps · ${dateLabel}
</div>

</body>
</html>`;
  // ── Send ─────────────────────────────────────────────────
  const recipients = (recipientList || [])
    .map(e => String(e).trim())
    .filter(e => e.includes('@'));
  if (!recipients.length) throw new Error('No recipients configured. Add email addresses to DIGEST_RECIPIENTS in Code.gs.');
  recipients.forEach(email => {
    GmailApp.sendEmail(email, `[Dashboard] ${highRisk.length} High Risk Students — ${dateLabel}`, '', {
      htmlBody: html,
      name: 'Student Dashboard',
    });
  });
  Logger.log('Digest sent to ' + recipients.join(', '));
  return { success: true, sent: recipients.length, highRisk: highRisk.length };
}

// ────────────────────────────────────────────────────────────
// SCHEDULE — Add these functions to Code.gs
// ────────────────────────────────────────────────────────────

const SHEET_SCHEDULE = 'Weekly Schedule';

/**
 * Called from the dashboard when staff uploads the weekly XLS.
 * Receives parsed schedule data as JSON and writes it to the
 * Weekly Schedule sheet in the hub spreadsheet.
 *
 * @param {string} scheduleJson - JSON string of parsed schedule data
 * @returns {Object} { success, weekLabel, studentCount }
 */
function saveWeeklySchedule(base64Data, role) {
  _requirePermission(role || ROLES.ADMIN, 'manage_overrides');
  try {
    // ── Save base64 to Drive as temp file ────────────────────
    const decoded  = Utilities.base64Decode(base64Data);
    const blob     = Utilities.newBlob(
      decoded,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'temp_schedule.xlsx'
    );
    const tempFile    = DriveApp.createFile(blob);
    const fileId      = tempFile.getId();

    // ── Convert to Google Sheet ───────────────────────────────
    const convertedFile = Drive.Files.copy(
      { title: 'temp_schedule_converted', mimeType: MimeType.GOOGLE_SHEETS },
      fileId
    );
    const convertedId = convertedFile.id;
    tempFile.setTrashed(true);

    let schedSS;
    try {
      schedSS = SpreadsheetApp.openById(convertedId);
    } catch(e) {
      try { DriveApp.getFileById(convertedId).setTrashed(true); } catch(e2) {}
      return { error: 'Could not open file. Please try again.' };
    }

    const allSheets = schedSS.getSheets();
    const isMaster  = allSheets.length > 5;

    // ── Day rules ─────────────────────────────────────────────
    // Period 4 = lunch, always excluded
    // Monday: skip Period 7
    // Wednesday: skip Period 7
    const VALID_PERIODS = {
      M:  [1, 2, 3, 5, 6],
      T:  [1, 2, 3, 5, 6, 7],
      W:  [1, 2, 3, 5, 6],
      TH: [1, 2, 3, 5, 6, 7],
      F:  [1, 2, 3, 5, 6, 7],
    };

    let weekLabel = 'This Week';
    let students  = [];
    let skipped   = [];

    if (isMaster) {
      // ── MASTER FORMAT ───────────────────────────────────────
      const DAY_COLS  = { M: 3, T: 5, W: 6, TH: 7, F: 8 };

      allSheets.forEach(sheet => {
        const values = sheet.getDataRange().getValues();

        // Extract week label from first sheet
        if (weekLabel === 'This Week') {
          for (let i = 0; i < Math.min(5, values.length); i++) {
            const cell  = String(values[i][1] || '');
            const match = cell.match(/As Of:\s+\w+,\s+(\w+\s+\d+,\s+\d+)/);
            if (match) {
              const d = new Date(match[1]);
              if (!isNaN(d.getTime())) {
                const day = d.getDay();
                const mon = new Date(d);
                mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
                const fri = new Date(mon);
                fri.setDate(mon.getDate() + 4);
                const fmt = dt => (dt.getMonth() + 1) + '/' + dt.getDate();
                weekLabel = fmt(mon) + ' – ' + fmt(fri) + '/' + fri.getFullYear();
              }
              break;
            }
          }
        }

        // Find student info row
        let studentInfo  = null;
        let dayHeaderIdx = null;
        for (let i = 0; i < values.length; i++) {
          if (String(values[i][2] || '').trim() === 'Student:') {
            studentInfo  = String(values[i][3] || '').trim();
            dayHeaderIdx = i + 1;
            break;
          }
        }

        if (!studentInfo) {
          skipped.push({ sheet: sheet.getName(), reason: 'No student info found' });
          return;
        }

        const lines = studentInfo.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          skipped.push({ sheet: sheet.getName(), reason: 'Could not parse student cell' });
          return;
        }

        const name = lines[0];
        const sid  = lines[1].trim();
        if (!/^\d{6,8}$/.test(sid)) {
          skipped.push({ sheet: sheet.getName(), name, reason: 'Invalid ID: ' + sid });
          return;
        }

        // Build schedule: { "Period 1": { M: {class, location}, T: {...}, ... } }
        const schedule = {};

        for (let i = dayHeaderIdx + 1; i < values.length; i++) {
          const row       = values[i];
          const periodNum = parseInt(row[2], 10);
          if (isNaN(periodNum) || periodNum === 4) continue;

          const periodKey = 'Period ' + periodNum;
          if (!schedule[periodKey]) schedule[periodKey] = {};

          Object.entries(DAY_COLS).forEach(([day, col]) => {
            if (!VALID_PERIODS[day].includes(periodNum)) return;
            const cell = String(row[col] || '').trim();
            if (!cell) return;
            const cellLines = cell.split('\n').map(l => l.trim()).filter(Boolean);
            schedule[periodKey][day] = {
              class:    cellLines[0] || '',
              location: cellLines[1] || '',
            };
          });
        }

        if (!Object.keys(schedule).length) {
          skipped.push({ sheet: sheet.getName(), name, id: sid, reason: 'No schedule entries found' });
          return;
        }

        students.push({ name, id: sid, schedule });
      });

    } else {
      // ── SIMPLIFIED FORMAT ────────────────────────────────────
      // Single sheet — schedule is same every day so replicate across all days
      const sheet  = allSheets[0];
      const values = sheet.getDataRange().getValues();

      const headerCell = String(values[0][2] || '');
      const dateMatch  = headerCell.match(/As Of:\s+\w+,\s+(\w+\s+\d+,\s+\d+)/);
      if (dateMatch) {
        const d = new Date(dateMatch[1]);
        if (!isNaN(d.getTime())) {
          const day = d.getDay();
          const mon = new Date(d);
          mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
          const fri = new Date(mon);
          fri.setDate(mon.getDate() + 4);
          const fmt = dt => (dt.getMonth() + 1) + '/' + dt.getDate();
          weekLabel = fmt(mon) + ' – ' + fmt(fri) + '/' + fri.getFullYear();
        }
      }

      const headerRow  = values[3];
      const periodCols = [];
      for (let c = 1; c < headerRow.length; c++) {
        const h = String(headerRow[c] || '').trim();
        if (!h) continue;
        const parts = h.split('\n').map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const periodNum = parseInt(parts[0], 10);
          if (!isNaN(periodNum) && periodNum !== 4) {
            periodCols.push({ index: c, periodNum });
          }
        }
      }

      for (let r = 4; r < values.length; r++) {
        const studentCell = String(values[r][0] || '').trim();
        if (!studentCell) continue;
        const lines = studentCell.split('\n').map(s => s.trim()).filter(Boolean);
        if (lines.length < 2) continue;
        const name = lines[0];
        const sid  = lines[1].trim();
        if (!/^\d{6,8}$/.test(sid)) continue;

        const schedule = {};
        periodCols.forEach(col => {
          const cell = String(values[r][col.index] || '').trim();
          if (!cell) return;
          const cellLines = cell.split('\n').map(s => s.trim()).filter(Boolean);
          const periodKey = 'Period ' + col.periodNum;
          if (!schedule[periodKey]) schedule[periodKey] = {};
          // Replicate same class across all valid days for this period
          Object.keys(VALID_PERIODS).forEach(day => {
            if (!VALID_PERIODS[day].includes(col.periodNum)) return;
            schedule[periodKey][day] = {
              class:    cellLines[0] || '',
              location: cellLines[1] || '',
            };
          });
        });

        if (Object.keys(schedule).length) {
          students.push({ name, id: sid, schedule });
        } else {
          skipped.push({ row: r + 1, name, id: sid, reason: 'No schedule entries' });
        }
      }
    }

    // ── Clean up ──────────────────────────────────────────────
    try { DriveApp.getFileById(convertedId).setTrashed(true); } catch(e2) {}

    if (!students.length) {
      return { error: 'No students found in the file.' };
    }

    // ── Write to Weekly Schedule sheet ───────────────────────
    // Simple 4-column structure: Week | Name | ID | Schedule JSON
    const hubSS    = SpreadsheetApp.openById(SS_HUB);
    let schedSheet = hubSS.getSheetByName(SHEET_SCHEDULE);
    if (!schedSheet) {
      schedSheet = hubSS.insertSheet(SHEET_SCHEDULE);
    }
    schedSheet.clearContents();

    const headers = ['Week', 'Student Name', 'Student ID', 'Schedule JSON'];
    const rows    = [headers];
    students.forEach(s => {
      rows.push([weekLabel, s.name, s.id, JSON.stringify(s.schedule)]);
    });

    schedSheet.getRange(1, 1, rows.length, 4).setValues(rows);
    schedSheet.getRange(1, 1, 1, 4).setFontWeight('bold');

    const schedCache = CacheService.getScriptCache();
    _cacheRemoveChunked(schedCache, 'dashboardData');

    // Clear individual student schedule caches
    // Get all student IDs from the rows we just wrote and remove their cache entries
    const cacheKeys = students.map(s => 'schedule_' + s.id);
    // removeAll caps at 100 keys — chunk if needed
    for (let i = 0; i < cacheKeys.length; i += 100) {
      schedCache.removeAll(cacheKeys.slice(i, i + 100));
    }

    return {
      success:      true,
      weekLabel,
      studentCount: students.length,
      skipped:      skipped,
      skippedCount: skipped.length,
    };

  } catch(e) {
    Logger.log('saveWeeklySchedule error: ' + e.message);
    return { error: 'Failed to save schedule: ' + e.message };
  }
}

/**
 * Returns the current week's schedule for a single student by ID.
 * Called from the student view.
 *
 * @param {string} studentId
 * @returns {Object} { weekLabel, timeSlots, schedule } or { error }
 */
function getStudentSchedule(studentId) {
  try {
    studentId = String(studentId || '').trim();
    if (!studentId) return { error: 'No student ID.' };

    // ── Check cache first ─────────────────────────────────────
    const cache     = CacheService.getScriptCache();
    const cacheKey  = 'schedule_' + studentId;
    const cached    = cache.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) { /* cache miss — fall through */ }
    }

    const hubSS = SpreadsheetApp.openById(SS_HUB);
    const sheet = hubSS.getSheetByName(SHEET_SCHEDULE);
    if (!sheet) return { weekLabel: null, schedule: null };

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return { weekLabel: null, schedule: null };

    const weekLabel = String(values[1][0] || '').trim();

    // Find student row by ID (col C, index 2)
    const row = values.slice(1).find(r => String(r[2] || '').trim() === studentId);
    if (!row) {
      const result = { weekLabel, schedule: null };
      cache.put(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    }

    // Parse schedule JSON
    let schedule = {};
    try {
      schedule = JSON.parse(String(row[3] || '{}'));
    } catch(e) {
      return { weekLabel, schedule: null };
    }

    // ── Day rules ─────────────────────────────────────────────
    const VALID_PERIODS = {
      M:  [1, 2, 3, 5, 6],
      T:  [1, 2, 3, 5, 6, 7],
      W:  [1, 2, 3, 5, 6],
      TH: [1, 2, 3, 5, 6, 7],
      F:  [1, 2, 3, 5, 6, 7],
    };

    const DAY_LABELS = { M: 'Monday', T: 'Tuesday', W: 'Wednesday', TH: 'Thursday', F: 'Friday' };
    const JS_DAY_MAP = { 1: 'M', 2: 'T', 3: 'W', 4: 'TH', 5: 'F' };
    const ACADEMIC_NAMES = ['HSD 2', 'HSD3', 'HSE/HSD1'];

    // ── Today's schedule ──────────────────────────────────────
    const jsDay    = new Date().getDay();
    const todayKey = JS_DAY_MAP[jsDay] || null;
    const isWeekend = !todayKey;

    let todaySchedule      = null;
    let expectedTodayHours = null;
    let expectedWeekHours  = 0;

    // Count expected weekly academic hours
    Object.entries(VALID_PERIODS).forEach(([day, validPeriods]) => {
      validPeriods.forEach(periodNum => {
        const entry = (schedule['Period ' + periodNum] || {})[day];
        if (!entry) return;
        if (ACADEMIC_NAMES.some(n => (entry.class || '').toLowerCase().includes(n.toLowerCase()))) {
          expectedWeekHours++;
        }
      });
    });

    // Build today's schedule
    if (!isWeekend && todayKey) {
      todaySchedule      = {};
      expectedTodayHours = 0;
      const validToday   = VALID_PERIODS[todayKey] || [];

      validToday.forEach(periodNum => {
        const entry = (schedule['Period ' + periodNum] || {})[todayKey];
        if (!entry || !entry.class) return;
        todaySchedule['Period ' + periodNum] = entry;
        if (ACADEMIC_NAMES.some(n => (entry.class || '').toLowerCase().includes(n.toLowerCase()))) {
          expectedTodayHours++;
        }
      });
    }

    const result = {
      weekLabel,
      schedule,
      todaySchedule,
      todayLabel:         todayKey ? DAY_LABELS[todayKey] : null,
      expectedWeekHours,
      expectedTodayHours,
      isWeekend,
    };

    // ── Cache the result ──────────────────────────────────────
    // Use a shorter TTL on weekdays since today's schedule
    // changes meaning as the day progresses
    const ttl = isWeekend ? CACHE_TTL : 600; // 10 min on weekdays, 30 min on weekends
    try { cache.put(cacheKey, JSON.stringify(result), ttl); } catch(e) { /* non-fatal */ }

    return result;

  } catch(e) {
    Logger.log('getStudentSchedule error: ' + e.message);
    return { error: 'Could not load schedule.' };
  }
}

// ────────────────────────────────────────────────────────────
// SCHEDULED HOURS
// Returns how many academic periods a student has scheduled
// this week based on the Weekly Schedule sheet.
// Only meaningful Monday–Friday.
// ────────────────────────────────────────────────────────────
const ACADEMIC_CLASS_NAMES = ['HSD 2', 'HSD3', 'HSE/HSD1'];

function getStudentScheduledHours(studentId) {
  try {
    studentId = String(studentId || '').trim();
    if (!studentId) return { error: 'No student ID.' };

    // Only run Monday–Friday
    const day = new Date().getDay(); // 0=Sun, 1=Mon ... 6=Sat
    if (day === 0 || day === 6) {
      return { scheduledAcademicHours: null, weekLabel: null, isWeekend: true };
    }

    const hubSS = SpreadsheetApp.openById(SS_HUB);
    const sheet = hubSS.getSheetByName(SHEET_SCHEDULE);
    if (!sheet) return { scheduledAcademicHours: null, weekLabel: null };

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return { scheduledAcademicHours: null, weekLabel: null };

    const headers   = values[0];
    const weekLabel = String(headers[0] || '').trim();

    // Find student row by ID (col C, index 2)
    const studentRow = values.slice(1).find(r =>
      String(r[2] || '').trim() === studentId
    );
    if (!studentRow) return { scheduledAcademicHours: null, weekLabel };

    // Count academic period cells
    // Headers from col D onwards come in pairs: "slot (Class)", "slot (Location)"
    // We only care about class columns (even indices starting at 3)
    let academicCount = 0;
    for (let c = 3; c < headers.length; c += 2) {
      const cellValue = String(studentRow[c] || '').trim();
      if (!cellValue) continue;
      const isAcademic = ACADEMIC_CLASS_NAMES.some(name =>
        cellValue.toLowerCase().includes(name.toLowerCase())
      );
      if (isAcademic) academicCount++;
    }

    return {
      scheduledAcademicHours: academicCount,
      weekLabel,
      isWeekend: false,
    };

  } catch(e) {
    Logger.log('getStudentScheduledHours error: ' + e.message);
    return { scheduledAcademicHours: null, weekLabel: null };
  }
}
