import React, { useState, useEffect, useMemo, useCallback } from "react";

/* ============================================================================
   TLC — TRAINING DASHBOARD
   A self-progressing personal trainer in one file.
   - Pick a day type (Lift / Bike / Run / Recovery) — no fixed weekly split.
   - Lift days generate a full-body session from YOUR equipment.
   - Log actual weights/reps → next session's targets auto-adjust.
   - Log bodyweight, calories, and Garmin metrics → trend coaching.
   ========================================================================== */

/* ---------- palette: forge / iron, warm steel, ember accent ---------- */
const C = {
  bg: "#15171a",
  panel: "#1d2024",
  panel2: "#23272c",
  line: "#2e333a",
  ink: "#e9ecef",
  sub: "#9aa3ad",
  faint: "#6b7480",
  ember: "#e8743b",
  emberDim: "#b9551f",
  steel: "#7fa8c9",
  good: "#6fbf73",
  warn: "#e0b54a",
  bad: "#d8695b",
};

const FONT_DISPLAY = "'Oswald', 'Arial Narrow', sans-serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";

/* ============================================================================
   EQUIPMENT-CONSTRAINED EXERCISE LIBRARY
   Equipment: dumbbells ≤70, barbell ≤315, full cable, power rack, bench,
   assault bike. One exercise per major group per session.
   `load` tells the progression engine how to round increments.
   ========================================================================== */
/* `sec` = secondary muscles each movement recruits, used to de-conflict a
   session so two picks don't hammer the same helper muscle (e.g. bench +
   overhead press both tax triceps). Isolation lifts carry an empty list. */
const LIB = {
  legs: [
    { id: "bb_squat", name: "Barbell Back Squat", load: "barbell", inc: 5, start: 135, sec: ["lower_back", "glutes"] },
    { id: "bb_rdl", name: "Barbell Romanian Deadlift", load: "barbell", inc: 5, start: 135, sec: ["lower_back", "glutes"] },
    { id: "bb_fsquat", name: "Barbell Front Squat", load: "barbell", inc: 5, start: 95, sec: ["core"] },
    { id: "db_bulg", name: "DB Bulgarian Split Squat", load: "db_pair", inc: 5, start: 30, sec: ["glutes"] },
    { id: "bb_lunge", name: "Barbell Reverse Lunge", load: "barbell", inc: 5, start: 95, sec: ["glutes"] },
    { id: "db_rdl", name: "DB Romanian Deadlift", load: "db_pair", inc: 5, start: 45, sec: ["lower_back", "glutes"] },
  ],
  chest: [
    { id: "bb_bench", name: "Barbell Bench Press", load: "barbell", inc: 5, start: 115, sec: ["triceps", "front_delt"] },
    { id: "db_bench", name: "DB Bench Press", load: "db_pair", inc: 5, start: 45, sec: ["triceps", "front_delt"] },
    { id: "db_incl", name: "DB Incline Press", load: "db_pair", inc: 5, start: 40, sec: ["triceps", "front_delt"] },
    { id: "cable_fly", name: "Cable Fly", load: "cable", inc: 5, start: 25, sec: [] },
    { id: "bb_incl", name: "Barbell Incline Press", load: "barbell", inc: 5, start: 95, sec: ["triceps", "front_delt"] },
  ],
  shoulders: [
    { id: "bb_ohp", name: "Barbell Overhead Press", load: "barbell", inc: 5, start: 75, sec: ["triceps"] },
    { id: "db_ohp", name: "DB Shoulder Press", load: "db_pair", inc: 5, start: 35, sec: ["triceps"] },
    { id: "db_lat", name: "DB Lateral Raise", load: "db_pair", inc: 5, start: 15, sec: [] },
    { id: "cable_lat", name: "Cable Lateral Raise", load: "cable", inc: 5, start: 15, sec: [] },
  ],
  back: [
    { id: "bb_row", name: "Barbell Bent-Over Row", load: "barbell", inc: 5, start: 115, sec: ["biceps", "lower_back"] },
    { id: "db_row", name: "DB One-Arm Row", load: "db_single", inc: 5, start: 50, sec: ["biceps"] },
    { id: "cable_pull", name: "Cable Lat Pulldown", load: "cable", inc: 5, start: 90, sec: ["biceps"] },
    { id: "cable_row", name: "Seated Cable Row", load: "cable", inc: 5, start: 90, sec: ["biceps"] },
    { id: "bb_dl", name: "Barbell Deadlift", load: "barbell", inc: 10, start: 185, sec: ["lower_back", "glutes"] },
  ],
  biceps: [
    { id: "db_curl", name: "DB Bicep Curl", load: "db_pair", inc: 5, start: 25, sec: [] },
    { id: "bb_curl", name: "Barbell Curl", load: "barbell", inc: 5, start: 55, sec: [] },
    { id: "cable_curl", name: "Cable Curl", load: "cable", inc: 5, start: 40, sec: [] },
    { id: "db_ham", name: "DB Hammer Curl", load: "db_pair", inc: 5, start: 25, sec: ["forearms"] },
  ],
  triceps: [
    { id: "cable_push", name: "Cable Tricep Pushdown", load: "cable", inc: 5, start: 50, sec: [] },
    { id: "db_skull", name: "DB Skullcrusher", load: "db_pair", inc: 5, start: 20, sec: [] },
    { id: "bb_close", name: "Close-Grip Bench Press", load: "barbell", inc: 5, start: 95, sec: ["front_delt"] },
    { id: "cable_oh", name: "Cable Overhead Extension", load: "cable", inc: 5, start: 40, sec: [] },
  ],
};

