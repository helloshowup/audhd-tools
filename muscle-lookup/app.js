import { figureShapes, bodyOutlineLeftHalf, head, figureWidth, figureHeight } from "./figure.js";

const appElement = document.getElementById("app");
const svgNamespace = "http://www.w3.org/2000/svg";

// The main-muscles-only switch resets on reload by design.
let mainMusclesOnly = false;
let searchText = "";
let cameFromInsideApp = false;
let figureView = "front"; // which side of the body shows on a phone
let selectedSessionMuscle = null;

const slugify = (text) => text.toLowerCase().replace(/['’]/g, "").replace(/\//g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const normaliseForSearch = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

function showFatalError(message) {
  appElement.innerHTML = "";
  const box = document.createElement("div");
  box.className = "fatal";
  box.innerHTML = `<h1>Something is wrong</h1><p class="label">The app stopped instead of guessing.</p>`;
  const detail = document.createElement("pre");
  detail.textContent = message;
  box.append(detail);
  appElement.append(box);
}

window.addEventListener("error", (event) => showFatalError(String(event.error?.stack || event.message)));
window.addEventListener("unhandledrejection", (event) => showFatalError(String(event.reason?.stack || event.reason)));

// ---------- load and index the catalogue ----------
const catalogueResponse = await fetch("data/catalogue.json", { cache: "no-store" });
if (!catalogueResponse.ok) throw new Error(`Could not load data/catalogue.json (HTTP ${catalogueResponse.status})`);
const catalogue = await catalogueResponse.json();

const muscleByName = new Map(); // muscle name -> muscle
const muscleNameByAnyName = new Map(); // muscle or part name -> muscle name
for (const muscle of catalogue.muscles) {
  muscle.slug = slugify(muscle.name);
  muscleByName.set(muscle.name, muscle);
  muscleNameByAnyName.set(muscle.name, muscle.name);
  for (const part of muscle.parts) muscleNameByAnyName.set(part.name, muscle.name);
}
const equipmentByName = new Map(catalogue.equipment.map((item) => [item.name, item]));

const problems = [];
for (const exercise of catalogue.exercises) {
  exercise.slug = slugify(exercise.name);
  for (const reference of [...exercise.mainMuscles, ...exercise.helperMuscles]) {
    if (!muscleNameByAnyName.has(reference)) problems.push(`"${exercise.name}" names a muscle that is not in the list: "${reference}"`);
  }
  for (const equipmentName of exercise.equipment) {
    if (!equipmentByName.has(equipmentName)) problems.push(`"${exercise.name}" names equipment that is not in the list: "${equipmentName}"`);
  }
}
const exerciseNamesInCatalogue = new Set(catalogue.exercises.map((exercise) => exercise.name));
// Workout tabs: fixed lists of days, each day a list of exercise names (see "workoutTabs" in the catalogue).
if (!Array.isArray(catalogue.workoutTabs) || !catalogue.workoutTabs.length) problems.push("The catalogue has no workout tabs");
const workoutTabSlugs = new Set();
for (const workoutTab of catalogue.workoutTabs ?? []) {
  if (!workoutTab.name || !workoutTab.slug || !workoutTab.days?.length) problems.push(`A workout tab needs a name, a slug and at least one day: ${JSON.stringify(workoutTab)}`);
  if (workoutTabSlugs.has(workoutTab.slug)) problems.push(`Two workout tabs use the slug "${workoutTab.slug}"`);
  workoutTabSlugs.add(workoutTab.slug);
  if (["today", "muscle", "exercise"].includes(workoutTab.slug)) problems.push(`Workout tab "${workoutTab.name}" uses the slug "${workoutTab.slug}", which is already a page`);
  for (const workoutDay of workoutTab.days ?? []) {
    if (!workoutDay.name || !workoutDay.exercises?.length) problems.push(`A day in "${workoutTab.name}" needs a name and at least one exercise: ${JSON.stringify(workoutDay)}`);
    for (const exerciseName of workoutDay.exercises ?? []) {
      if (!exerciseNamesInCatalogue.has(exerciseName)) problems.push(`"${workoutDay.name}" names an exercise that is not in the list: "${exerciseName}"`);
    }
  }
}
for (const view of Object.keys(figureShapes)) {
  for (const figureShape of figureShapes[view]) {
    if (!muscleByName.has(figureShape.muscle)) problems.push(`The ${view} figure has a shape for "${figureShape.muscle}", which is not a muscle in the list`);
  }
}
const musclesOnFigure = new Set(Object.values(figureShapes).flat().map((figureShape) => figureShape.muscle));
for (const muscle of catalogue.muscles) {
  if (!musclesOnFigure.has(muscle.name)) problems.push(`"${muscle.name}" has no tappable shape on the figure`);
  if (!catalogue.regions.includes(muscle.region)) problems.push(`"${muscle.name}" is in an unknown body region "${muscle.region}"`);
  if (!muscle.groupPicture) problems.push(`"${muscle.name}" has no group picture named in the catalogue`);
}
if (problems.length) throw new Error(`The catalogue does not line up:\n- ${problems.join("\n- ")}`);

// For each muscle: exercises where it is a main muscle, and where it only helps.
const exercisesByMuscle = new Map(catalogue.muscles.map((muscle) => [muscle.name, { main: [], helper: [] }]));
for (const exercise of catalogue.exercises) {
  const mainMuscleNames = new Set(exercise.mainMuscles.map((reference) => muscleNameByAnyName.get(reference)));
  const helperMuscleNames = new Set(exercise.helperMuscles.map((reference) => muscleNameByAnyName.get(reference)));
  for (const muscleName of mainMuscleNames) exercisesByMuscle.get(muscleName).main.push(exercise);
  for (const muscleName of helperMuscleNames) {
    if (!mainMuscleNames.has(muscleName)) exercisesByMuscle.get(muscleName).helper.push(exercise);
  }
}
const exerciseBySlug = new Map(catalogue.exercises.map((exercise) => [exercise.slug, exercise]));
const muscleBySlug = new Map(catalogue.muscles.map((muscle) => [muscle.slug, muscle]));
const exerciseByName = new Map(catalogue.exercises.map((exercise) => [exercise.name, exercise]));

// ---------- today's session & last scores: ticked names and latest performance per exercise ----------
// Saved on the server (/api/session) so every device shows the same list and latest scores.
// This browser keeps a copy too, so changes work with no signal and are sent when the connection is back.
const sessionStorageKey = "muscle-lookup:todays-session";
const lastDoneStorageKey = "muscle-lookup:last-done";
const dayLogStorageKey = "muscle-lookup:day-log";
const unsyncedStorageKey = "muscle-lookup:todays-session-unsynced";

// Browser storage can be missing or full (private tabs, blocked site data). Every access goes through these,
// so a storage failure never stops a tick from working: the change stays in memory and still syncs to the server.
function readStored(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStored(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
function removeStored(key) {
  try { localStorage.removeItem(key); } catch { /* nothing stored, nothing to remove */ }
}
// Remembered in memory as well, in case the browser would not store the flag.
let unsyncedInMemory = false;
function isUnsynced() {
  return unsyncedInMemory || Boolean(readStored(unsyncedStorageKey));
}
function markUnsynced() {
  unsyncedInMemory = true;
  writeStored(unsyncedStorageKey, "yes");
}
function markSynced() {
  unsyncedInMemory = false;
  removeStored(unsyncedStorageKey);
}

function readTodaysSession() {
  const storedText = readStored(sessionStorageKey);
  if (storedText === null) return [];
  try {
    const storedNames = JSON.parse(storedText);
    if (!Array.isArray(storedNames) || !storedNames.every((name) => typeof name === "string")) return [];
    return storedNames;
  } catch {
    return [];
  }
}

function readLastDone() {
  const storedText = readStored(lastDoneStorageKey);
  if (storedText === null) return {};
  try {
    const parsed = JSON.parse(storedText);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readDayLog() {
  const storedText = readStored(dayLogStorageKey);
  if (storedText === null) return {};
  try {
    const parsed = JSON.parse(storedText);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function pruneDayLog(log) {
  const pruned = {};
  const recentDates = Object.keys(log || {})
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .slice(-14);
  for (const date of recentDates) {
    if (log[date] && typeof log[date] === "object" && !Array.isArray(log[date])) {
      pruned[date] = log[date];
    }
  }
  return pruned;
}


// Pre-seed realistic sample history on first open when localStorage is empty
if (readStored(sessionStorageKey) === null && readStored(lastDoneStorageKey) === null && readStored(dayLogStorageKey) === null) {
  const dAgo = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const sampleSession = ["Incline Dumbbell Press", "Seated Cable Row", "Dumbbell Lateral Raise"];
  const sampleLastDone = {
    "Incline Dumbbell Press": { weight: 18, sets: 3, reps: 10, date: dAgo(1) },
    "Seated Cable Row": { weight: 45, sets: 3, reps: 12, date: dAgo(1) },
    "Hip Thrust Machine": { weight: 70, sets: 3, reps: 10, date: dAgo(3) },
    "Goblet Squat": { weight: 20, sets: 3, reps: 10, date: dAgo(5) }
  };
  const sampleDayLog = {
    [dAgo(1)]: { "Incline Dumbbell Press": { weight: 18, sets: 3, reps: 10 }, "Seated Cable Row": { weight: 45, sets: 3, reps: 12 } },
    [dAgo(3)]: { "Hip Thrust Machine": { weight: 70, sets: 3, reps: 10 } },
    [dAgo(5)]: { "Goblet Squat": { weight: 20, sets: 3, reps: 10 } }
  };
  writeStored(sessionStorageKey, JSON.stringify(sampleSession));
  writeStored(lastDoneStorageKey, JSON.stringify(sampleLastDone));
  writeStored(dayLogStorageKey, JSON.stringify(sampleDayLog));
}

let todaysSession = readTodaysSession();
let lastDone = readLastDone();
let dayLog = pruneDayLog(readDayLog());
let syncState = "saved"; // checking | saved | saving | offline
let syncProblem = { kind: "server", detail: "" }; // kind: signin | network | server

function showSessionEverywhere() {
  for (const countElement of document.querySelectorAll(".session-count")) countElement.textContent = String(todaysSession.length);
  for (const tickButton of document.querySelectorAll(".tick:not(.remove)")) tickButton.dispatchEvent(new Event("refresh"));
  for (const scoreboard of document.querySelectorAll(".scoreboard, .quick-log")) scoreboard.dispatchEvent(new Event("refresh"));
  for (const weekStrip of document.querySelectorAll(".week-strip")) weekStrip.dispatchEvent(new Event("refresh"));
  for (const statusElement of document.querySelectorAll(".sync-status")) showSyncState(statusElement);
}

// Your ticks and scores are always kept on this device first, so when sharing fails the line says that, then why, then what to do.
const syncProblemText = {
  signin: "Saved on this device only. Sign in to Vercel again, then reload to share it with your other devices.",
  network: "Saved on this device only. It will go to your other devices when you're back online.",
  server: "Saved on this device only. The server had a problem; it will try again on your next change.",
};

function showSyncState(statusElement) {
  const text = {
    checking: "Checking for updates from your other devices…",
    saving: "Saving…",
    saved: "Saved locally in this browser.",
    offline: syncProblemText[syncProblem.kind] ?? syncProblemText.server,
  }[syncState];
  statusElement.textContent = text;
  statusElement.className = "sync-status" + (syncState === "offline" ? " failed" : "");
  // The exact cause, for when something needs fixing: press and hold on a phone, hover on a computer.
  if (syncState === "offline" && syncProblem.detail) statusElement.title = syncProblem.detail; else statusElement.removeAttribute("title");
}

function syncProblemFrom(error) {
  const kind = error.kind ?? (error instanceof TypeError ? "network" : "server");
  return { kind, detail: error.message };
}

function saveTodaysSession() {
  dayLog = pruneDayLog(dayLog);
  writeStored(sessionStorageKey, JSON.stringify(todaysSession));
  writeStored(lastDoneStorageKey, JSON.stringify(lastDone));
  writeStored(dayLogStorageKey, JSON.stringify(dayLog));
  markUnsynced();
  showSessionEverywhere();
  clearTimeout(saveTodaysSession.timer);
  saveTodaysSession.timer = setTimeout(pushTodaysSession, 300);
}

async function callSessionApi(method, body) {
  const response = await fetch("api/session", {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) {
    const error = new Error("the server answered with " + response.status + " and no session data");
    error.kind = response.status === 401 || response.status === 403 || response.redirected || response.status === 200 ? "signin" : "server";
    throw error;
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "server error " + response.status);
  if (!Array.isArray(result.names) || !result.names.every((name) => typeof name === "string")) throw new Error("the server sent a session that is not a list of names");
  return result;
}

async function pushTodaysSession() {
  markSynced();
  syncState = "saved";
  showSessionEverywhere();
}

async function pullTodaysSession() {
  syncState = "saved";
  showSessionEverywhere();
}

document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pullTodaysSession(); });
window.addEventListener("online", pullTodaysSession);

// ---------- 7-day main muscle strip ----------
const ndMusclePalette = [
  "#A8D8B9", // sage / eucalyptus green
  "#F6CC79", // warm ochre / amber
  "#F4B38A", // terracotta clay
  "#B3C5E6", // delft slate blue
  "#E8A5A2", // dusty brick rose
  "#C9B8DC", // muted plum slate
  "#9FD1CC", // seafoam slate
  "#E4D5B7", // warm parchment sand
  "#C5DBA4", // moss tint
  "#BCCCE0", // steel periwinkle
  "#E7B89C", // burnt sienna tint
  "#CFD8E3", // cool pewter mist
];
const priorityMuscleColours = {
  "Glutes": "#A8D8B9",
  "Chest": "#F6CC79",
  "Hamstrings": "#F4B38A",
  "Lats": "#B3C5E6",
  "Quads": "#E8A5A2",
  "Inner thigh": "#C9B8DC",
  "Lower back": "#9FD1CC",
  "Shoulders": "#E4D5B7",
  "Side glutes": "#C5DBA4",
  "Biceps": "#BCCCE0",
  "Triceps": "#E7B89C",
  "Traps": "#CFD8E3",
};
const muscleColourByName = new Map(
  catalogue.muscles.map((muscle, index) => [
    muscle.name,
    priorityMuscleColours[muscle.name] ?? ndMusclePalette[index % ndMusclePalette.length],
  ]),
);

function dateDaysAgoIso(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// Estimates the main muscle group worked on a given ISO date by weighting each completed exercise
// by sets × reps × weight (1.0× for main muscles, 0.5× for helper muscles, 20kg baseline for bodyweight/0kg).
function estimateDayMainMuscle(isoDate) {
  const exercisesOnDay = new Map();
  const loggedForDay = dayLog[isoDate];
  if (loggedForDay && typeof loggedForDay === "object" && !Array.isArray(loggedForDay)) {
    for (const [exerciseName, score] of Object.entries(loggedForDay)) {
      if (score && typeof score === "object") exercisesOnDay.set(exerciseName, score);
    }
  }
  for (const [exerciseName, score] of Object.entries(lastDone)) {
    if (score && typeof score === "object" && score.date === isoDate) {
      exercisesOnDay.set(exerciseName, score);
    }
  }
  if (!exercisesOnDay.size) return null;

  const statsByMuscle = new Map();
  const addLoad = (muscleName, load, effectiveSets, isMain) => {
    if (!statsByMuscle.has(muscleName)) {
      statsByMuscle.set(muscleName, { load: 0, effectiveSets: 0, mainCount: 0 });
    }
    const entry = statsByMuscle.get(muscleName);
    entry.load += load;
    entry.effectiveSets += effectiveSets;
    if (isMain) entry.mainCount += 1;
  };

  for (const [exerciseName, score] of exercisesOnDay) {
    const exercise = exerciseByName.get(exerciseName);
    if (!exercise) continue;
    const sets = Math.max(1, Number(score.sets) || 3);
    const reps = Math.max(1, Number(score.reps) || 10);
    const weight = Number(score.weight) || 0;
    const effectiveWeight = weight > 0 ? weight : 20;
    const exerciseLoad = sets * reps * effectiveWeight;

    const mainMuscleNames = new Set(exercise.mainMuscles.map((ref) => muscleNameByAnyName.get(ref)).filter(Boolean));
    const helperMuscleNames = new Set(
      exercise.helperMuscles
        .map((ref) => muscleNameByAnyName.get(ref))
        .filter((muscleName) => muscleName && !mainMuscleNames.has(muscleName)),
    );

    for (const muscleName of mainMuscleNames) addLoad(muscleName, exerciseLoad, sets, true);
    for (const muscleName of helperMuscleNames) addLoad(muscleName, exerciseLoad * 0.5, sets * 0.5, false);
  }

  let bestMuscleName = null;
  let bestStats = null;
  for (const [muscleName, stats] of statsByMuscle) {
    if (
      !bestStats ||
      stats.load > bestStats.load ||
      (stats.load === bestStats.load && stats.effectiveSets > bestStats.effectiveSets) ||
      (stats.load === bestStats.load && stats.effectiveSets === bestStats.effectiveSets && stats.mainCount > bestStats.mainCount)
    ) {
      bestMuscleName = muscleName;
      bestStats = stats;
    }
  }
  return bestMuscleName ? muscleByName.get(bestMuscleName) : null;
}

function lastSevenDaysBlock() {
  const strip = element("div", {
    class: "week-strip",
    role: "region",
    "aria-label": "Main muscle group exercised in the last 7 days",
  });

  const update = () => {
    strip.innerHTML = "";
    for (const daysAgo of [7, 6, 5, 4, 3, 2, 1]) {
      const isoDate = dateDaysAgoIso(daysAgo);
      const muscle = estimateDayMainMuscle(isoDate);
      const head = element("div", { class: "week-cell-head" }, String(daysAgo));
      const body = muscle
        ? element(
            "a",
            {
              class: "week-cell-body",
              href: `#/muscle/${muscle.slug}`,
              style: `background-color: ${muscleColourByName.get(muscle.name)}`,
              "aria-label": `${daysAgo} ${daysAgo === 1 ? "day" : "days"} ago (${isoDate}): ${muscle.name}`,
            },
            element("span", { class: "week-muscle" }, muscle.name),
          )
        : element(
            "div",
            {
              class: "week-cell-body is-empty",
              "aria-label": `${daysAgo} ${daysAgo === 1 ? "day" : "days"} ago (${isoDate}): no exercise logged`,
            },
            element("span", { class: "week-empty" }, "—"),
          );
      strip.append(element("div", { class: `week-cell${muscle ? "" : " is-empty"}`, "data-days-ago": String(daysAgo) }, head, body));
    }
  };

  strip.addEventListener("refresh", update);
  update();
  return strip;
}

// ---------- small DOM helper ----------
function element(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function svgElement(tag, attributes = {}) {
  const node = document.createElementNS(svgNamespace, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

// ---------- shared pieces ----------
// Slim on purpose: the name, two places you go every visit, and the workout lists folded behind one "Workouts" row.
function titleBar(currentTab = "look-up") {
  const currentWorkout = catalogue.workoutTabs.find((workoutTab) => workoutTab.slug === currentTab);
  const workoutsList = element("ul", { class: "workouts-list", id: "workouts-list" },
    catalogue.workoutTabs.map((workoutTab) => element("li", {},
      element("a", { href: `#/${workoutTab.slug}`, class: `btn-caps${currentTab === workoutTab.slug ? " is-on" : ""}`, ...(currentTab === workoutTab.slug ? { "aria-current": "page" } : {}) }, workoutTab.name))));
  workoutsList.hidden = true;
  const caret = element("span", { class: "workouts-caret", "aria-hidden": "true" }, "▾");
  const workoutsToggle = element("button", { type: "button", class: `btn-caps workouts-toggle${currentWorkout ? " is-on" : ""}`, "aria-expanded": "false", "aria-controls": "workouts-list" },
    element("span", { class: "workouts-toggle-name" }, currentWorkout ? `Workouts · ${currentWorkout.name}` : "Workouts"), caret);
  const setWorkoutsOpen = (open) => {
    workoutsList.hidden = !open;
    workoutsToggle.setAttribute("aria-expanded", String(open));
    caret.textContent = open ? "▴" : "▾";
  };
  workoutsToggle.addEventListener("click", () => setWorkoutsOpen(workoutsList.hidden));
  workoutsList.addEventListener("keydown", (event) => { if (event.key === "Escape") { setWorkoutsOpen(false); workoutsToggle.focus(); } });

  return element("header", { class: "title" },
    element("div", { class: "plate" },
      element("a", { class: "words", href: "#/" },
        element("h1", {}, "Muscle Look-up"),
        element("span", { class: "label" }, "Every strength exercise, by muscle")),
      element("nav", { class: "tabs", "aria-label": "Sections" },
        element("a", { href: "#/", class: `btn-caps${currentTab === "look-up" ? " is-on" : ""}` }, "Look up"),
        element("a", { href: "#/today", class: `btn-caps${currentTab === "today" ? " is-on" : ""}` }, "Today's session ", element("span", { class: "session-count" }, String(todaysSession.length))),
        workoutsToggle),
      workoutsList,
    ));
}

// The last seven days, one main muscle per day. Sits on Look up, under the body, not in the title bar on every page.
function lastSevenDaysPanel() {
  return element("section", { class: "panel week-panel" },
    element("h2", {}, "Last 7 days"),
    element("p", { class: "hint" }, "The main muscle each day. 7 = a week ago, 1 = yesterday."),
    lastSevenDaysBlock());
}

function sessionTickButton(exercise) {
  const button = element("button", { type: "button", class: "tick" });
  const showState = () => {
    const inSession = todaysSession.includes(exercise.name);
    button.setAttribute("aria-pressed", String(inSession));
    button.textContent = inSession ? "✓ In today's session" : "+ Add to today";
  };
  button.addEventListener("click", () => {
    todaysSession = todaysSession.includes(exercise.name) ? todaysSession.filter((name) => name !== exercise.name) : [...todaysSession, exercise.name];
    saveTodaysSession();
    for (const otherButton of document.querySelectorAll(`.tick[data-exercise="${CSS.escape(exercise.name)}"]`)) otherButton.dispatchEvent(new Event("refresh"));
    if (location.hash === "#/today") renderToday();
  });
  button.dataset.exercise = exercise.name;
  button.addEventListener("refresh", showState);
  showState();
  return button;
}

// Moves one exercise to a new place (1 = first) in today's session; the others shift to make room. Positions count only the
// exercises shown on the Today's session page; any retired names stay at the end, out of the numbering.
function moveInSession(exerciseName, newPosition) {
  const shownNames = todaysSession.filter((name) => exerciseByName.has(name));
  const hiddenNames = todaysSession.filter((name) => !exerciseByName.has(name));
  const oldIndex = shownNames.indexOf(exerciseName);
  if (oldIndex === -1) throw new Error(`"${exerciseName}" is not in today's session, so it can't be moved`);
  if (!Number.isInteger(newPosition) || newPosition < 1 || newPosition > shownNames.length) {
    throw new Error(`Position ${newPosition} is not between 1 and ${shownNames.length}`);
  }
  if (newPosition - 1 === oldIndex) return false;
  shownNames.splice(oldIndex, 1);
  shownNames.splice(newPosition - 1, 0, exerciseName);
  todaysSession = [...shownNames, ...hiddenNames];
  saveTodaysSession();
  return true;
}

// "Position 3 ▾" picker on a Today's session card: choosing another number moves the exercise there and renumbers the list.
function positionPicker(exercise, position, total) {
  const select = element("select", { class: "position", "aria-label": `Position of ${exercise.name} in today's session, ${position} of ${total}` });
  for (let number = 1; number <= total; number += 1) select.append(element("option", { value: String(number) }, String(number)));
  select.value = String(position);
  select.addEventListener("change", () => {
    moveInSession(exercise.name, Number(select.value));
    renderToday(exercise.name);
  });
  return element("label", { class: "position-picker" }, element("span", { class: "label" }, "Position"), select);
}

// The reverse of the add button: takes this exercise out of today's session. Used on the Today's session page.
function removeFromTodayButton(exercise) {
  const button = element("button", { type: "button", class: "tick remove", "aria-label": `Remove ${exercise.name} from today's session` }, "− Remove from today");
  button.addEventListener("click", () => {
    todaysSession = todaysSession.filter((name) => name !== exercise.name);
    saveTodaysSession();
    renderToday();
  });
  return button;
}

function mainOnlySwitch(onChange, id = "main-only") {
  const checkbox = element("input", { type: "checkbox", id });
  checkbox.checked = mainMusclesOnly;
  checkbox.addEventListener("change", () => { mainMusclesOnly = checkbox.checked; onChange(); });
  return element("label", { class: "switch", for: id }, checkbox, element("span", { class: "track" }), element("span", {}, "Main muscles only"));
}

function backButton(label, onClick) {
  return element("button", { class: "btn back", type: "button", onclick: onClick }, `← ${label}`);
}

// ---------- picture pop-up: tap any picture to see it large; tap anywhere, press Esc or "Close" to shut ----------
const lightboxImage = element("img", { alt: "" });
const lightboxCaption = element("p", { class: "label" });
const lightbox = element("dialog", { class: "lightbox", "aria-label": "Picture, larger" },
  element("button", { type: "button", class: "btn-caps lightbox-close" }, "Close ✕"),
  lightboxImage,
  lightboxCaption);
lightbox.addEventListener("click", () => lightbox.close());
document.body.append(lightbox);
window.addEventListener("hashchange", () => { if (lightbox.open) lightbox.close(); });

function openLightbox(image) {
  lightboxImage.src = image.src;
  lightboxImage.alt = image.alt;
  lightboxCaption.textContent = image.alt;
  lightbox.showModal();
}

// The picture, or a visible "not added yet" box naming the file it is waiting for.
function imageOrPlaceholder(fileName, altText) {
  const webpName = fileName.replace(/\.png$/, ".webp");
  const image = element("img", { src: `images/${webpName}`, alt: altText, loading: "lazy", decoding: "async", class: "zoomable", tabindex: "0", role: "button", "aria-label": `${altText}. Show larger` });
  image.addEventListener("click", () => openLightbox(image));
  image.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openLightbox(image); } });
  image.addEventListener("error", () => {
    if (image.src.endsWith(".webp")) {
      image.src = `images/${fileName}`;
    } else {
      image.replaceWith(element("div", { class: "placeholder" },
        element("span", { class: "label" }, "Picture not added yet"),
        element("span", { class: "filename" }, fileName)));
    }
  });
  return image;
}

function picture(fileName, slotLabel, altText) {
  return element("figure", { class: "slot" }, imageOrPlaceholder(fileName, altText), element("figcaption", { class: "label" }, slotLabel));
}

// "Chest (Upper chest, Middle chest)" style list, each muscle linking to its page.
function muscleList(references, currentMuscleName) {
  const partsByMuscle = new Map();
  for (const reference of references) {
    const muscleName = muscleNameByAnyName.get(reference);
    if (!partsByMuscle.has(muscleName)) partsByMuscle.set(muscleName, []);
    if (reference !== muscleName) partsByMuscle.get(muscleName).push(reference);
  }
  const items = [];
  for (const [muscleName, partNames] of partsByMuscle) {
    const link = element("a", { href: `#/muscle/${muscleByName.get(muscleName).slug}`, class: muscleName === currentMuscleName ? "current" : "" }, muscleName);
    items.push(element("li", {}, link, partNames.length ? ` (${partNames.join(", ")})` : ""));
  }
  return element("ul", { class: "muscle-list" }, items);
}

// sessionPlace ({ position, total }) is given on the Today's session page: it numbers the card and adds the position picker
// and the remove button in place of the add button.
function formatLastDate(isoDate) {
  if (!isoDate || typeof isoDate !== "string") return { isToday: false, day: "", date: "—" };
  const todayIso = new Date().toISOString().slice(0, 10);
  if (isoDate === todayIso) return { isToday: true, day: "TODAY", date: "TODAY" };
  const d = new Date(isoDate + "T12:00:00");
  if (Number.isNaN(d.getTime())) return { isToday: false, day: "", date: isoDate };
  const weekday = d.toLocaleDateString("en-ZA", { weekday: "short" }).toUpperCase();
  const dayMonth = d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" }).toUpperCase();
  return { isToday: false, day: weekday, date: dayMonth };
}

// Changes one exercise's last score (weight, sets or reps) and stamps today on it. Shared by the compact log row and the full scoreboard.
function logScore(exercise, updater) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const existing = lastDone[exercise.name];
  if (existing && typeof existing.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(existing.date)) {
    if (!dayLog[existing.date] || typeof dayLog[existing.date] !== "object") dayLog[existing.date] = {};
    if (!dayLog[existing.date][exercise.name]) {
      dayLog[existing.date][exercise.name] = {
        weight: existing.weight ?? 0,
        sets: existing.sets ?? 3,
        reps: existing.reps ?? 10,
      };
    }
  }
  const current = existing ?? { weight: 0, sets: 3, reps: 10, date: todayIso };
  const updated = updater({ ...current });
  updated.date = todayIso;
  lastDone[exercise.name] = updated;
  if (!dayLog[todayIso] || typeof dayLog[todayIso] !== "object") dayLog[todayIso] = {};
  dayLog[todayIso][exercise.name] = {
    weight: updated.weight ?? 0,
    sets: updated.sets ?? 3,
    reps: updated.reps ?? 10,
  };
  saveTodaysSession();
  for (const board of document.querySelectorAll(`.scoreboard[data-exercise="${CSS.escape(exercise.name)}"], .quick-log[data-exercise="${CSS.escape(exercise.name)}"]`)) {
    board.dispatchEvent(new Event("refresh"));
  }
}

// The row that stays on a collapsed card: weight stepper, the "done today" button and a one-line summary.
// Sets and reps live in the card's expanded part (scoreboardBlock).
function quickLog(exercise) {
  const container = element("div", { class: "quick-log", "data-exercise": exercise.name });
  const update = () => {
    const score = lastDone[exercise.name];
    const hasRecord = Boolean(score && score.date);
    const hasWeight = hasRecord && typeof score.weight === "number" && score.weight > 0;
    const dateInfo = formatLastDate(hasRecord ? score.date : null);
    container.replaceChildren(
      element("div", { class: "quick-kg", role: "group", "aria-label": `Weight for ${exercise.name}` },
        element("button", { type: "button", class: "quick-step", "aria-label": `Decrease weight for ${exercise.name}`, onclick: () => logScore(exercise, (s) => ({ ...s, weight: Math.max(0, (s.weight || 0) - 1) })) }, "−"),
        element("span", { class: "quick-kg-value", "aria-live": "polite" }, hasWeight ? String(score.weight) : "—", element("span", { class: "quick-kg-unit" }, "KG")),
        element("button", { type: "button", class: "quick-step", "aria-label": `Increase weight for ${exercise.name}`, onclick: () => logScore(exercise, (s) => ({ ...s, weight: Math.min(500, (s.weight || 0) + 1) })) }, "+")),
      element("button", { type: "button", class: `quick-today${dateInfo.isToday ? " is-done" : ""}`, "aria-label": `Mark ${exercise.name} done today`, onclick: () => logScore(exercise, (s) => ({ ...s })) },
        dateInfo.isToday ? "✓ Today" : "+ Today"),
      element("p", { class: "quick-summary" }, hasRecord ? `${score.sets ?? 3} × ${score.reps ?? 10} reps · last ${dateInfo.isToday ? "today" : dateInfo.date.toLowerCase()}` : "No score yet"));
  };
  container.addEventListener("refresh", update);
  update();
  return container;
}

function scoreboardBlock(exercise) {
  const container = element("div", { class: "scoreboard", "data-exercise": exercise.name });

  const update = () => {
    container.innerHTML = "";
    const rawScore = lastDone[exercise.name];
    const hasRecord = Boolean(rawScore && rawScore.date);
    const score = rawScore ?? { weight: 0, sets: 3, reps: 10, date: null };
    const dateInfo = formatLastDate(score.date);

    const hasWeight = hasRecord && typeof score.weight === "number" && score.weight > 0;
    const hasSets = hasRecord && typeof score.sets === "number" && score.sets > 0;
    const hasReps = hasRecord && typeof score.reps === "number" && score.reps > 0;
    const hasDate = hasRecord && Boolean(score.date);

    const setScore = (updater) => logScore(exercise, updater);

    // 1. KG Tile
    const kgTile = element("div", { class: `score-tile${hasWeight ? "" : " is-empty"}` },
      element("div", { class: "score-tile-head" }, "KG"),
      element("div", { class: "score-tile-stage" },
        element("span", { class: "score-tile-num" }, hasWeight ? String(score.weight) : "—")),
      element("div", { class: "score-tile-foot" },
        element("button", {
          type: "button",
          class: "score-tile-btn",
          "aria-label": `Decrease weight for ${exercise.name}`,
          onclick: () => setScore((s) => ({ ...s, weight: Math.max(0, (s.weight || 0) - 1) })),
        }, "−"),
        element("button", {
          type: "button",
          class: "score-tile-btn",
          "aria-label": `Increase weight for ${exercise.name}`,
          onclick: () => setScore((s) => ({ ...s, weight: Math.min(500, (s.weight || 0) + 1) })),
        }, "+")),
    );

    // 2. SETS Tile
    const setsTile = element("div", { class: `score-tile${hasSets ? "" : " is-empty"}` },
      element("div", { class: "score-tile-head" }, "SETS"),
      element("div", { class: "score-tile-stage" },
        element("span", { class: "score-tile-num" }, hasSets ? String(score.sets) : "—")),
      element("div", { class: "score-tile-foot" },
        element("button", {
          type: "button",
          class: "score-tile-btn",
          "aria-label": `Decrease sets for ${exercise.name}`,
          onclick: () => setScore((s) => ({ ...s, sets: Math.max(1, (s.sets || 3) - 1) })),
        }, "−"),
        element("button", {
          type: "button",
          class: "score-tile-btn",
          "aria-label": `Increase sets for ${exercise.name}`,
          onclick: () => setScore((s) => ({ ...s, sets: Math.min(20, (s.sets || 3) + 1) })),
        }, "+")),
    );

    // 3. REPS Tile
    const repsTile = element("div", { class: `score-tile${hasReps ? "" : " is-empty"}` },
      element("div", { class: "score-tile-head" }, "REPS"),
      element("div", { class: "score-tile-stage" },
        element("span", { class: "score-tile-num" }, hasReps ? String(score.reps) : "—")),
      element("div", { class: "score-tile-foot" },
        element("button", {
          type: "button",
          class: "score-tile-btn",
          "aria-label": `Decrease reps for ${exercise.name}`,
          onclick: () => setScore((s) => ({ ...s, reps: Math.max(1, (s.reps || 10) - 1) })),
        }, "−"),
        element("button", {
          type: "button",
          class: "score-tile-btn",
          "aria-label": `Increase reps for ${exercise.name}`,
          onclick: () => setScore((s) => ({ ...s, reps: Math.min(200, (s.reps || 10) + 1) })),
        }, "+")),
    );

    // 4. LAST Tile
    const lastTile = element("div", { class: `score-tile${hasDate ? "" : " is-empty"}` },
      element("div", { class: `score-tile-head ${hasDate ? (dateInfo.isToday ? "is-today" : "is-date") : ""}` }, "LAST"),
      element("div", { class: "score-tile-stage" },
        hasDate && dateInfo.day && !dateInfo.isToday ? element("span", { class: "score-tile-day" }, dateInfo.day) : null,
        element("span", { class: hasDate && (dateInfo.isToday || dateInfo.date.length > 3) ? "score-tile-date" : "score-tile-num" }, hasDate ? dateInfo.date : "—")),
      element("div", { class: "score-tile-foot" },
        element("button", {
          type: "button",
          class: "score-tile-today",
          "aria-label": `Mark ${exercise.name} done today`,
          onclick: () => setScore((s) => ({ ...s })),
        }, hasDate ? "✓ TODAY" : "+ TODAY")),
    );

    container.append(kgTile, setsTile, repsTile, lastTile);
  };

  container.addEventListener("refresh", update);
  update();
  return container;
}

// A card is compact until you open it: name, the add button, the main muscle, the kit as small pictures and the quick log.
// The four pictures, the helper muscles, sets and reps wait inside "More". Closed, the pictures are not even downloaded.
// expanded: open it from the start (the single-exercise page).
function exerciseCard(exercise, currentMuscleName, { sessionPlace = null, expanded = false } = {}) {
  const kitList = exercise.equipment.length
    ? element("ul", { class: "kit-chips", "aria-label": "Kit" }, exercise.equipment.map((equipmentName) => {
        const item = equipmentByName.get(equipmentName);
        return element("li", { class: "kit-chip" }, imageOrPlaceholder(item.photo, item.name), element("span", {}, item.name));
      }))
    : element("p", { class: "bodyweight label" }, "No kit: bodyweight");
  // The inside of "More" is built the first time it opens, so a page of 57 cards holds 57 summaries, not 228 pictures.
  const moreBody = element("div", { class: "card-more-body" });
  const buildMore = () => {
    if (moreBody.childElementCount) return;
    moreBody.append(
      exercise.otherNames.length ? element("p", { class: "aka" }, element("span", { class: "label" }, "Also called "), exercise.otherNames.join(" · ")) : null,
      exercise.helperMuscles.length
        ? element("div", {}, element("span", { class: "stamp white" }, "Helpers"), muscleList(exercise.helperMuscles, currentMuscleName))
        : null,
      element("div", { class: "pictures" },
        picture(exercise.pictures.start, "Start", `${exercise.name}, start`),
        picture(exercise.pictures.middle, "Middle", `${exercise.name}, middle`),
        picture(exercise.pictures.end, "End", `${exercise.name}, end`),
        picture(exercise.pictures.highlight, "Highlight", `${exercise.name}, muscles highlighted`)),
      element("div", { class: "score-side" },
        element("h4", { class: "label" }, "Last score"),
        scoreboardBlock(exercise)));
  };
  const more = element("details", { class: "card-more", ...(expanded ? { open: "" } : {}) },
    element("summary", {}, element("span", {}, "More: pictures, sets, reps"), element("span", { class: "card-more-caret", "aria-hidden": "true" }, "▾")),
    moreBody);
  more.addEventListener("toggle", () => { if (more.open) buildMore(); });
  if (expanded) buildMore();

  return element("article", { class: "card", "data-exercise": exercise.name, "data-kit": kitNamesOf(exercise).join("|") },
    element("div", { class: "card-head" },
      element("h3", {}, sessionPlace ? element("span", { class: "place" }, `${sessionPlace.position}. `) : null, element("a", { href: `#/exercise/${exercise.slug}` }, exercise.name)),
      sessionPlace
        ? element("div", { class: "card-controls" }, positionPicker(exercise, sessionPlace.position, sessionPlace.total), removeFromTodayButton(exercise))
        : sessionTickButton(exercise)),
    element("div", { class: "card-main" }, element("span", { class: "stamp green" }, "Main"), muscleList(exercise.mainMuscles, currentMuscleName)),
    kitList,
    quickLog(exercise),
    more,
  );
}

// ---------- kit filter: show only the exercises that use the equipment you pick ----------
// Kept while the page is open, across muscle and workout pages, because what is free in the gym is the same everywhere.
const bodyweightKit = "Bodyweight";
const selectedKit = new Set();
const kitNamesOf = (exercise) => (exercise.equipment.length ? exercise.equipment : [bodyweightKit]);

// exercises: everything the page lists. Returns { element, apply }; call apply() once the cards are on the page.
function kitFilter(exercises) {
  const countByKit = new Map();
  for (const exercise of exercises) for (const kit of kitNamesOf(exercise)) countByKit.set(kit, (countByKit.get(kit) ?? 0) + 1);
  const kits = [...countByKit.keys()].sort((a, b) => (a === bodyweightKit ? -1 : b === bodyweightKit ? 1 : a.localeCompare(b)));

  const status = element("p", { class: "kit-status hint", role: "status" });
  const caret = element("span", { "aria-hidden": "true" }, "▾");
  const toggleText = element("span", {});
  const toggle = element("button", { type: "button", class: "btn-caps kit-toggle", "aria-expanded": "false", "aria-controls": "kit-choices" }, toggleText, caret);
  const clear = element("button", { type: "button", class: "btn-caps kit-clear" }, "Show all kit");
  const chips = new Map();
  const choices = element("ul", { class: "kit-choices", id: "kit-choices" }, kits.map((kit) => {
    const chip = element("button", { type: "button", class: "kit-choice", "aria-pressed": "false" }, `${kit} · ${countByKit.get(kit)}`);
    chip.addEventListener("click", () => {
      if (selectedKit.has(kit)) selectedKit.delete(kit); else selectedKit.add(kit);
      apply();
    });
    chips.set(kit, chip);
    return element("li", {}, chip);
  }));
  choices.hidden = true;
  toggle.addEventListener("click", () => {
    choices.hidden = !choices.hidden;
    toggle.setAttribute("aria-expanded", String(!choices.hidden));
    caret.textContent = choices.hidden ? "▾" : "▴";
  });
  clear.addEventListener("click", () => { selectedKit.clear(); apply(); });

  function apply() {
    const filtering = selectedKit.size > 0;
    let shown = 0;
    for (const card of appElement.querySelectorAll(".card[data-kit]")) {
      const matches = !filtering || card.dataset.kit.split("|").some((kit) => selectedKit.has(kit));
      card.hidden = !matches;
      if (matches) shown += 1;
    }
    for (const section of appElement.querySelectorAll("[data-filterable]")) {
      const empty = section.querySelector(".filter-empty");
      if (empty) empty.hidden = !filtering || section.querySelector(".card:not([hidden])") !== null;
    }
    for (const [kit, chip] of chips) chip.setAttribute("aria-pressed", String(selectedKit.has(kit)));
    toggleText.textContent = filtering ? `Kit: ${[...selectedKit].slice(0, 2).join(", ")}${selectedKit.size > 2 ? ` +${selectedKit.size - 2}` : ""}` : "Filter by kit: all";
    clear.hidden = !filtering;
    status.textContent = filtering ? `Showing ${shown} of ${exercises.length} exercises that use ${[...selectedKit].join(" or ")}.` : "";
    status.hidden = !filtering;
  }

  const container = element("div", { class: "kit-filter" }, element("div", { class: "kit-bar" }, toggle, clear), choices, status);
  return { element: container, apply };
}

// ---------- body figure ----------
function pointsText(points, mirror) {
  return points.map(([x, y]) => `${mirror ? figureWidth - x : x},${y}`).join(" ");
}

// The muscle shapes are small: on a phone 46 of the 52 front shapes are narrower than a fingertip, and deep muscles
// sit inside bigger ones. So a tap is worked out from where it landed, not from which shape caught it:
// every muscle under the finger counts (deep ones included), and a tap that lands in none picks the nearest
// muscles within a thumb's reach.
const tapReachPixels = 22;

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToPolygon(x, y, points) {
  let nearest = Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[j];
    const [bx, by] = points[i];
    const dx = bx - ax;
    const dy = by - ay;
    const along = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
    nearest = Math.min(nearest, Math.hypot(x - (ax + along * dx), y - (ay + along * dy)));
  }
  return nearest;
}

// hitShapes are in drawing order. Returns [{ muscle, deep }], the shape drawn on top first.
function musclesAtPoint(hitShapes, x, y, reach) {
  const inside = new Map();
  for (let index = hitShapes.length - 1; index >= 0; index--) {
    const hitShape = hitShapes[index];
    if (!inside.has(hitShape.muscle) && pointInPolygon(x, y, hitShape.points)) inside.set(hitShape.muscle, { muscle: hitShape.muscle, deep: hitShape.deep });
  }
  if (inside.size) return [...inside.values()];
  const near = new Map();
  for (const hitShape of hitShapes) {
    const distance = distanceToPolygon(x, y, hitShape.points);
    if (distance > reach) continue;
    const known = near.get(hitShape.muscle);
    if (!known || distance < known.distance) near.set(hitShape.muscle, { muscle: hitShape.muscle, deep: hitShape.deep, distance });
  }
  return [...near.values()].sort((a, b) => a.distance - b.distance).slice(0, 3).map(({ muscle, deep }) => ({ muscle, deep }));
}

// onMuscleTap(muscleName, hits): muscleName is the muscle drawn on top where the finger landed; hits lists every muscle there.
function bodyFigure(view, onMuscleTap, { getMuscleState = null } = {}) {
  const svg = svgElement("svg", { viewBox: `0 0 ${figureWidth} ${figureHeight}`, class: "figure", role: "group", "aria-label": `Body, ${view}` });
  const outlinePoints = [...bodyOutlineLeftHalf, ...[...bodyOutlineLeftHalf].reverse().map(([x, y]) => [figureWidth - x, y])];
  svg.append(svgElement("polygon", { points: pointsText(outlinePoints, false), class: "body" }));
  svg.append(svgElement("ellipse", { ...head, class: "body" }));

  const hitShapes = [];
  svg.addEventListener("click", (event) => {
    const box = svg.getBoundingClientRect();
    const unitsPerPixel = figureWidth / box.width;
    const hits = musclesAtPoint(hitShapes, (event.clientX - box.left) * unitsPerPixel, (event.clientY - box.top) * unitsPerPixel, tapReachPixels * unitsPerPixel);
    if (hits.length) onMuscleTap(hits[0].muscle, hits);
  });

  for (const figureShape of figureShapes[view]) {
    const state = getMuscleState ? getMuscleState(figureShape.muscle) : null;
    const roleClass = state ? ` is-${state.role}` : "";
    const gradeClass = state?.grade ? ` grade-${state.grade}` : "";
    const selectedClass = state?.selected ? " is-selected" : "";
    const labelText = state?.label || figureShape.muscle;
    const copies = figureShape.mirror ? [false, true] : [false];
    for (const mirror of copies) {
      const attributes = {
        points: pointsText(figureShape.points, mirror),
        class: `muscle${figureShape.deep ? " deep" : ""}${roleClass}${gradeClass}${selectedClass}`,
        "data-muscle": figureShape.muscle,
        tabindex: "0",
        role: "button",
        "aria-label": labelText,
      };
      if (state) attributes["aria-pressed"] = String(Boolean(state.selected));
      const polygon = svgElement("polygon", attributes);
      const title = svgElement("title");
      title.textContent = labelText;
      polygon.append(title);
      // Taps are handled on the figure itself (above). Keyboard presses name their muscle directly.
      polygon.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onMuscleTap(figureShape.muscle, [{ muscle: figureShape.muscle, deep: figureShape.deep }]); } });
      svg.append(polygon);
      hitShapes.push({ muscle: figureShape.muscle, deep: figureShape.deep, points: figureShape.points.map(([x, y]) => [mirror ? figureWidth - x : x, y]) });
    }
  }
  return element("div", { class: "figure-box" }, element("span", { class: "stamp white" }, view === "front" ? "Front" : "Back"), svg);
}

// ---------- search ----------
function searchResults(text) {
  const query = normaliseForSearch(text);
  if (query.length < 2) return [];
  const results = [];
  for (const muscle of catalogue.muscles) {
    const names = [muscle.name, muscle.anatomyName, ...muscle.parts.flatMap((part) => [part.name, part.anatomyName])];
    const matchedName = names.find((name) => normaliseForSearch(name).includes(query));
    if (matchedName) results.push({ kind: "Muscle", title: muscle.name, detail: matchedName === muscle.name ? muscle.anatomyName : `matches “${matchedName}”`, href: `#/muscle/${muscle.slug}` });
  }
  for (const exercise of catalogue.exercises) {
    const matchedName = [exercise.name, ...exercise.otherNames].find((name) => normaliseForSearch(name).includes(query));
    if (matchedName) results.push({ kind: "Exercise", title: exercise.name, detail: matchedName === exercise.name ? exercise.otherNames.join(" · ") : `also called “${matchedName}”`, href: `#/exercise/${exercise.slug}` });
  }
  return results;
}

function renderSearchResults(listElement, text) {
  listElement.innerHTML = "";
  if (normaliseForSearch(text).length < 2) return;
  const results = searchResults(text);
  if (!results.length) {
    listElement.append(element("li", { class: "empty" }, `Nothing matches “${text}”.`));
    return;
  }
  for (const result of results) {
    listElement.append(element("li", {}, element("a", { href: result.href, onclick: () => { cameFromInsideApp = true; } },
      element("span", { class: `stamp ${result.kind === "Muscle" ? "green" : "white"}` }, result.kind),
      element("span", { class: "result-title" }, result.title),
      result.detail ? element("span", { class: "result-detail" }, result.detail) : null)));
  }
}

// ---------- pages ----------
function renderHome() {
  // A tap on the body only picks: the muscle lights up and its name waits in the bar below. Opening the page is a
  // second, deliberate tap on that name (or on the same muscle again), so a fingertip that lands on the wrong
  // neighbour costs nothing.
  const pickBar = element("div", { class: "figure-pick", role: "region", "aria-label": "Muscle you tapped", "aria-live": "polite" });
  pickBar.hidden = true;
  let pickedNames = [];

  const lightPicked = (names) => {
    for (const polygon of appElement.querySelectorAll(".figure .muscle.lit")) polygon.classList.remove("lit");
    for (const muscleName of names) {
      for (const polygon of appElement.querySelectorAll(`.muscle[data-muscle="${CSS.escape(muscleName)}"]`)) polygon.classList.add("lit");
    }
  };
  const openMuscle = (muscleName) => { location.hash = `#/muscle/${muscleByName.get(muscleName).slug}`; };
  const clearPick = () => {
    pickedNames = [];
    lightPicked([]);
    pickBar.hidden = true;
    pickBar.replaceChildren();
  };

  const goToMuscle = (tappedName, hits) => {
    // Tapping the one muscle that is already picked is the second tap: open it.
    if (pickedNames.length === 1 && hits.length === 1 && pickedNames[0] === hits[0].muscle) return openMuscle(pickedNames[0]);
    // Bigger muscles first, then the deep ones that sit inside them.
    const names = [...hits].sort((a, b) => Number(a.deep) - Number(b.deep)).map((hit) => hit.muscle);
    pickedNames = names;
    lightPicked(names);
    pickBar.replaceChildren(
      element("div", { class: "figure-pick-head" },
        element("span", { class: "label" }, names.length > 1 ? `${names.length} muscles here: pick one` : "Open this muscle?"),
        element("button", { type: "button", class: "figure-pick-clear", "aria-label": "Clear the picked muscle", onclick: clearPick }, "✕")),
      element("ul", { class: "figure-pick-list" }, names.map((muscleName) => {
        const muscle = muscleByName.get(muscleName);
        const lists = exercisesByMuscle.get(muscleName);
        const countText = mainMusclesOnly ? `${lists.main.length} exercises` : `${lists.main.length} main + ${lists.helper.length} helps`;
        return element("li", {},
          element("button", { type: "button", class: "figure-pick-go", onclick: () => openMuscle(muscleName) },
            element("span", { class: "figure-pick-name" }, muscle.name),
            element("span", { class: "figure-pick-detail" }, `${muscle.anatomyName} · ${countText}`),
            element("span", { class: "figure-pick-arrow", "aria-hidden": "true" }, "Open →")));
      })));
    pickBar.hidden = false;
  };

  const resultsList = element("ul", { class: "results" });
  const searchInput = element("input", { type: "search", id: "search", placeholder: "Muscle or exercise, any name", autocomplete: "off", value: searchText });
  searchInput.addEventListener("input", () => { searchText = searchInput.value; renderSearchResults(resultsList, searchText); });
  renderSearchResults(resultsList, searchText);

  const contents = catalogue.regions.map((regionName) => {
    const musclesInRegion = catalogue.muscles.filter((muscle) => muscle.region === regionName);
    // One row per group picture: the picture beside the muscles it shows.
    const musclesByPicture = new Map();
    for (const muscle of musclesInRegion) {
      if (!musclesByPicture.has(muscle.groupPicture)) musclesByPicture.set(muscle.groupPicture, []);
      musclesByPicture.get(muscle.groupPicture).push(muscle);
    }
    return element("section", { class: "region" },
      element("h3", {}, regionName),
      [...musclesByPicture].map(([groupPicture, muscles]) => element("div", { class: "group" },
        element("div", { class: "group-picture" }, imageOrPlaceholder(groupPicture, `${regionName}: ${muscles.map((muscle) => muscle.name).join(", ")}`)),
        element("ul", {}, muscles.map((muscle) => {
          const counts = exercisesByMuscle.get(muscle.name);
          return element("li", {}, element("a", { href: `#/muscle/${muscle.slug}` },
            element("span", { class: "muscle-name" }, muscle.name),
            element("span", { class: "anatomy" }, muscle.anatomyName),
            element("span", { class: "count" }, mainMusclesOnly ? `${counts.main.length}` : `${counts.main.length} + ${counts.helper.length}`)));
        })))));
  });

  // On a phone one side of the body shows at a time (twice the scroll otherwise); from 720px both sit side by side.
  const figures = element("div", { class: "figures", "data-view": figureView }, bodyFigure("front", goToMuscle), bodyFigure("back", goToMuscle));
  const viewButtons = ["front", "back"].map((view) => element("button", {
    type: "button",
    class: `btn-caps${figureView === view ? " is-on" : ""}`,
    "aria-pressed": String(figureView === view),
    onclick: () => {
      figureView = view;
      figures.dataset.view = view;
      for (const [index, button] of viewButtons.entries()) {
        const active = ["front", "back"][index] === view;
        button.classList.toggle("is-on", active);
        button.setAttribute("aria-pressed", String(active));
      }
    },
  }, view === "front" ? "Front" : "Back"));

  appElement.replaceChildren(
    titleBar(),
    element("section", { class: "panel" },
      element("h2", {}, "Tap a muscle"),
      element("p", { class: "hint" }, "Tap a muscle, then its name. Dashed = a deep muscle under another."),
      element("div", { class: "figure-switch", role: "group", "aria-label": "Side of the body" }, viewButtons),
      element("div", { class: "figures-wrap" }, figures, pickBar)),
    element("section", { class: "panel search-panel" },
      element("label", { class: "label", for: "search" }, "Search"),
      searchInput,
      resultsList,
      mainOnlySwitch(renderHome)),
    lastSevenDaysPanel(),
    element("section", { class: "panel" },
      element("h2", {}, "Contents"),
      element("p", { class: "hint" }, mainMusclesOnly ? "Number = exercises where it is a main muscle." : "Numbers = exercises where it is a main muscle + exercises where it helps."),
      element("div", { class: "contents" }, contents)),
  );
}

function renderMuscle(muscle) {
  const lists = exercisesByMuscle.get(muscle.name);
  const filter = kitFilter(mainMusclesOnly ? lists.main : [...lists.main, ...lists.helper]);
  const noKitMatch = element("p", { class: "hint filter-empty", hidden: "" }, "None of these use the kit you picked.");
  const sections = [
    element("section", { class: "panel", id: "muscle-main", "data-filterable": "" },
      element("h2", {}, `Main muscle · ${lists.main.length}`),
      lists.main.length ? lists.main.map((exercise) => exerciseCard(exercise, muscle.name)) : element("p", { class: "hint" }, "No exercise lists this as a main muscle; see the helper list."),
      noKitMatch,
    ),
  ];
  if (!mainMusclesOnly) {
    sections.push(element("section", { class: "panel", id: "muscle-helps", "data-filterable": "" },
      element("h2", {}, `Helps · ${lists.helper.length}`),
      lists.helper.length ? lists.helper.map((exercise) => exerciseCard(exercise, muscle.name)) : element("p", { class: "hint" }, "No exercises where it only helps."),
      element("p", { class: "hint filter-empty", hidden: "" }, "None of these use the kit you picked."),
    ));
  }

  appElement.replaceChildren(
    titleBar(),
    element("section", { class: "panel muscle-head" },
      backButton("Back to body", () => { location.hash = "#/"; }),
      element("h2", {}, muscle.name),
      element("p", { class: "label" }, `${muscle.anatomyName} · ${muscle.region}`),
      muscle.parts.length
        ? element("ul", { class: "parts" }, muscle.parts.map((part) => element("li", {}, element("strong", {}, part.name), element("span", {}, part.anatomyName))))
        : null,
      element("div", { class: "jump-links", role: "group", "aria-label": "Jump to a list" },
        element("button", { type: "button", class: "btn-caps", onclick: () => document.getElementById("muscle-main").scrollIntoView() }, `Main · ${lists.main.length} ↓`),
        mainMusclesOnly ? null : element("button", { type: "button", class: "btn-caps", onclick: () => document.getElementById("muscle-helps").scrollIntoView() }, `Helps · ${lists.helper.length} ↓`)),
      mainOnlySwitch(() => renderMuscle(muscle)),
      filter.element),
    ...sections,
  );
  filter.apply();
}

function renderExercise(exercise) {
  appElement.replaceChildren(
    titleBar(),
    element("section", { class: "panel" },
      backButton(cameFromInsideApp ? "Back" : "Back to body", () => { if (cameFromInsideApp) history.back(); else location.hash = "#/"; }),
      exerciseCard(exercise, null, { expanded: true })),
  );
}

function sessionListText(exercises) {
  const lines = exercises.map((exercise, index) => {
    const mainMuscleNames = [...new Set(exercise.mainMuscles.map((reference) => muscleNameByAnyName.get(reference)))];
    const kit = exercise.equipment.length ? exercise.equipment.join(", ") : "bodyweight";
    const score = lastDone[exercise.name];
    const scoreText = score && score.date ? ` · score: ${score.weight ? score.weight + "kg, " : ""}${score.sets}x${score.reps}` : "";
    return `${index + 1}. ${exercise.name} (main: ${mainMuscleNames.join(", ")}; kit: ${kit}${scoreText})`;
  });
  return [`Today's gym session, ${new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}`, ...lines].join("\n");
}

function syncStatusLine() {
  const statusElement = element("p", { class: "sync-status", role: "status" });
  showSyncState(statusElement);
  return statusElement;
}

function collectPartsByMuscle(references) {
  const partsByMuscle = new Map();
  for (const reference of references) {
    const muscleName = muscleNameByAnyName.get(reference);
    if (!muscleName) continue;
    if (!partsByMuscle.has(muscleName)) partsByMuscle.set(muscleName, []);
    if (reference !== muscleName && !partsByMuscle.get(muscleName).includes(reference)) {
      partsByMuscle.get(muscleName).push(reference);
    }
  }
  return partsByMuscle;
}

function summariseSessionMuscles(sessionExercises) {
  const byMuscle = new Map(catalogue.muscles.map((muscle) => [muscle.name, { main: [], helper: [] }]));
  sessionExercises.forEach((exercise, index) => {
    const position = index + 1;
    const mainMap = collectPartsByMuscle(exercise.mainMuscles);
    const helperMap = collectPartsByMuscle(exercise.helperMuscles);
    for (const [muscleName, parts] of mainMap) {
      byMuscle.get(muscleName).main.push({ exercise, position, parts });
    }
    for (const [muscleName, parts] of helperMap) {
      if (!mainMap.has(muscleName)) {
        byMuscle.get(muscleName).helper.push({ exercise, position, parts });
      }
    }
  });
  return byMuscle;
}

function jumpToSessionExercise(exerciseName) {
  const targetCard = appElement.querySelector(`article.card[data-exercise="${CSS.escape(exerciseName)}"]`);
  if (!targetCard) return;
  for (const previous of appElement.querySelectorAll("article.card.is-jumped")) previous.classList.remove("is-jumped");
  targetCard.classList.add("is-jumped");
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  targetCard.scrollIntoView({ behavior, block: "start" });
  clearTimeout(jumpToSessionExercise.timer);
  jumpToSessionExercise.timer = setTimeout(() => targetCard.classList.remove("is-jumped"), 2000);
}

function sessionMuscleMapPanel(sessionExercises) {
  const summaryByMuscle = summariseSessionMuscles(sessionExercises);
  const totalExercises = sessionExercises.length;
  const panel = element("section", { class: "panel session-map-panel", "aria-label": "Muscles in today's session" });

  const tierFromRatio = (ratio) => {
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  };

  const legendRamp = (kind) => element("span", { class: `legend-ramp ${kind}`, "aria-hidden": "true" },
    element("span", { class: "g1" }),
    element("span", { class: "g2" }),
    element("span", { class: "g3" }),
    element("span", { class: "g4" }));

  const updatePanel = () => {
    let mainCount = 0;
    let helperOnlyCount = 0;
    for (const entry of summaryByMuscle.values()) {
      if (entry.main.length) mainCount += 1;
      else if (entry.helper.length) helperOnlyCount += 1;
    }

    const gradeEntry = (entry) => {
      const hasMain = entry.main.length > 0;
      const helperHits = mainMusclesOnly ? 0 : entry.helper.length;
      if (hasMain) {
        const weightedShare = Math.min(1, (entry.main.length + helperHits * 0.5) / totalExercises);
        return { role: "main", grade: tierFromRatio(weightedShare), sharePercent: Math.round(weightedShare * 100) };
      }
      if (helperHits > 0) {
        const weightedShare = Math.min(0.5, (helperHits * 0.5) / totalExercises);
        const helperCoverage = helperHits / totalExercises;
        return { role: "helper", grade: tierFromRatio(helperCoverage), sharePercent: Math.round(weightedShare * 100) };
      }
      return { role: "idle", grade: 0, sharePercent: 0 };
    };

    const getMuscleState = (muscleName) => {
      const entry = summaryByMuscle.get(muscleName);
      const { role, grade, sharePercent } = gradeEntry(entry);
      const selected = selectedSessionMuscle === muscleName;
      let label = `${muscleName}: not in today's session`;
      if (role === "main" && !mainMusclesOnly && entry.helper.length > 0) {
        label = `${muscleName}: main (${entry.main.length}) and helper (${entry.helper.length}) — ${sharePercent}% of today's session`;
      } else if (role === "main") {
        label = `${muscleName}: main muscle (${entry.main.length} of ${totalExercises} exercise${totalExercises === 1 ? "" : "s"}, ${sharePercent}% of session)`;
      } else if (role === "helper") {
        label = `${muscleName}: helper muscle (${entry.helper.length} of ${totalExercises} exercise${totalExercises === 1 ? "" : "s"}, ${sharePercent}% weighted session share)`;
      }
      return { role, grade, selected, label };
    };

    const onMuscleTap = (muscleName) => {
      selectedSessionMuscle = selectedSessionMuscle === muscleName ? null : muscleName;
      updatePanel();
    };

    const selectedMuscle = selectedSessionMuscle ? muscleByName.get(selectedSessionMuscle) : null;
    let detailBox = null;
    if (selectedMuscle) {
      const entry = summaryByMuscle.get(selectedMuscle.name);
      const graded = gradeEntry(entry);
      const visibleHelpers = mainMusclesOnly ? [] : entry.helper;
      const combinedItems = [
        ...entry.main.map((item) => ({ ...item, kind: "Main" })),
        ...visibleHelpers.map((item) => ({ ...item, kind: "Helper" })),
      ].sort((a, b) => a.position - b.position);

      const badges = [];
      if (entry.main.length) badges.push(element("span", { class: "stamp green" }, `Main · ${entry.main.length}`));
      if (visibleHelpers.length) badges.push(element("span", { class: "stamp" }, `Helper · ${visibleHelpers.length}`));
      if (graded.role !== "idle") badges.push(element("span", { class: "stamp white" }, `${graded.sharePercent}% of session`));
      if (!badges.length) badges.push(element("span", { class: "stamp white" }, "Not in session"));

      detailBox = element("div", { class: "session-muscle-detail", role: "region", "aria-label": `${selectedMuscle.name} in today's session` },
        element("div", { class: "session-muscle-detail-head" },
          element("div", { class: "session-muscle-title" },
            element("h3", {}, selectedMuscle.name),
            element("span", { class: "label" }, `${selectedMuscle.anatomyName} · ${selectedMuscle.region}`),
            element("div", { class: "session-muscle-badges" }, badges)),
          element("button", {
            type: "button",
            class: "btn-caps session-muscle-close",
            onclick: () => { selectedSessionMuscle = null; updatePanel(); },
          }, "Close ✕")),
        combinedItems.length
          ? element("ul", { class: "session-muscle-list" }, combinedItems.map((item) => element("li", {},
              element("button", {
                type: "button",
                class: "session-muscle-jump",
                onclick: () => jumpToSessionExercise(item.exercise.name),
              },
              element("span", { class: `stamp ${item.kind === "Main" ? "green" : ""}`.trim() }, item.kind),
              element("span", { class: "session-muscle-jump-name" }, `${item.position}. ${item.exercise.name}`),
              item.parts.length ? element("span", { class: "session-muscle-jump-parts" }, `(${item.parts.join(", ")})`) : null,
              element("span", { class: "session-muscle-jump-arrow" }, "Jump ↓")))))
          : element("p", { class: "hint" },
              mainMusclesOnly && entry.helper.length
                ? `Only used as a helper in today's session (${entry.helper.length} exercise${entry.helper.length === 1 ? "" : "s"}). Turn off “Main muscles only” to see it.`
                : "No exercises in today's session work this muscle yet."),
        element("div", { class: "session-muscle-foot" },
          element("a", {
            class: "btn-caps",
            href: `#/muscle/${selectedMuscle.slug}`,
          }, `All ${selectedMuscle.name} exercises →`)));
    }

    panel.replaceChildren(
      element("div", { class: "session-map-head" },
        element("h2", {}, "Muscles in today's session"),
        mainOnlySwitch(updatePanel, "session-main-only")),
      element("div", { class: "session-map-meta" },
        element("div", { class: "session-map-legend" },
          element("span", { class: "legend-item" }, legendRamp("main"), `Main · ${mainCount}`),
          mainMusclesOnly ? null : element("span", { class: "legend-item" }, legendRamp("helper"), `Helpers · ${helperOnlyCount}`)),
        element("p", { class: "hint" }, "Darker shade = larger share of today's session. Tap a muscle to inspect.")),
      element("div", { class: "figures session-figures" },
        bodyFigure("front", onMuscleTap, { getMuscleState }),
        bodyFigure("back", onMuscleTap, { getMuscleState })),
      ...(detailBox ? [detailBox] : []),
    );
  };

  updatePanel();
  return panel;
}

// movedExerciseName: after a reorder, keep the moved card in view and keep keyboard focus on its picker.
function renderToday(movedExerciseName = null) {
  const sessionExercises = todaysSession.filter((name) => exerciseByName.has(name)).map((name) => exerciseByName.get(name));
  if (!sessionExercises.length) selectedSessionMuscle = null;
  const unknownNames = todaysSession.filter((name) => !exerciseByName.has(name));
  const status = element("p", { class: "copy-status", role: "status" });

  const copyButton = element("button", { type: "button", class: "btn" }, "Copy list");
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(sessionListText(sessionExercises));
      status.textContent = `Copied ${sessionExercises.length} exercise${sessionExercises.length === 1 ? "" : "s"} to the clipboard.`;
      status.className = "copy-status ok";
    } catch (error) {
      status.textContent = `Copy failed: ${error.message}. The list is in the box below: press and hold to select and copy it.`;
      status.className = "copy-status failed";
      const manualCopyBox = element("textarea", { class: "manual-copy", readonly: "", rows: String(sessionExercises.length + 2) });
      manualCopyBox.value = sessionListText(sessionExercises);
      status.after(manualCopyBox);
      manualCopyBox.select();
    }
  });
  const clearButton = element("button", { type: "button", class: "btn-caps" }, "Clear session");
  clearButton.addEventListener("click", () => {
    if (!confirm(`Remove all ${todaysSession.length} exercises from today's session?`)) return;
    todaysSession = [];
    selectedSessionMuscle = null;
    saveTodaysSession();
    renderToday();
  });

  appElement.replaceChildren(
    titleBar("today"),
    element("section", { class: "panel" },
      element("h2", {}, `Today's session · ${sessionExercises.length}`),
      syncStatusLine(),
      sessionExercises.length
        ? element("div", { class: "session-actions" }, copyButton, clearButton)
        : element("p", { class: "hint" }, "Nothing ticked yet. Open a muscle and tap “+ Add to today” on the exercises you want."),
      status,
      unknownNames.length
        ? element("div", { class: "fatal" },
            element("p", {}, "These ticked exercises are no longer in the catalogue, so they can't be shown:"),
            element("ul", {}, unknownNames.map((name) => element("li", {}, name))),
            element("button", { type: "button", class: "btn", onclick: () => { todaysSession = todaysSession.filter((name) => exerciseByName.has(name)); saveTodaysSession(); renderToday(); } }, "Remove them"))
        : null),
    ...(sessionExercises.length ? [sessionMuscleMapPanel(sessionExercises)] : []),
    ...sessionExercises.map((exercise, index) => exerciseCard(exercise, null, { sessionPlace: { position: index + 1, total: sessionExercises.length } })),
  );
  if (movedExerciseName !== null) {
    const movedCard = appElement.querySelector(`article.card[data-exercise="${CSS.escape(movedExerciseName)}"]`);
    if (movedCard) {
      movedCard.scrollIntoView({ block: "center" });
      movedCard.querySelector("select.position")?.focus({ preventScroll: true });
    }
  }
}

