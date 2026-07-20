/* ============================================================
   ACHIEVEMENT BADGES
   ------------------------------------------------------------
   A permanent "Achievements" section on the profile. Each badge
   is computed fresh every load from data already in the profile
   object — nothing new from the backend needed. A badge glows/
   animates ONLY the very first time it's detected as earned
   (tracked in localStorage per student ID so it survives across
   sessions); after that first reveal it just sits in the shelf
   like any other earned badge, permanently.
   ============================================================ */

// Each badge: id (stable key for localStorage), icon, label, and a
// condition function receiving the full profile object p. Add new
// badges here — order shown matches array order.
const ACHIEVEMENT_DEFS = [
  {
    id: 'hs_complete',
    icon: '🎓',
    label: 'High School Complete',
    desc: 'Finished all HS coursework requirements.',
    when: p => !!p.hsComplete,
  },
  {
    id: 'trade_complete',
    icon: '🛠️',
    label: 'Trade Complete',
    desc: 'Finished your trade training program.',
    when: p => !!p.tradeComplete,
  },
  {
    id: 'both_complete',
    icon: '🏆',
    label: 'Fully Complete',
    desc: 'Finished both academics and trade training.',
    when: p => !!p.hsComplete && !!p.tradeComplete,
  },
  {
    id: 'trade_80',
    icon: '⚙️',
    label: 'Trade 80%+',
    desc: 'Reached 80% or higher in a trade program.',
    when: p => (p.trades || []).some(t => t.overallPct !== null && t.overallPct >= 80),
  },
  {
    id: 'trade_50',
    icon: '🔧',
    label: 'Trade Halfway There',
    desc: 'Reached 50% in a trade program.',
    when: p => (p.trades || []).some(t => t.overallPct !== null && t.overallPct >= 50),
  },
  {
    id: 'academic_halfway',
    icon: '📘',
    label: 'Academic Halfway There',
    desc: 'Reached 50% complete academically.',
    when: p => p.academic && p.academic.percent !== null && p.academic.percent >= 50,
  },
  {
    id: 'academic_almost_done',
    icon: '📗',
    label: 'Almost Done Academically',
    desc: '2 or fewer credits remaining.',
    when: p => p.academic && p.academic.credits !== null && p.academic.credits <= 2,
  },
  {
    id: 'on_track',
    icon: '✅',
    label: 'On Track',
    desc: 'Your progress score is in the On Track range.',
    when: p => p.risk && p.risk.level === 'LOW',
  },
  {
    id: 'tabe_math_levelup',
    icon: '🔢',
    label: 'Math Level-Up',
    desc: 'Moved up an EFL level in Math.',
    when: p => !!(p.tabe && p.tabe.math && p.tabe.math.previous &&
      p.tabe.math.current.efl > p.tabe.math.previous.efl),
  },
  {
    id: 'tabe_reading_levelup',
    icon: '📖',
    label: 'Reading Level-Up',
    desc: 'Moved up an EFL level in Reading.',
    when: p => !!(p.tabe && p.tabe.reading && p.tabe.reading.previous &&
      p.tabe.reading.current.efl > p.tabe.reading.previous.efl),
  },
];

const ACHIEVEMENTS_SEEN_KEY_PREFIX = 'tjcBadgesSeen_';

function buildAchievements(p) {
  const studentId = p.academicId || p.id || 'unknown';
  const seenKey = ACHIEVEMENTS_SEEN_KEY_PREFIX + studentId;
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(seenKey) || '[]'); } catch(e) { seen = []; }

  const earned = ACHIEVEMENT_DEFS.filter(def => {
    try { return def.when(p); } catch(e) { return false; }
  });

  if (!earned.length) return; // no achievements yet — section stays hidden

  const newlyEarnedIds = earned.filter(def => !seen.includes(def.id)).map(def => def.id);

  document.getElementById('sectionAchievements').classList.remove('hidden');
  const body = document.getElementById('achievementsBody');

  body.innerHTML = `<div class="badge-grid">${earned.map(def => {
    const isNew = newlyEarnedIds.includes(def.id);
    return `
      <div class="badge-card${isNew ? ' badge-new' : ''}" title="${esc(def.desc)}">
        <div class="badge-icon">${def.icon}</div>
        <div class="badge-label">${esc(def.label)}</div>
        ${isNew ? '<div class="badge-new-tag">New!</div>' : ''}
      </div>`;
  }).join('')}</div>`;

  // Mark everything currently earned as "seen" so the glow/tag never
  // shows again for these — the badge itself stays in the shelf
  // permanently, just without the first-time highlight.
  if (newlyEarnedIds.length) {
    const updatedSeen = [...new Set([...seen, ...earned.map(d => d.id)])];
    try { localStorage.setItem(seenKey, JSON.stringify(updatedSeen)); } catch(e) {}
  }
}