const GROUPS = ["legs", "chest", "shoulders", "back", "biceps", "triceps"];
const GROUP_LABEL = {
  legs: "Legs", chest: "Chest", shoulders: "Shoulders",
  back: "Back", biceps: "Biceps", triceps: "Triceps",
};

/* equipment ceilings for sanity-capping suggestions */
const CAPS = { barbell: 315, db_pair: 70, db_single: 70, cable: 200 };

/* default rep scheme — hypertrophy-leaning per your "bigger & stronger slowly" goal */
const REP_SCHEME = { sets: 3, repLow: 8, repHigh: 12 };

/* ---------- date helpers ---------- */
const todayKey = () => new Date().toISOString().slice(0, 10);
const fmtDate = (k) =>
  new Date(k + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/* ============================================================================
   STORAGE — browser localStorage, namespaced.
   Data lives on THIS device only, so two people on two phones never mix.
   Kept async-compatible so the rest of the app is unchanged.
   ========================================================================== */
const K = {
  state: (k) => storeGet(k),
  set: (k, v) => storeSet(k, v),
  list: (p) => storeList(p),
};
async function storeGet(key) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
async function storeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
async function storeList(prefix) {
  try {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) out.push(k);
    }
    return out;
  } catch { return []; }
}

/* ============================================================================
   PROGRESSION ENGINE
   Looks back at the most recent logged session for each exercise and decides
   the next target weight. Double-progression: fill the rep range, then add load.
   ========================================================================== */
function nextTarget(ex, lastLog) {
  // lastLog: { weight, reps: [r1,r2,r3], hitAll:bool } or null
  const cap = CAPS[ex.load] || 9999;
  if (!lastLog) return { weight: Math.min(ex.start, cap), note: "starting load" };

  const { weight, reps } = lastLog;
  const minReps = Math.min(...reps.filter((r) => r != null && r !== ""));
  const allHigh = reps.every((r) => Number(r) >= REP_SCHEME.repHigh);
  const anyMiss = reps.some((r) => Number(r) < REP_SCHEME.repLow);

  if (allHigh) {
    const w = Math.min(weight + ex.inc, cap);
    return { weight: w, note: w === weight ? "at equipment cap — add reps" : `+${ex.inc} lb (hit top of range)` };
  }
  if (anyMiss) {
    // missed bottom of range twice in a row → deload 10%
    return { weight: weight, note: "repeat — chase the rep range" };
  }
  return { weight, note: "same load, push for more reps" };
}

/* ranked candidate list for a group, least-recently-used first (for variety),
   with a small seed rotation so two consecutive sessions differ */
function rankedCandidates(group, seed, history) {
  const opts = LIB[group];
  const lastUsed = {};
  opts.forEach((o) => (lastUsed[o.id] = -1));
  history.forEach((h, i) => { if (lastUsed[h] !== undefined) lastUsed[h] = i; });
  const sorted = [...opts].sort((a, b) => lastUsed[a.id] - lastUsed[b.id]);
  // rotate the two freshest options so variety alternates session to session
  if (sorted.length >= 2 && seed % 2 === 1) [sorted[0], sorted[1]] = [sorted[1], sorted[0]];
  return sorted;
}

/* Build a full-body session that avoids overloading the same secondary muscle.
   Groups are chosen in an order that puts the biggest compound pushes/pulls
   first; each later pick is penalized for re-using a secondary muscle that an
   earlier pick already taxed. Falls back to the freshest option if every
   candidate conflicts (so a session is always returned). */
function buildSession(seed, groupHistory, lastLogFor) {
  // order matters: lock the heavy compounds first, then fit isolations around them
  const order = ["legs", "back", "chest", "shoulders", "triceps", "biceps"];
  const usedSecondary = {}; // muscle -> count already loaded this session
  const session = {};
  const newGH = { ...groupHistory };

  order.forEach((g) => {
    const cands = rankedCandidates(g, seed, groupHistory[g] || []);
    let best = cands[0], bestScore = Infinity;
    cands.forEach((ex, idx) => {
      // conflict cost: how many of this exercise's secondaries are already taxed
      const conflict = (ex.sec || []).reduce((a, m) => a + (usedSecondary[m] || 0), 0);
      // freshness cost: prefer earlier (less-recently-used) candidates
      const score = conflict * 10 + idx;
      if (score < bestScore) { bestScore = score; best = ex; }
    });
    (best.sec || []).forEach((m) => (usedSecondary[m] = (usedSecondary[m] || 0) + 1));
    const tgt = nextTarget(best, lastLogFor(best.id));
    session[g] = { exId: best.id, name: best.name, group: g, weight: tgt.weight, note: tgt.note,
      sec: best.sec || [], actual: { weight: "", reps: ["", "", ""] } };
    newGH[g] = [...(groupHistory[g] || []), best.id].slice(-6);
  });

  return { session, newGH };
}