// A fixed workout tab from the catalogue (Glute Days, Hamstrings for glutes, ...): each day's exercises as the same cards
// as Today's session, each with "+ Add to today".
function renderWorkoutTab(workoutTab) {
  const isMultiDay = workoutTab.days.length > 1;
  const intro = isMultiDay && workoutTab.description
    ? [
        element(
          "section",
          { class: "panel" },
          element("h2", {}, `${workoutTab.name} · ${workoutTab.days.reduce((total, d) => total + d.exercises.length, 0)}`),
          element("p", { class: "description" }, workoutTab.description),
        ),
      ]
    : [];

  const filter = kitFilter(workoutTab.days.flatMap((workoutDay) => workoutDay.exercises.map((exerciseName) => exerciseByName.get(exerciseName))));

  appElement.replaceChildren(
    titleBar(workoutTab.slug),
    ...intro,
    element("section", { class: "panel" }, filter.element),
    ...workoutTab.days.flatMap((workoutDay) => [
      element(
        "section",
        { class: "panel" },
        element("h2", {}, `${workoutDay.name} · ${workoutDay.exercises.length}`),
        workoutDay.description ? element("p", { class: "description" }, workoutDay.description) : null,
      ),
      ...workoutDay.exercises.map((exerciseName) => exerciseCard(exerciseByName.get(exerciseName), null)),
    ]),
  );
  filter.apply();
}

function route() {
  const [, kind, slug] = location.hash.replace(/^#\/?/, "#/").split("/");
  window.scrollTo(0, 0);
  if (!kind) return renderHome();
  if (kind === "today") return renderToday();
  const workoutTab = catalogue.workoutTabs.find((tab) => tab.slug === kind);
  if (workoutTab) return renderWorkoutTab(workoutTab);
  if (kind === "muscle") {
    const muscle = muscleBySlug.get(slug);
    if (!muscle) throw new Error(`No muscle page called "${slug}"`);
    renderMuscle(muscle);
    // Land on the muscle's name with the first exercises just below, not back up in the title bar.
    document.querySelector(".muscle-head")?.scrollIntoView();
    return;
  }
  if (kind === "exercise") {
    const exercise = exerciseBySlug.get(slug);
    if (!exercise) throw new Error(`No exercise page called "${slug}"`);
    return renderExercise(exercise);
  }
  throw new Error(`Unknown page "${location.hash}"`);
}

document.addEventListener("click", (event) => {
  if (event.target.closest("a[href^='#/']")) cameFromInsideApp = true;
});
window.addEventListener("hashchange", route);
route();
pullTodaysSession();