/* ============================================================================
   UI PRIMITIVES
   ========================================================================== */
const Panel = ({ children, style, pad = 18 }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: pad, ...style }}>
    {children}
  </div>
);

const Eyebrow = ({ children }) => (
  <div style={{ font: `600 11px/1 ${FONT_DISPLAY}`, letterSpacing: "0.18em", textTransform: "uppercase", color: C.ember, marginBottom: 10 }}>
    {children}
  </div>
);

const Btn = ({ children, onClick, active, kind = "ghost", style, disabled }) => {
  const base = {
    font: `600 13px ${FONT_BODY}`, padding: "9px 14px", borderRadius: 8, cursor: disabled ? "default" : "pointer",
    border: `1px solid ${C.line}`, transition: "all .15s", letterSpacing: ".01em", opacity: disabled ? 0.4 : 1,
  };
  const kinds = {
    ghost: { background: active ? C.ember : C.panel2, color: active ? "#15171a" : C.ink, borderColor: active ? C.ember : C.line },
    solid: { background: C.ember, color: "#15171a", borderColor: C.ember },
    quiet: { background: "transparent", color: C.sub },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...kinds[kind], ...style }}
      onMouseEnter={(e) => !active && !disabled && (e.currentTarget.style.borderColor = C.ember)}
      onMouseLeave={(e) => !active && (e.currentTarget.style.borderColor = kinds[kind].borderColor || C.line)}>
      {children}
    </button>
  );
};

const Stat = ({ label, value, unit, tone }) => (
  <div style={{ flex: 1, minWidth: 90 }}>
    <div style={{ font: `500 10px/1 ${FONT_DISPLAY}`, letterSpacing: ".14em", textTransform: "uppercase", color: C.faint, marginBottom: 6 }}>{label}</div>
    <div style={{ font: `600 26px/1 ${FONT_DISPLAY}`, color: tone || C.ink }}>
      {value}<span style={{ font: `500 12px ${FONT_BODY}`, color: C.sub, marginLeft: 4 }}>{unit}</span>
    </div>
  </div>
);

/* tiny sparkline */
const Spark = ({ data, color = C.steel, w = 220, h = 48 }) => {
  if (!data || data.length < 2) return <div style={{ color: C.faint, font: `400 12px ${FONT_BODY}`, padding: "14px 0" }}>Log a few days to see a trend.</div>;
  const ys = data.map((d) => d.v);
  const min = Math.min(...ys), max = Math.max(...ys);
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.v - min) / range) * (h - 6) - 3;
    return [x, y];
  });
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.2" fill={color} />
    </svg>
  );
};

/* least-squares slope+intercept over index for a dashed trend line */
function linReg(vals) {
  const n = vals.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  vals.forEach((v, i) => { sx += i; sy += v; sxy += i * v; sxx += i * i; });
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

/* full chart: dated x-axis, value y-axis, gridlines, optional dashed trend line, hover dots */
const Chart = ({ data, color = C.steel, height = 170, unit = "", showTrend = true, fmtY }) => {
  const [hover, setHover] = useState(null);
  if (!data || data.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center",
        color: C.faint, font: `400 13px ${FONT_BODY}`, border: `1px dashed ${C.line}`, borderRadius: 8 }}>
        Log at least two days to draw this trend.
      </div>
    );
  }
  const W = 640, H = height;
  const padL = 44, padR = 14, padT = 14, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  const ys = data.map((d) => d.v);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.12;
  min -= pad; max += pad;
  const range = max - min;

  const X = (i) => padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const Y = (v) => padT + innerH - ((v - min) / range) * innerH;

  const pts = data.map((d, i) => [X(i), Y(d.v)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${(padT + innerH).toFixed(1)} L${pts[0][0].toFixed(1)},${(padT + innerH).toFixed(1)} Z`;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => min + (range * i) / yTicks);
  const fy = fmtY || ((v) => (Math.abs(v) >= 100 ? Math.round(v) : v.toFixed(1)));

  // x labels: first, middle, last
  const xIdx = [0, Math.floor((data.length - 1) / 2), data.length - 1];

  const reg = showTrend ? linReg(ys) : null;
  const gid = "g_" + color.replace("#", "");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}
      onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* gridlines + y labels */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={Y(t)} x2={W - padR} y2={Y(t)} stroke={C.line} strokeWidth="1" />
          <text x={padL - 8} y={Y(t) + 3.5} textAnchor="end"
            style={{ font: `500 10px ${FONT_DISPLAY}`, fill: C.faint }}>{fy(t)}</text>
        </g>
      ))}

      {/* area + line */}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

      {/* dashed regression trend line */}
      {reg && (
        <line x1={X(0)} y1={Y(reg.intercept)} x2={X(data.length - 1)} y2={Y(reg.intercept + reg.slope * (data.length - 1))}
          stroke={C.ember} strokeWidth="1.4" strokeDasharray="5 4" opacity="0.85" />
      )}

      {/* x labels */}
      {xIdx.map((i) => (
        <text key={i} x={X(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
          style={{ font: `500 10px ${FONT_DISPLAY}`, fill: C.faint }}>
          {new Date(data[i].k + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </text>
      ))}

      {/* hover layer */}
      {data.map((d, i) => (
        <rect key={i} x={X(i) - innerW / data.length / 2} y={padT} width={innerW / data.length} height={innerH}
          fill="transparent" onMouseEnter={() => setHover(i)} />
      ))}
      {hover != null && (
        <g>
          <line x1={X(hover)} y1={padT} x2={X(hover)} y2={padT + innerH} stroke={color} strokeWidth="1" opacity="0.4" />
          <circle cx={X(hover)} cy={Y(data[hover].v)} r="4" fill={color} stroke={C.bg} strokeWidth="1.5" />
          <g transform={`translate(${Math.min(Math.max(X(hover), padL + 38), W - padR - 38)}, ${padT + 4})`}>
            <rect x={-38} y={-2} width={76} height={34} rx="5" fill={C.panel2} stroke={C.line} />
            <text x={0} y={11} textAnchor="middle" style={{ font: `600 12px ${FONT_DISPLAY}`, fill: C.ink }}>
              {fy(data[hover].v)}{unit}
            </text>
            <text x={0} y={24} textAnchor="middle" style={{ font: `400 9px ${FONT_BODY}`, fill: C.faint }}>
              {new Date(data[hover].k + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
};

const Input = ({ value, onChange, placeholder, w = 70, type = "number" }) => (
  <input type={type} value={value ?? ""} placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    style={{ width: w, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 6, color: C.ink,
      font: `500 14px ${FONT_BODY}`, padding: "8px 9px", outline: "none" }}
    onFocus={(e) => (e.target.style.borderColor = C.ember)}
    onBlur={(e) => (e.target.style.borderColor = C.line)} />
);

/* ============================================================================
   MAIN
   ========================================================================== */
export default function App() {
  const [tab, setTab] = useState("today");
  const [loaded, setLoaded] = useState(false);

  // core persisted state
  const [logs, setLogs] = useState({});          // exerciseId -> [{date, weight, reps:[], group}]
  const [days, setDays] = useState({});           // dateKey -> { type, sessionId?, garmin?, body?, intake? }
  const [sessionCount, setSessionCount] = useState(0);
  const [groupHistory, setGroupHistory] = useState({}); // group -> [exerciseId,...]

  const today = todayKey();
  const todayDay = days[today] || {};

  /* ---------- load ---------- */
  useEffect(() => {
    (async () => {
      const [l, d, sc, gh] = await Promise.all([
        K.state("tlc:logs"), K.state("tlc:days"), K.state("tlc:scount"), K.state("tlc:ghist"),
      ]);
      if (l) setLogs(l);
      if (d) setDays(d);
      if (sc) setSessionCount(sc);
      if (gh) setGroupHistory(gh);
      setLoaded(true);
    })();
  }, []);

  /* ---------- persist helpers ---------- */
  const saveLogs = (v) => { setLogs(v); K.set("tlc:logs", v); };
  const saveDays = (v) => { setDays(v); K.set("tlc:days", v); };
  const saveSC = (v) => { setSessionCount(v); K.set("tlc:scount", v); };
  const saveGH = (v) => { setGroupHistory(v); K.set("tlc:ghist", v); };

  /* ---------- last log per exercise ---------- */
  const lastLogFor = useCallback((exId) => {
    const arr = logs[exId];
    if (!arr || !arr.length) return null;
    return arr[arr.length - 1];
  }, [logs]);

  /* ---------- generate today's lift ---------- */
  const generateLift = () => {
    const { session, newGH } = buildSession(sessionCount, groupHistory, lastLogFor);
    saveDays({ ...days, [today]: { ...todayDay, type: "lift", session } });
    saveGH(newGH);
  };

  const setDayType = (type) => {
    const cur = days[today] || {};
    if (type === "lift" && !cur.session) {
      const { session, newGH } = buildSession(sessionCount, groupHistory, lastLogFor);
      saveDays({ ...days, [today]: { ...cur, type, session } });
      saveGH(newGH);
    } else {
      saveDays({ ...days, [today]: { ...cur, type } });
    }
  };

  /* ---------- swap an exercise within its group (skips picks that clash with
     the rest of today's session on a shared secondary muscle) ---------- */
  const swapExercise = (group) => {
    const cur = todayDay.session?.[group];
    if (!cur) return;
    const opts = LIB[group];
    // secondaries currently taxed by the OTHER exercises in this session
    const otherSec = {};
    Object.entries(todayDay.session).forEach(([g, ex]) => {
      if (g === group) return;
      (ex.sec || []).forEach((m) => (otherSec[m] = (otherSec[m] || 0) + 1));
    });
    const startIdx = opts.findIndex((o) => o.id === cur.exId);
    // walk the rotation, preferring the next option that adds the least conflict
    let pick = opts[(startIdx + 1) % opts.length];
    let best = Infinity;
    for (let i = 1; i <= opts.length; i++) {
      const ex = opts[(startIdx + i) % opts.length];
      const conflict = (ex.sec || []).reduce((a, m) => a + (otherSec[m] || 0), 0);
      if (conflict < best) { best = conflict; pick = ex; if (conflict === 0) break; }
    }
    const tgt = nextTarget(pick, lastLogFor(pick.id));
    const session = { ...todayDay.session, [group]: {
      exId: pick.id, name: pick.name, group, weight: tgt.weight, note: tgt.note,
      sec: pick.sec || [], actual: cur.actual,
    } };
    saveDays({ ...days, [today]: { ...todayDay, session } });
  };

  /* ---------- edit actual perf ---------- */
  const setActual = (group, field, value, repIdx) => {
    const s = todayDay.session;
    const ex = { ...s[group] };
    if (field === "weight") ex.actual = { ...ex.actual, weight: value };
    else { const reps = [...ex.actual.reps]; reps[repIdx] = value; ex.actual = { ...ex.actual, reps }; }
    saveDays({ ...days, [today]: { ...todayDay, session: { ...s, [group]: ex } } });
  };

  /* ---------- finish & log lift session ---------- */
  const finishLift = () => {
    const s = todayDay.session;
    const newLogs = { ...logs };
    GROUPS.forEach((g) => {
      const ex = s[g];
      const w = ex.actual.weight === "" ? ex.weight : Number(ex.actual.weight);
      const reps = ex.actual.reps.map((r) => (r === "" ? REP_SCHEME.repLow : Number(r)));
      const entry = { date: today, weight: w, reps, group: g };
      newLogs[ex.exId] = [...(newLogs[ex.exId] || []), entry];
    });
    saveLogs(newLogs);
    saveSC(sessionCount + 1);
    saveDays({ ...days, [today]: { ...todayDay, logged: true } });
  };

  /* ---------- daily metrics ---------- */
  const setMetric = (field, value) => {
    saveDays({ ...days, [today]: { ...todayDay, [field]: value } });
  };

  /* ---------- derived: trends ---------- */
  const [range, setRange] = useState(30); // days window for charts
  const sortedDayKeys = useMemo(() => Object.keys(days).sort(), [days]);

  const cutoffOk = useCallback((k) => {
    if (range === 0) return true; // all
    const diff = (Date.now() - new Date(k + "T00:00:00").getTime()) / 86400000;
    return diff <= range;
  }, [range]);

  const trend = useCallback((field) => sortedDayKeys
    .filter(cutoffOk)
    .map((k) => ({ k, v: Number(days[k]?.[field]) }))
    .filter((d) => !isNaN(d.v) && d.v > 0), [sortedDayKeys, days, cutoffOk]);

  // coaching uses a fixed recent window independent of the chart selector
  const bodyTrend = useMemo(() => sortedDayKeys
    .map((k) => ({ k, v: Number(days[k]?.body) })).filter((d) => !isNaN(d.v) && d.v > 0).slice(-30), [sortedDayKeys, days]);
  const intakeTrend = useMemo(() => sortedDayKeys
    .map((k) => ({ k, v: Number(days[k]?.intake) })).filter((d) => !isNaN(d.v) && d.v > 0).slice(-30), [sortedDayKeys, days]);

  // net calorie balance (eaten - burned) per day
  const balanceTrend = useMemo(() => sortedDayKeys.filter(cutoffOk).map((k) => {
    const eaten = Number(days[k]?.intake), burned = Number(days[k]?.burn);
    if (isNaN(eaten) || isNaN(burned) || (!eaten && !burned)) return null;
    return { k, v: eaten - burned };
  }).filter(Boolean), [sortedDayKeys, days, cutoffOk]);

  // total tonnage lifted per lift-day (sum of weight×reps across all exercises)
  const volumeTrend = useMemo(() => {
    const byDate = {};
    Object.values(logs).flat().forEach((e) => {
      const vol = e.reps.reduce((a, r) => a + (Number(r) || 0) * e.weight, 0);
      byDate[e.date] = (byDate[e.date] || 0) + vol;
    });
    return Object.keys(byDate).sort().filter(cutoffOk).map((k) => ({ k, v: Math.round(byDate[k]) }));
  }, [logs, cutoffOk]);

  /* ---------- coaching feedback ---------- */
  const coaching = useMemo(() => {
    const msgs = [];
    // bodyweight trend
    if (bodyTrend.length >= 4) {
      const first = bodyTrend[0].v, last = bodyTrend[bodyTrend.length - 1].v;
      const span = bodyTrend.length;
      const perWk = ((last - first) / span) * 7;
      if (perWk > 0.9) msgs.push({ tone: "warn", t: `Gaining ~${perWk.toFixed(1)} lb/wk. Faster than ideal for lean growth — trim intake ~150–200 cal if you want less fat with the muscle.` });
      else if (perWk >= 0.2) msgs.push({ tone: "good", t: `Bodyweight up ~${perWk.toFixed(1)} lb/wk — a clean lean-gain pace. Hold this.` });
      else if (perWk > -0.2) msgs.push({ tone: "warn", t: `Bodyweight flat. To grow, nudge intake up ~150 cal/day and recheck in two weeks.` });
      else msgs.push({ tone: "bad", t: `Trending down ~${Math.abs(perWk).toFixed(1)} lb/wk — you're losing, not building. Add ~250–300 cal/day.` });
    }
    // intake consistency
    if (intakeTrend.length >= 5) {
      const vals = intakeTrend.map((d) => d.v);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - avg) ** 2, 0) / vals.length);
      if (sd > avg * 0.22) msgs.push({ tone: "warn", t: `Intake is swinging a lot (avg ${Math.round(avg)} cal, ±${Math.round(sd)}). Consistency beats perfection for slow growth.` });
      else msgs.push({ tone: "good", t: `Intake is consistent (~${Math.round(avg)} cal/day). That steadiness is what drives the slow build.` });
    }
    // training frequency / cardio balance — last 7 days
    const last7 = sortedDayKeys.slice(-7).map((k) => days[k]?.type).filter(Boolean);
    const lifts = last7.filter((t) => t === "lift").length;
    const cardio = last7.filter((t) => t === "bike" || t === "run").length;
    const rest = last7.filter((t) => t === "recovery").length;
    if (last7.length >= 5) {
      if (cardio === 0) msgs.push({ tone: "warn", t: `No bike or run logged in your last ${last7.length} days. You wanted at least one a week — slot one in.` });
      if (lifts >= 5 && rest === 0) msgs.push({ tone: "warn", t: `${lifts} lift days, zero recovery. A rest or active-recovery day will let the growth actually happen.` });
      if (lifts >= 3 && cardio >= 1 && rest >= 1) msgs.push({ tone: "good", t: `Nice balance this week: ${lifts} lifts, ${cardio} cardio, ${rest} recovery.` });
    }
    // progressive overload wins
    let pr = 0;
    Object.values(logs).forEach((arr) => {
      if (arr.length >= 2 && arr[arr.length - 1].weight > arr[arr.length - 2].weight) pr++;
    });
    if (pr > 0) msgs.push({ tone: "good", t: `${pr} lift${pr > 1 ? "s" : ""} moved up in load recently. That's progressive overload doing its job.` });

    if (!msgs.length) msgs.push({ tone: "neutral", t: "Log bodyweight, calories, and a few sessions and I'll start coaching from your trends." });
    return msgs;
  }, [bodyTrend, intakeTrend, sortedDayKeys, days, logs]);

  /* ---------- streak ---------- */
  const streak = useMemo(() => {
    let s = 0;
    let d = new Date();
    for (;;) {
      const k = d.toISOString().slice(0, 10);
      if (days[k]?.type) { s++; d.setDate(d.getDate() - 1); } else break;
    }
    return s;
  }, [days]);

  if (!loaded) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.sub, fontFamily: FONT_BODY }}>
      Loading your training data…
    </div>
  );

  const DAY_TYPES = [
    { id: "lift", label: "Lift" },
    { id: "bike", label: "Bike" },
    { id: "run", label: "Run" },
    { id: "recovery", label: "Recovery" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.ink, fontFamily: FONT_BODY }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; } input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        button:focus-visible, input:focus-visible { outline: 2px solid ${C.ember}; outline-offset: 1px; }`}</style>

      {/* header */}
      <div style={{ borderBottom: `1px solid ${C.line}`, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ font: `700 22px/1 ${FONT_DISPLAY}`, letterSpacing: ".06em", textTransform: "uppercase" }}>
            The Forge<span style={{ color: C.ember }}>.</span>
          </div>
          <div style={{ font: `400 12px ${FONT_BODY}`, color: C.sub, marginTop: 3 }}>{fmtDate(today)} · personal training engine</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["today", "Today"], ["trends", "Trends"], ["log", "History"]].map(([id, label]) => (
            <Btn key={id} active={tab === id} onClick={() => setTab(id)}>{label}</Btn>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "20px 20px 60px" }}>

        {/* ============ TODAY ============ */}
        {tab === "today" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* day type picker */}
            <Panel>
              <Eyebrow>What are you doing today?</Eyebrow>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {DAY_TYPES.map((dt) => (
                  <Btn key={dt.id} active={todayDay.type === dt.id} onClick={() => setDayType(dt.id)}>{dt.label}</Btn>
                ))}
                {streak > 0 && (
                  <div style={{ marginLeft: "auto", alignSelf: "center", font: `600 12px ${FONT_BODY}`, color: C.ember }}>
                    🔥 {streak}-day streak
                  </div>
                )}
              </div>
            </Panel>

            {/* LIFT view */}
            {todayDay.type === "lift" && todayDay.session && (
              <Panel>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <Eyebrow>Full-Body Session</Eyebrow>
                  <div style={{ font: `400 11px ${FONT_BODY}`, color: C.faint }}>15-min treadmill warm-up first · {REP_SCHEME.sets}×{REP_SCHEME.repLow}–{REP_SCHEME.repHigh}</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {GROUPS.map((g) => {
                    const ex = todayDay.session[g];
                    return (
                      <div key={g} style={{ padding: "12px 0", borderBottom: `1px solid ${C.line}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                          <div>
                            <span style={{ font: `500 10px ${FONT_DISPLAY}`, letterSpacing: ".12em", textTransform: "uppercase", color: C.ember }}>{GROUP_LABEL[g]}</span>
                            <div style={{ font: `600 16px ${FONT_BODY}`, marginTop: 2 }}>{ex.name}</div>
                            {ex.sec && ex.sec.length > 0 && (
                              <div style={{ font: `400 10px ${FONT_BODY}`, color: C.faint, marginTop: 3 }}>
                                also works: {ex.sec.map((m) => m.replace(/_/g, " ")).join(", ")}
                              </div>
                            )}
                            <div style={{ font: `400 11px ${FONT_BODY}`, color: C.faint, marginTop: 2 }}>{ex.note}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ font: `500 10px ${FONT_DISPLAY}`, letterSpacing: ".1em", color: C.faint }}>TARGET</div>
                              <div style={{ font: `600 22px ${FONT_DISPLAY}`, color: C.steel }}>{ex.weight}<span style={{ font: `400 11px ${FONT_BODY}`, color: C.sub }}> lb</span></div>
                            </div>
                            {!todayDay.logged && (
                              <Btn kind="quiet" onClick={() => swapExercise(g)} style={{ padding: "6px 8px", fontSize: 11 }}>swap</Btn>
                            )}
                          </div>
                        </div>
                        {!todayDay.logged && (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                            <span style={{ font: `400 11px ${FONT_BODY}`, color: C.sub }}>actual:</span>
                            <Input value={ex.actual.weight} onChange={(v) => setActual(g, "weight", v)} placeholder={String(ex.weight)} w={64} />
                            <span style={{ color: C.faint, fontSize: 12 }}>lb ×</span>
                            {ex.actual.reps.map((r, i) => (
                              <Input key={i} value={r} onChange={(v) => setActual(g, "reps", v, i)} placeholder="reps" w={52} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!todayDay.logged ? (
                  <Btn kind="solid" onClick={finishLift} style={{ marginTop: 16, width: "100%" }}>Log session & set next targets</Btn>
                ) : (
                  <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(111,191,115,.1)", border: `1px solid ${C.good}`, borderRadius: 8, font: `500 13px ${FONT_BODY}`, color: C.good }}>
                    ✓ Logged. Next session's targets are already adjusted from what you did.
                  </div>
                )}
              </Panel>
            )}

            {/* CARDIO / RECOVERY view */}
            {(todayDay.type === "bike" || todayDay.type === "run" || todayDay.type === "recovery") && (
              <Panel>
                <Eyebrow>{todayDay.type === "recovery" ? "Active Recovery / Rest" : todayDay.type === "bike" ? "Bike" : "Run"}</Eyebrow>
                <div style={{ font: `400 13px ${FONT_BODY}`, color: C.sub, lineHeight: 1.6 }}>
                  {todayDay.type === "recovery"
                    ? "Easy day. Walk, mobility, or full rest — this is when the muscle you've built actually consolidates. Log your Garmin metrics below so the coaching stays accurate."
                    : todayDay.type === "bike"
                    ? "Track it however you ride — assault bike intervals or a road session. Garmin captures the detail; just drop your headline numbers below so I can balance your week."
                    : "Run logged. Garmin has your pace and HR; enter the summary metrics below and I'll factor recovery load into your lift programming."}
                </div>
              </Panel>
            )}

            {/* DAILY METRICS — the 15-second input */}
            <Panel>
              <Eyebrow>Daily Check-In</Eyebrow>
              <div style={{ font: `400 11px ${FONT_BODY}`, color: C.faint, marginBottom: 14 }}>
                Pull these from Garmin / MyFitnessPal once a day. This is the only manual step.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
                {[
                  ["body", "Bodyweight", "lb"],
                  ["intake", "Calories eaten", "cal"],
                  ["burn", "Calories burned", "cal"],
                  ["steps", "Steps", ""],
                  ["sleep", "Sleep", "hr"],
                  ["rhr", "Resting HR", "bpm"],
                ].map(([f, label, unit]) => (
                  <div key={f}>
                    <div style={{ font: `500 10px ${FONT_DISPLAY}`, letterSpacing: ".1em", textTransform: "uppercase", color: C.faint, marginBottom: 6 }}>{label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Input value={todayDay[f]} onChange={(v) => setMetric(f, v)} placeholder="—" w={80} />
                      <span style={{ font: `400 11px ${FONT_BODY}`, color: C.faint }}>{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* COACH */}
            <Panel style={{ background: C.panel2 }}>
              <Eyebrow>Coach</Eyebrow>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {coaching.map((m, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 7, height: 7, borderRadius: 4, marginTop: 6, flexShrink: 0,
                      background: m.tone === "good" ? C.good : m.tone === "warn" ? C.warn : m.tone === "bad" ? C.bad : C.faint }} />
                    <div style={{ font: `400 13px/1.5 ${FONT_BODY}`, color: C.ink }}>{m.t}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {/* ============ TRENDS ============ */}
        {tab === "trends" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* range selector */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ font: `400 12px ${FONT_BODY}`, color: C.sub, marginRight: 4 }}>Window:</span>
              {[[14, "14d"], [30, "30d"], [90, "90d"], [0, "All"]].map(([r, label]) => (
                <Btn key={r} active={range === r} onClick={() => setRange(r)} style={{ padding: "6px 12px", fontSize: 12 }}>{label}</Btn>
              ))}
              <span style={{ marginLeft: "auto", font: `400 11px ${FONT_BODY}`, color: C.faint }}>
                <span style={{ color: C.ember }}>– – –</span> dashed line = direction of travel
              </span>
            </div>

            {/* bodyweight */}
            {(() => {
              const d = trend("body");
              const reg = linReg(d.map((x) => x.v));
              const perWk = reg ? (reg.slope * 7).toFixed(2) : null;
              return (
                <Panel>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <Eyebrow>Bodyweight</Eyebrow>
                    {d.length >= 2 && (
                      <div style={{ font: `500 12px ${FONT_BODY}`, color: perWk > 0 ? C.good : perWk < 0 ? C.bad : C.sub }}>
                        {perWk > 0 ? "+" : ""}{perWk} lb/wk
                      </div>
                    )}
                  </div>
                  <Chart data={d} color={C.ember} unit=" lb" />
                </Panel>
              );
            })()}

            {/* calories eaten vs burned */}
            <Panel>
              <Eyebrow>Calorie intake</Eyebrow>
              <Chart data={trend("intake")} color={C.steel} unit=" cal" fmtY={(v) => Math.round(v)} />
            </Panel>

            {/* net balance */}
            <Panel>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Eyebrow>Net energy balance · eaten − burned</Eyebrow>
                <div style={{ font: `400 11px ${FONT_BODY}`, color: C.faint }}>positive = surplus (growth fuel)</div>
              </div>
              <Chart data={balanceTrend} color={C.good} unit=" cal" fmtY={(v) => Math.round(v)} />
            </Panel>

            {/* training volume */}
            <Panel>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Eyebrow>Lift volume · total lb moved per session</Eyebrow>
                <div style={{ font: `400 11px ${FONT_BODY}`, color: C.faint }}>weight × reps, all exercises</div>
              </div>
              <Chart data={volumeTrend} color={C.ember} unit=" lb" fmtY={(v) => v >= 1000 ? (v / 1000).toFixed(1) + "k" : Math.round(v)} />
            </Panel>

            {/* garmin secondary metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              <Panel>
                <Eyebrow>Sleep · hours</Eyebrow>
                <Chart data={trend("sleep")} color={C.steel} height={130} unit=" h" />
              </Panel>
              <Panel>
                <Eyebrow>Resting heart rate</Eyebrow>
                <Chart data={trend("rhr")} color={C.warn} height={130} unit=" bpm" fmtY={(v) => Math.round(v)} />
              </Panel>
              <Panel>
                <Eyebrow>Steps</Eyebrow>
                <Chart data={trend("steps")} color={C.good} height={130} unit="" fmtY={(v) => v >= 1000 ? (v / 1000).toFixed(1) + "k" : Math.round(v)} />
              </Panel>
              <Panel>
                <Eyebrow>Calories burned</Eyebrow>
                <Chart data={trend("burn")} color={C.steel} height={130} unit=" cal" fmtY={(v) => Math.round(v)} />
              </Panel>
            </div>

            {/* weekly mix */}
            <Panel>
              <Eyebrow>Training mix · last 7 days</Eyebrow>
              {(() => {
                const last7 = sortedDayKeys.slice(-7);
                const counts = { lift: 0, bike: 0, run: 0, recovery: 0 };
                last7.forEach((k) => { const t = days[k]?.type; if (counts[t] !== undefined) counts[t]++; });
                return (
                  <div style={{ display: "flex", gap: 16 }}>
                    <Stat label="Lifts" value={counts.lift} unit="" tone={C.ember} />
                    <Stat label="Bike" value={counts.bike} unit="" tone={C.steel} />
                    <Stat label="Run" value={counts.run} unit="" tone={C.steel} />
                    <Stat label="Recovery" value={counts.recovery} unit="" tone={C.good} />
                  </div>
                );
              })()}
            </Panel>
          </div>
        )}

        {/* ============ HISTORY ============ */}
        {tab === "log" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Panel>
              <Eyebrow>Strength progression by lift</Eyebrow>
              {Object.keys(logs).length === 0 ? (
                <div style={{ color: C.faint, font: `400 13px ${FONT_BODY}` }}>No lifts logged yet. Run a lift session from the Today tab.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {Object.entries(logs).map(([exId, arr]) => {
                    const all = Object.values(LIB).flat();
                    const meta = all.find((e) => e.id === exId);
                    const spark = arr.map((a) => ({ v: a.weight }));
                    const first = arr[0].weight, last = arr[arr.length - 1].weight;
                    const delta = last - first;
                    return (
                      <div key={exId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, paddingBottom: 12, borderBottom: `1px solid ${C.line}` }}>
                        <div>
                          <div style={{ font: `600 14px ${FONT_BODY}` }}>{meta?.name || exId}</div>
                          <div style={{ font: `400 11px ${FONT_BODY}`, color: C.faint, marginTop: 2 }}>
                            {arr.length} sessions · {first} → {last} lb {delta > 0 ? `(+${delta})` : ""}
                          </div>
                        </div>
                        <Spark data={spark} color={delta > 0 ? C.good : C.steel} w={140} h={36} />
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
