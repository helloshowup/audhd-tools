#!/usr/bin/env node
/**
 * sync-public.mjs
 *
 * Syncs allowlisted source files from the private working repositories into
 * helloshowup/audhd-tools, swaps cloud/database backends for localStorage / demo
 * adapters, strips all private emails/URLs/IDs, stamps "Last synced: <Month YYYY>",
 * and runs scripts/verify-clean.mjs.
 *
 * Usage:
 *   node scripts/sync-public.mjs              # sync all 5 apps
 *   node scripts/sync-public.mjs five-days    # sync one app (slug in export-manifest.json)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, 'export-manifest.json'), 'utf8'));

function parseArgs(argv) {
  let sourceRoot = path.resolve(ROOT, '..');
  let scrubPath = process.env.AUDHD_SCRUB_FILE || '';
  const targets = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--source-root' && argv[i + 1]) {
      sourceRoot = path.resolve(argv[++i]);
    } else if (argv[i] === '--scrub' && argv[i + 1]) {
      scrubPath = path.resolve(argv[++i]);
    } else if (!argv[i].startsWith('-')) {
      targets.push(argv[i]);
    }
  }
  return { sourceRoot, scrubPath, targets };
}

function loadScrubRules(explicitPath) {
  const candidates = [
    explicitPath,
    '/shared/user/Projects/audhd-tools-private-scrub.json',
    path.join(process.env.HOME || '', 'Projects', 'audhd-tools-private-scrub.json')
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
  return {};
}

function applyScrubList(text, rules) {
  let out = text;
  for (const [pattern, replacement, flags] of rules || []) {
    out = out.replace(new RegExp(pattern, flags || 'g'), replacement);
  }
  return out;
}

function monthYearNow() {
  return new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function copyRecursive(src, dst, excludeSet = new Set(), baseSrc = src) {
  const rel = path.relative(baseSrc, src).replace(/\\/g, '/');
  if (rel && excludeSet.has(rel)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const ent of fs.readdirSync(src)) {
      if (ent === '.git' || ent === 'node_modules' || ent === 'dist' || ent === '.DS_Store') continue;
      copyRecursive(path.join(src, ent), path.join(dst, ent), excludeSet, baseSrc);
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

function syncAllowlist(appKey, sourceRoot) {
  const cfg = MANIFEST.apps[appKey];
  if (!cfg) throw new Error(`Unknown app key "${appKey}"`);
  const srcRoot = path.join(sourceRoot, cfg.sourceDir);
  const dstRoot = path.join(ROOT, cfg.targetDir);
  if (!fs.existsSync(srcRoot)) {
    throw new Error(`Private source repo not found at ${srcRoot}`);
  }
  fs.rmSync(dstRoot, { recursive: true, force: true });
  fs.mkdirSync(dstRoot, { recursive: true });

  const excludeSet = new Set(cfg.exclude || []);
  for (const item of cfg.copy) {
    const src = path.join(srcRoot, item);
    const dst = path.join(dstRoot, item);
    if (!fs.existsSync(src)) {
      throw new Error(`Manifest item missing in ${srcRoot}: ${item}`);
    }
    copyRecursive(src, dst, excludeSet, srcRoot);
  }
  return { srcRoot, dstRoot };
}

function stripVercelToolbar(html) {
  return html
    .replace(/<!--(?:(?!-->)[\s\S])*?Vercel Toolbar(?:(?!-->)[\s\S])*?-->\s*/gi, '')
    .replace(/<script\b[^>]*src=["']https:\/\/vercel\.live\/[^"']*["'][^>]*><\/script>\s*/gi, '');
}

function stripLaunchpadNav(html) {
  return html
    .replace(/<!--(?:(?!-->)[\s\S])*?Launchpad nav bar(?:(?!-->)[\s\S])*?-->\s*/gi, '')
    .replace(/<launchpad-nav><\/launchpad-nav>\s*/gi, '')
    .replace(/<script\b[^>]*src=["'][^"']*launchpad-nav\.js["'][^>]*><\/script>\s*/gi, '');
}

function buildFiveDaysBridge() {
  return `/* Five Days — Standalone browser localStorage bridge for audhd-tools.
 * Replaces cloud Postgres/MCP/Calendar endpoints with localStorage persistence
 * and pre-seeded synthetic sample tasks relative to today's date.
 */
(function () {
  'use strict';

  var STORE_KEY = 'audhd_five_days_store_v1';
  var TASKS_KEY = 'audhd_five_days_tasks_v1';
  var COMMENTS_KEY = 'audhd_five_days_comments_v1';

  var origFetch = window.fetch.bind(window);
  var origSetItem = Storage.prototype.setItem;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(offsetDays) {
    var d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function isoAt(offsetDays, hour, min) {
    var d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    d.setHours(hour || 9, min || 0, 0, 0);
    return d.toISOString();
  }

  function defaultSeed() {
    var today = dateKey(0);
    var tomorrow = dateKey(1);
    var day2 = dateKey(2);
    var day3 = dateKey(3);

    var tasks = [
      {
        id: 'fd-demo-1',
        src: 'main',
        title: 'Work: Approve draft reply to studio inquiry',
        status: 'needsAction',
        due: today + 'T00:00:00.000Z',
        notes: [
          'AI ready Today 08:15: two-line reply drafted for northcoast@example.com',
          'Gate:',
          'Blocked by:',
          'Who: AI, then me',
          'Pts: 5',
          'Where: personal@example.com',
          'Source: Sample data',
          'Group: Work',
          'Hands: Say yes',
          'Card: Email',
          'Person: Maya Patel',
          'To: northcoast@example.com',
          'Subject: Workshop dates next month',
          'Thread: Confirmed Thursday mornings work best'
        ].join('\\n')
      },
      {
        id: 'fd-demo-2',
        src: 'main',
        title: 'Work: Send invoice for logo edit',
        status: 'needsAction',
        due: today + 'T00:00:00.000Z',
        notes: [
          'Gate:',
          'Blocked by:',
          'Who: Me',
          'Pts: 6',
          'Where: personal@example.com',
          'Source: Sample data',
          'Group: Work',
          'Hands: Send a message',
          'Card: Email',
          'Person: Harbour Studio',
          'To: accounts@example.com',
          'Subject: Invoice #104 - Logo refresh',
          'Why now: Due today for Friday payout run'
        ].join('\\n')
      },
      {
        id: 'fd-demo-3',
        src: 'main',
        title: 'Admin: Pick a Thursday dentist slot',
        status: 'needsAction',
        due: today + 'T00:00:00.000Z',
        notes: [
          'Gate:',
          'Blocked by:',
          'Who: Me',
          'Pts: 4',
          'Where: Messages',
          'Source: Sample data',
          'Group: Admin',
          'Hands: Pick one',
          'Card: Pick one',
          'Option 1: Thu 10:00 — morning before desk work',
          'Option 2: Thu 15:30 — after afternoon walk',
          'Why now: Practice holds provisional slot until midday'
        ].join('\\n')
      },
      {
        id: 'fd-demo-4',
        src: 'main',
        title: 'Admin: Pay monthly studio internet bill',
        status: 'needsAction',
        due: today + 'T00:00:00.000Z',
        notes: [
          'Gate:',
          'Blocked by:',
          'Who: Me',
          'Pts: 5',
          'Where: Banking app',
          'Source: Sample data',
          'Group: Admin',
          'Hands: Pay or move money',
          'Card: Pay',
          'Amount: R 899',
          'To: Metro Fibre',
          'Reference: STU-4082',
          'For: Monthly studio fibre line'
        ].join('\\n')
      },
      {
        id: 'fd-demo-5',
        src: 'main',
        title: 'Studio Site: Draft homepage opening paragraph',
        status: 'needsAction',
        due: today + 'T00:00:00.000Z',
        notes: [
          'Gate:',
          'Blocked by:',
          'Who: Me',
          'Pts: 5',
          'Where: Notes document',
          'Source: Sample data',
          'Group: Studio Site Refresh',
          'Hands: Write a thing',
          'Card: Plain'
        ].join('\\n')
      },
      {
        id: 'fd-demo-6',
        src: 'main',
        title: 'Home: Buy printer paper and black pens',
        status: 'needsAction',
        due: today + 'T00:00:00.000Z',
        notes: [
          'Gate:',
          'Blocked by:',
          'Who: Me',
          'Pts: 3',
          'Where: Corner Stationery',
          'Source: Sample data',
          'Group: Home',
          'Hands: Get up and do it',
          'Card: Errand',
          'Place: Corner Stationery',
          'Open: 08:30 - 17:30',
          'Items:',
          '- 1 ream A4 matte paper',
          '- 2 black fineliner pens'
        ].join('\\n')
      },
      {
        id: 'fd-demo-7',
        src: 'main',
        title: 'Work: Check mobile layout on staging page',
        status: 'needsAction',
        due: today + 'T00:00:00.000Z',
        notes: [
          'Gate:',
          'Blocked by:',
          'Who: Me',
          'Pts: 4',
          'Where: https://staging.example.com/preview',
          'Source: Sample data',
          'Group: Work',
          'Hands: Sit at a screen',
          'Card: Build',
          'Done when: Text wraps cleanly at 375px with zero horizontal scroll'
        ].join('\\n')
      },
      {
        id: 'fd-demo-8',
        src: 'main',
        title: 'Home: Water balcony herbs',
        status: 'completed',
        due: today + 'T00:00:00.000Z',
        completed: isoAt(0, 7, 35),
        notes: [
          'Done by Me Today 07:35: watered basil and rosemary',
          'Gate:',
          'Blocked by:',
          'Who: Me',
          'Pts: 2',
          'Where: Balcony',
          'Source: Sample data',
          'Group: Home',
          'Hands: Get up and do it',
          'Card: Plain'
        ].join('\\n')
      },
      {
        id: 'fd-demo-9',
        src: 'main',
        list: 'claude',
        title: 'Work: Sort quarterly PDF receipts into archive folder',
        status: 'completed',
        due: today + 'T00:00:00.000Z',
        completed: isoAt(0, 8, 25),
        notes: [
          'Done by AI Today 08:25: renamed 6 PDF receipts by date',
          'Gate:',
          'Blocked by:',
          'Who: Claude',
          'Pts: 3',
          'Where: Archive folder',
          'Source: Sample data',
          'Group: Work',
          'Hands: Sit at a screen',
          'Card: Plain'
        ].join('\\n')
      },
      {
        id: 'fd-demo-10',
        src: 'main',
        title: 'Work: Outline next week studio notes',
        status: 'needsAction',
        due: tomorrow + 'T00:00:00.000Z',
        notes: [
          'Gate:',
          'Blocked by:',
          'Who: Me',
          'Pts: 4',
          'Where: Notes',
          'Source: Sample data',
          'Group: Work',
          'Hands: Write a thing',
          'Card: Plain'
        ].join('\\n')
      },
      {
        id: 'fd-demo-11',
        src: 'main',
        title: 'Admin: Renew annual domain registration',
        status: 'needsAction',
        due: day2 + 'T00:00:00.000Z',
        notes: [
          'Gate:',
          'Blocked by:',
          'Who: Me',
          'Pts: 3',
          'Where: https://registrar.example.com',
          'Source: Sample data',
          'Group: Admin',
          'Hands: Form',
          'Card: Form',
          'Closes: ' + day3
        ].join('\\n')
      }
    ];

    var store = {
      mins: {
        'fd-demo-1': { m: 10, title: 'Work: Approve draft reply to studio inquiry' },
        'fd-demo-2': { m: 15, title: 'Work: Send invoice for logo edit' },
        'fd-demo-3': { m: 5, title: 'Admin: Pick a Thursday dentist slot' },
        'fd-demo-4': { m: 10, title: 'Admin: Pay monthly studio internet bill' },
        'fd-demo-5': { m: 30, title: 'Work: Draft homepage opening paragraph' },
        'fd-demo-6': { m: 25, title: 'Home: Buy printer paper and black pens' },
        'fd-demo-7': { m: 20, title: 'Work: Check mobile layout on staging page' }
      },
      prompts: {
        'fd-demo-1': {
          title: 'Work: Approve draft reply to studio inquiry',
          written: new Date().toISOString(),
          ai: { strength: 'light', effort: 'low' },
          pts: { points: 5 },
          prompts: {
            do: 'Show me the draft reply to Maya Patel for northcoast@example.com, ask my yes, then mark Done.',
            ask: 'Read the thread summary first and ask me if the Thursday morning time still fits before drafting.',
            quick: 'Tick the task once confirmed with a one-line note.'
          }
        },
        'fd-demo-2': {
          title: 'Work: Send invoice for logo edit',
          written: new Date().toISOString(),
          ai: { strength: 'standard', effort: 'medium' },
          pts: { points: 6 },
          prompts: {
            do: 'Prepare the invoice #104 cover email to accounts@example.com and show me the exact wording first.',
            ask: 'Check whether any extra revision hours need to be added before I send.',
            quick: 'Mark sent and log the date.'
          }
        }
      },
      projects: {
        'pj-studio-site': {
          name: 'Studio Site Refresh',
          tag: 'STUDIO SITE',
          finish: 'Homepage and contact page updated with current examples and checked on mobile.',
          heading: 'Client Work',
          needBy: day3,
          state: 'kept'
        }
      },
      repeatingDay: {
        'routine-water': { kind: 'item', order: 1, title: 'Drink water & take morning dose', when: 'every day', at: '06:30', takes: 5, inPrelim: false },
        'routine-plants': { kind: 'item', order: 2, title: 'Check balcony herbs', when: 'once it is light', at: '', takes: 10, inPrelim: false },
        'rule-admin-batch': { kind: 'rule', order: 1, name: 'Batch bills', text: 'If two or more Pay tasks fall in one week, group them in one 20-minute afternoon block.' }
      },
      bands: {
        'done-today': { closed: true },
        'idea-bank': { closed: true },
        'how-to-read-it': { closed: true }
      },
      current: {},
      sunk: {},
      inclaude: {},
      aiapp: {},
      blockerKinds: {},
      waiting: {},
      pushes: {},
      openSince: {},
      plandone: {},
      hiddenrows: {},
      dayplan: {},
      runs: {},
      settings: {},
      cache: {}
    };

    return { tasks: tasks, store: store };
  }

  function loadTasks() {
    try {
      var raw = localStorage.getItem(TASKS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    var seeded = defaultSeed();
    saveTasks(seeded.tasks);
    return seeded.tasks;
  }

  function saveTasks(tasks) {
    try { origSetItem.call(localStorage, TASKS_KEY, JSON.stringify(tasks)); } catch (e) {}
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {}
    var seeded = defaultSeed();
    saveStore(seeded.store);
    return seeded.store;
  }

  function saveStore(st) {
    try { origSetItem.call(localStorage, STORE_KEY, JSON.stringify(st)); } catch (e) {}
  }

  function loadComments() {
    try {
      var raw = localStorage.getItem(COMMENTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    var seed = [
      { id: 'c-demo-1', text: 'Local demo mode: comments stay in browser localStorage.', type: 'comment', author: 'Demo', status: 'open', createdAt: new Date().toISOString() }
    ];
    try { origSetItem.call(localStorage, COMMENTS_KEY, JSON.stringify(seed)); } catch (e) {}
    return seed;
  }

  function saveComments(list) {
    try { origSetItem.call(localStorage, COMMENTS_KEY, JSON.stringify(list)); } catch (e) {}
  }

  // Ensure both stores are seeded on initial boot
  loadTasks();
  loadStore();

  function jsonResp(obj, status) {
    return Promise.resolve(new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/api/') === 0) {
      var method = ((init && init.method) || 'GET').toUpperCase();
      var body = null;
      if (init && init.body) {
        try { body = JSON.parse(init.body); } catch (e) { body = {}; }
      }

      if (url.indexOf('/api/ticks') === 0) {
        var tasks = loadTasks();
        if (method === 'GET') {
          var q = new URLSearchParams(url.split('?')[1] || '');
          var tid = q.get('taskId');
          var found = tasks.find(function (t) { return t.id === tid; });
          return jsonResp({ found: !!found, task: found || null });
        }
        var t = tasks.find(function (x) { return x.id === (body && body.taskId); });
        if (!t) return jsonResp({ landed: false, error: 'Task not found in local store' }, 404);
        if (body.status !== undefined) {
          t.status = body.status;
          if (body.status === 'completed') t.completed = new Date().toISOString();
          else delete t.completed;
        }
        if (body.due !== undefined) t.due = body.due;
        if (body.notes !== undefined) t.notes = body.notes;
        if (body.moveTo !== undefined) {
          if (/V1pQR0|V0xVNn/.test(String(body.moveTo))) t.list = 'claude';
          else if (/d2d2OU|cHRvNj/.test(String(body.moveTo))) t.list = 'dropped';
          else delete t.list;
        }
        saveTasks(tasks);
        return jsonResp({ landed: true, id: t.id, task: t });
      }

      if (url.indexOf('/api/store') === 0) {
        var store = loadStore();
        var qs = new URLSearchParams(url.split('?')[1] || '');
        if (method === 'GET') {
          if (qs.get('init') === '1') {
            return jsonResp({ collections: store });
          }
          var col = qs.get('collection');
          var docId = qs.get('id');
          var collMap = store[col] || {};
          if (docId) {
            var exists = Object.prototype.hasOwnProperty.call(collMap, docId);
            return jsonResp({ exists: exists, id: docId, data: exists ? collMap[docId] : null });
          }
          var docs = Object.keys(collMap).map(function (id) { return { id: id, data: collMap[id] }; });
          return jsonResp({ docs: docs });
        }
        if (method === 'POST') {
          if (body && Array.isArray(body.batch)) {
            body.batch.forEach(function (op) {
              store[op.collection] = store[op.collection] || {};
              if (op.op === 'delete') delete store[op.collection][op.id];
              else store[op.collection][op.id] = op.data;
            });
          } else if (body && body.collection && body.id) {
            store[body.collection] = store[body.collection] || {};
            store[body.collection][body.id] = body.data;
          }
          saveStore(store);
          return jsonResp({ ok: true });
        }
        if (method === 'DELETE') {
          if (body && body.collection && body.id && store[body.collection]) {
            delete store[body.collection][body.id];
            saveStore(store);
          }
          return jsonResp({ ok: true });
        }
      }

      if (url.indexOf('/api/comments') === 0) {
        var list = loadComments();
        if (method === 'GET') return jsonResp({ comments: list });
        if (method === 'POST') {
          var item = {
            id: 'c-' + Date.now(),
            text: (body && body.text) || '',
            type: (body && body.type) || 'comment',
            author: 'Demo',
            status: 'open',
            createdAt: new Date().toISOString()
          };
          list.unshift(item);
          saveComments(list);
          return jsonResp({ ok: true, comment: item });
        }
        if (method === 'PATCH') {
          list.forEach(function (c) {
            if (body && c.id === body.id) c.status = body.status || 'resolved';
          });
          saveComments(list);
          return jsonResp({ ok: true });
        }
      }

      if (url.indexOf('/api/social') === 0) {
        return jsonResp({ ok: true, posts: [], driveConnected: true });
      }
      if (url.indexOf('/api/gemini') === 0) {
        return jsonResp({ ok: true });
      }
      return jsonResp({ ok: true });
    }
    return origFetch(input, init);
  };

  function makeSnapDocs(collMap, orderByField, orderDir, limitN) {
    var map = collMap || {};
    var entries = Object.keys(map).map(function (id) { return { id: id, raw: map[id] }; });
    if (orderByField) {
      entries.sort(function (a, b) {
        var va = String((a.raw && a.raw[orderByField]) || '');
        var vb = String((b.raw && b.raw[orderByField]) || '');
        return orderDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    if (limitN && entries.length > limitN) entries = entries.slice(0, limitN);
    return {
      docs: entries.map(function (e) {
        return { id: e.id, data: function () { return e.raw; } };
      })
    };
  }

  function createCollectionRef(name, opts) {
    opts = opts || {};
    var orderByField = opts.orderBy || null;
    var orderDir = opts.orderDir || 'desc';
    var limitN = opts.limit || 1000;
    return {
      orderBy: function (field, dir) {
        return createCollectionRef(name, { orderBy: field, orderDir: dir || 'desc', limit: limitN });
      },
      limit: function (n) {
        return createCollectionRef(name, { orderBy: orderByField, orderDir: orderDir, limit: n });
      },
      get: function () {
        var st = loadStore();
        return Promise.resolve(makeSnapDocs(st[name] || {}, orderByField, orderDir, limitN));
      },
      onSnapshot: function (cb) {
        var st = loadStore();
        cb(makeSnapDocs(st[name] || {}, orderByField, orderDir, limitN));
        return function () {};
      },
      doc: function (docId) {
        var idStr = String(docId);
        return {
          get: function () {
            var st = loadStore();
            var col = st[name] || {};
            var exists = Object.prototype.hasOwnProperty.call(col, idStr);
            return Promise.resolve({ id: idStr, exists: exists, data: function () { return exists ? col[idStr] : null; } });
          },
          set: function (dataObj) {
            var st = loadStore();
            st[name] = st[name] || {};
            st[name][idStr] = dataObj;
            saveStore(st);
            return Promise.resolve({ ok: true });
          },
          delete: function () {
            var st = loadStore();
            if (st[name]) { delete st[name][idStr]; saveStore(st); }
            return Promise.resolve({ ok: true });
          }
        };
      }
    };
  }

  var dbClient = { collection: function (name) { return createCollectionRef(String(name)); } };

  function handleTasksTool(slug, args) {
    args = args || {};
    var tasks = loadTasks();
    var isNd = /^GOOGLESUPER_/.test(slug);

    if (/LIST_TASKS/.test(slug)) {
      var listId = String(args.tasklist_id || '@default');
      var wantClaude = /V1pQR0|V0xVNn/.test(listId);
      var filtered = tasks.filter(function (t) {
        if (t.deleted) return false;
        if (isNd && t.src !== 'nd') return false;
        if (!isNd && t.src === 'nd') return false;
        if (wantClaude) { if (t.list !== 'claude') return false; }
        else { if (t.list === 'claude' || t.list === 'dropped') return false; }

        if (args.showCompleted === false && t.status === 'completed') return false;
        if (args.completedMin && t.status === 'completed') {
          if (!t.completed || String(t.completed) < String(args.completedMin)) return false;
        }
        if (args.dueMax && t.due && String(t.due) > String(args.dueMax)) return false;
        if (args.dueMin && (!t.due || String(t.due) < String(args.dueMin))) return false;
        return true;
      });
      return { successful: true, data: { tasks: filtered, nextPageToken: null } };
    }

    if (/INSERT_TASK/.test(slug)) {
      var created = {
        id: 'fd-local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        src: isNd ? 'nd' : 'main',
        title: args.title || 'Untitled task',
        notes: args.notes || '',
        due: args.due || (dateKey(0) + 'T00:00:00.000Z'),
        status: 'needsAction'
      };
      tasks.unshift(created);
      saveTasks(tasks);
      return { successful: true, data: created };
    }

    if (/DELETE_TASK/.test(slug)) {
      tasks = tasks.filter(function (t) { return t.id !== args.task_id; });
      saveTasks(tasks);
      return { successful: true, data: { deleted: true } };
    }

    return { successful: true, data: {} };
  }

  function handleCalendarTool(args) {
    args = args || {};
    var today = dateKey(0);
    if (args.calendarId && args.calendarId !== 'primary') {
      return {
        events: [
          {
            summary: '☀ 14°C / 22°C',
            start: { date: today },
            description: '06h - 09h: ☀ 🌡 15°C\\n09h - 12h: ☀ 🌡 19°C\\n12h - 15h: ☀ 🌡 22°C\\n15h - 18h: ⛅ 🌡 20°C\\n18h - 21h: 🌙 🌡 16°C'
          }
        ]
      };
    }
    return {
      events: [
        {
          id: 'ev-demo-1',
          status: 'confirmed',
          summary: 'Deep focus block',
          start: { dateTime: today + 'T09:00:00' },
          end: { dateTime: today + 'T10:30:00' }
        },
        {
          id: 'ev-demo-2',
          status: 'confirmed',
          summary: 'Client check-in call',
          conferenceUrl: 'https://example.com/call',
          start: { dateTime: today + 'T13:30:00' },
          end: { dateTime: today + 'T14:00:00' }
        }
      ]
    };
  }

  var mcpClient = {
    listServers: function () { return Promise.resolve([{ name: 'Local Store' }]); },
    invalidate: function () { return Promise.resolve(true); },
    callTool: function (server, tool, args) {
      if (server === 'Google Calendar' && tool === 'list_events') {
        return Promise.resolve({ payload: handleCalendarTool(args) });
      }
      if (server === 'Composio' && tool === 'COMPOSIO_MULTI_EXECUTE_TOOL') {
        var tools = (args && args.tools) || [];
        var results = tools.map(function (t) {
          return { response: handleTasksTool(String(t.tool_slug || ''), t.arguments || {}) };
        });
        return Promise.resolve({ payload: { data: { results: results } } });
      }
      return Promise.resolve({ payload: {} });
    }
  };

  window.claude = window.claude || {};
  window.claude.use = function (capability) {
    if (capability === 'db') return Promise.resolve(dbClient);
    if (capability === 'mcp') return Promise.resolve(mcpClient);
    return Promise.resolve(null);
  };
})();
`;
}

function patchFiveDays(dstRoot, scrub) {
  const htmlPath = path.join(dstRoot, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  html = stripVercelToolbar(html);
  html = html
    .replace(/<link rel="manifest"[^>]*>\s*/gi, '')
    .replace(/href="\/favicon\.svg"/g, 'href="favicon.svg"')
    .replace(/href="\/icon-192\.png"/g, 'href="icon-192.png"')
    .replace(
      /<a class="btn btn-caps" href="https:\/\/[^"']*\.vercel\.app">[\s\S]*?<\/a>/gi,
      '<span class="stamp white" style="font-size:.75rem;padding:4px 10px">Standalone Demo</span>'
    )
    .replace(/\/\* Forward any postMessage[\s\S]*?\n  \}\);\s*/g, '')
    .replace(/\/[^/\n]*@gmail\\.com\$\/i/g, '/example\\.com$/i')
    .replace(/[a-z0-9]{20,}@import\.calendar\.google\.com/gi, 'weather@example.com')
    .replace(/[A-Za-z0-9._%+-]+@gmail\.com/gi, 'work@example.com')
    .replace(/[A-Za-z0-9._%+-]+@[a-z0-9.-]+\.courses/gi, 'personal@example.com')
    .replace(new RegExp('https://claude\\.ai/' + 'artifact/[A-Za-z0-9]+', 'gi'), 'https://example.com/social-calendar')
    .replace(/https:\/\/[a-z0-9-]+\.vercel\.app/gi, 'https://example.com/app');

  html = applyScrubList(html, scrub.fiveDays);

  // Ensure regexes in Five Days accept "Me" as well as historical notes cleanly
  html = html
    .replace(/\/\^\\s\*\([a-z]+\|me\|i\)\\b\/i/g, '/^\\s*(me|i)\\b/i')
    .replace(/by (?:me|the user)\b/gi, 'by me');

  fs.writeFileSync(htmlPath, html, 'utf8');
  fs.writeFileSync(path.join(dstRoot, 'fd-bridge.js'), buildFiveDaysBridge(), 'utf8');

  fs.writeFileSync(path.join(dstRoot, 'README.md'), `# Five Days (Standalone Demo)

A 5-day horizon task planner grouped by concrete hand actions (\`Say yes\`, \`Send a message\`, \`Pick one\`, \`Pay or move money\`, \`Write a thing\`, \`Sit at a screen\`, \`Get up and do it\`).

## Run locally

Open \`index.html\` directly in a browser, or run a local server from the repository root:

\`\`\`bash
python3 -m http.server 8000
\`\`\`

Then visit \`http://localhost:8000/five-days/\`.

## Standalone adaptation

My working copy reads and writes tasks in Neon Postgres and Google Calendar. This public folder swaps \`fd-bridge.js\` for a pure browser \`localStorage\` store pre-seeded with fictional sample tasks dated relative to today.

Last synced: ${monthYearNow()}
`, 'utf8');
}

function patchRandlord(dstRoot, scrub) {
  // Clean demo-ledger venue name
  const demoPath = path.join(dstRoot, 'demo-ledger.ts');
  let demoTs = fs.readFileSync(demoPath, 'utf8');
  demoTs = applyScrubList(demoTs, scrub.randlord);
  fs.writeFileSync(demoPath, demoTs, 'utf8');

  // Clean index.html
  const htmlPath = path.join(dstRoot, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = stripLaunchpadNav(html);
  fs.writeFileSync(htmlPath, html, 'utf8');

  // Clean package.json so `npm run dev` boots straight into Demo Mode
  const pkgPath = path.join(dstRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.name = 'the-randlord';
  pkg.scripts.dev = 'RANDLORD_DEMO=1 VITE_RANDLORD_DEMO=1 tsx server.ts';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // Clean server.ts: strip private env paths/comments and default to demo when SPREADSHEET_ID is unset
  const srvPath = path.join(dstRoot, 'server.ts');
  let srv = fs.readFileSync(srvPath, 'utf8');
  srv = srv
    .replace(/\/\/ Load environment variables[^\n]*/m, '// Load environment variables (.env.local, .env)')
    .replace(/const secretsEnvPath =[\s\S]*?dotenv\.config\(\{ path: secretsEnvPath \}\);\s*\}\s*/m, '')
    .replace(
      /const isDemoMode = \(req: express\.Request\) => \{[\s\S]*?\};/,
      `const isDemoMode = (req: express.Request) => {\n  return process.env.RANDLORD_DEMO !== '0' && (!process.env.SPREADSHEET_ID || !req.headers.authorization);\n};`
    );
  fs.writeFileSync(srvPath, srv, 'utf8');

  // Safe Firebase stub (reads optional env vars; zero embedded Firebase credentials)
  fs.writeFileSync(path.join(dstRoot, 'src/lib/firebase.ts'), `import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
const STORAGE_KEY = 'randlord_access_token';
let cachedAccessToken: string | null = null;
let isSigningIn = false;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({ prompt: 'consent' });

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!auth) {
    onAuthFailure?.();
    return () => {};
  }
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken && typeof window !== 'undefined') {
        cachedAccessToken = sessionStorage.getItem(STORAGE_KEY);
      }
      if (cachedAccessToken) onAuthSuccess?.(user, cachedAccessToken);
      else if (!isSigningIn) { cachedAccessToken = null; onAuthFailure?.(); }
    } else {
      cachedAccessToken = null;
      if (typeof window !== 'undefined') sessionStorage.removeItem(STORAGE_KEY);
      onAuthFailure?.();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!auth) throw new Error('Firebase env variables are not configured. Use Demo mode or set VITE_FIREBASE_* in .env.');
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) throw new Error('Failed to get access token');
    cachedAccessToken = credential.accessToken;
    if (typeof window !== 'undefined') sessionStorage.setItem(STORAGE_KEY, cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken && typeof window !== 'undefined') {
    cachedAccessToken = sessionStorage.getItem(STORAGE_KEY);
  }
  return cachedAccessToken;
};

export const logout = async () => {
  if (auth) await auth.signOut();
  cachedAccessToken = null;
  if (typeof window !== 'undefined') sessionStorage.removeItem(STORAGE_KEY);
};
`, 'utf8');

  // Copy App.tsx from private repo, default DEMO on, remove private Launchpad URL, add demoLedger fallback
  const srcApp = fs.readFileSync(path.join(MANIFEST.apps['the-randlord']._srcRoot, 'src/App.tsx'), 'utf8');
  let dstApp = srcApp
    .replace(
      "import { Ledger } from './types';",
      "import { Ledger } from './types';\nimport { demoLedger } from '../demo-ledger';"
    )
    .replace(
      "const DEMO = import.meta.env.VITE_RANDLORD_DEMO === '1';",
      "const DEMO = import.meta.env.VITE_RANDLORD_DEMO !== '0';"
    )
    .replace(
      /href="https:\/\/nd-launchpad\.vercel\.app"\s*id="launchpad-escape-link"/,
      'href="#top" id="launchpad-escape-link" onClick={(e) => { e.preventDefault(); fetchLedger(token || \'demo\'); }}'
    )
    .replace('← Launchpad', 'Reset Demo')
    .replace(
      /const res = await fetch\('\/api\/sheets\/ledger'[\s\S]*?throw new Error\(errData\.error \|\| 'Failed to fetch ledger'\);\s*\}/m,
      `let rawData: any = null;
      try {
        const res = await fetch('/api/sheets/ledger', {
          headers: currentToken ? { Authorization: \`Bearer \${currentToken}\` } : {}
        });
        if (res.ok) rawData = await res.json();
      } catch {}
      if (!rawData && isDemo) {
        rawData = demoLedger();
      }
      if (!rawData) {
        throw new Error('Failed to fetch ledger');
      }
      {
        const { safe, quarantinedCount: qCount } = quarantineLedgerData(rawData);`
    )
    .replace(
      /const \{ safe, quarantinedCount: qCount \} = quarantineLedgerData\(rawData\);\s*const \{ safe/,
      'const { safe'
    );

  // Cleaner deterministic patch on App.tsx for the fetchLedger try block
  dstApp = srcApp
    .replace(
      "import { Ledger } from './types';",
      "import { Ledger } from './types';\nimport { demoLedger } from '../demo-ledger';"
    )
    .replace(
      "const DEMO = import.meta.env.VITE_RANDLORD_DEMO === '1';",
      "const DEMO = import.meta.env.VITE_RANDLORD_DEMO !== '0';"
    )
    .replace(
      /const res = await fetch\('\/api\/sheets\/ledger', \{[\s\S]*?throw new Error\(errData\.error \|\| 'Failed to fetch ledger'\);\s*\}/m,
      `let rawData: any = null;
      try {
        const res = await fetch('/api/sheets/ledger', {
          headers: currentToken ? { Authorization: \`Bearer \${currentToken}\` } : {}
        });
        if (res.ok) rawData = await res.json();
      } catch {}
      if (!rawData && isDemo) rawData = demoLedger();
      if (rawData) {
        const { safe, quarantinedCount: qCount } = quarantineLedgerData(rawData);
        setLedger(safe);
        setQuarantinedCount(qCount);
        setSavedAt(isDemo ? null : new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
      } else {
        throw new Error('Failed to fetch ledger');
      }`
    )
    .replace(
      /<a\s+href="https:\/\/[^"']*\.vercel\.app"\s+id="launchpad-escape-link"([\s\S]*?)>\s*← Launchpad\s*<\/a>/gi,
      '<span id="launchpad-escape-link"$1>Demo Ledger</span>'
    )
    .replace(/demo@randlord\.local/g, 'demo@example.com');

  fs.writeFileSync(path.join(dstRoot, 'src/App.tsx'), dstApp, 'utf8');

  // Clean personal comment in src/styles/base.css
  const baseCssPath = path.join(dstRoot, 'src/styles/base.css');
  let baseCss = fs.readFileSync(baseCssPath, 'utf8');
  baseCss = applyScrubList(baseCss, scrub.randlord);
  fs.writeFileSync(baseCssPath, baseCss, 'utf8');

  fs.writeFileSync(path.join(dstRoot, '.env.example'), `# Leave empty to boot directly into read-only Demo Mode
RANDLORD_DEMO=1
VITE_RANDLORD_DEMO=1

# Optional: wire your own Google Sheet & Firebase Auth
SPREADSHEET_ID=
REPLICATE_API_TOKEN=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
`, 'utf8');

  fs.writeFileSync(path.join(dstRoot, '.gitignore'), `node_modules/
dist/
api/
.env
.env.local
.DS_Store
`, 'utf8');

  fs.writeFileSync(path.join(dstRoot, 'README.md'), `# The Randlord (Standalone Demo)

Zero-based envelope budgeting for irregular freelance income (\`Personal\` and \`Business\` envelopes, ledger, accounts, and reports).

## Run locally

\`\`\`bash
npm install
npm run dev
\`\`\`

Then open [http://localhost:3000](http://localhost:3000). It boots straight into Demo Mode using the synthetic figures in \`demo-ledger.ts\` with zero cloud or Google Sheets setup required.

If you want to connect your own Google Sheet later, copy \`.env.example\` to \`.env\` and add your own Spreadsheet ID and Firebase web config.

Last synced: ${monthYearNow()}
`, 'utf8');
}

function patchSpoonLedger(dstRoot, scrub) {
  const htmlPath = path.join(dstRoot, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  html = stripVercelToolbar(html);
  html = stripLaunchpadNav(html);

  // Clean personal details & clinician/medication references via local scrub rules
  html = applyScrubList(html, scrub.spoonLedger);

  // Replace the /api/state gate script with a localStorage-backed adapter
  const gateScriptRe = /<script>\s*\/\/ Ledger storage\.[\s\S]*?tryOpen\(\);\s*\}\)\(\);\s*<\/script>/;
  const localGateScript = `<script>
(function(){
  const gate = document.getElementById('gate');
  window.dbStore = {
    updateRev() {},
    async get(k) { return localStorage.getItem(k); },
    async set(k, v) { localStorage.setItem(k, v); return { status: 200, data: { rev: 1 } }; }
  };
  window.spoonSync = true;
  if (gate) gate.style.display = 'none';
  window.addEventListener('DOMContentLoaded', () => {
    if (typeof window.startApp === 'function') window.startApp();
  });
})();
</script>`;
  if (!gateScriptRe.test(html)) throw new Error('Could not find spoon-ledger gate script block');
  html = html.replace(gateScriptRe, localGateScript);

  // Clean storage status labels for localStorage mode
  html = html
    .replace(/synced to Vercel Blob/g, 'saved locally in browser')
    .replace(/● synced/g, '● saved locally');

  // Build dynamic sample seed helper + inline fallback so opening index.html directly works immediately
  const sampleSeedFn = `
function buildDefaultDemoSeed() {
  const pad = n => (n < 10 ? '0' : '') + n;
  const dayOff = off => {
    const d = new Date();
    d.setDate(d.getDate() + off);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  const d0 = dayOff(0), d1 = dayOff(-1), d2 = dayOff(-2);
  return {
    settings: {},
    chips: ['desk work', 'writing', 'admin', 'meeting', 'social', 'exercise', 'walk', 'cooking / meal', 'reading', 'commute', 'rest'],
    options: {},
    migrations: [],
    days: {
      [d2]: {
        sleep: '7.5', sleepQuality: 4, morningEstimate: 7, rhr: '', hrv: '',
        dayTags: { meds: true }, feltEnergy: '2',
        entries: [
          { id: 'sl-d2-1', kind: 'dose', occurredAt: d2 + 'T07:15:00', loggedAt: d2 + 'T07:15:00', mg: 50, note: 'morning dose' },
          { id: 'sl-d2-2', kind: 'activity', occurredAt: d2 + 'T09:30:00', loggedAt: d2 + 'T09:30:00', felt: 2.0, chip: 'desk work', label: 'Client deliverables', dial: 3, tags: { flow: true }, allocation_tag: 'revenue-touching' },
          { id: 'sl-d2-3', kind: 'activity', occurredAt: d2 + 'T14:00:00', loggedAt: d2 + 'T14:00:00', felt: 2.5, chip: 'meeting', label: 'Project review call', dial: 4, tags: { social: true, mask: true }, allocation_tag: 'member-facing' },
          { id: 'sl-d2-4', kind: 'activity', occurredAt: d2 + 'T16:15:00', loggedAt: d2 + 'T16:15:00', felt: 1.5, chip: 'walk', label: 'Afternoon walk', dial: 1, tags: {}, allocation_tag: 'meta' }
        ]
      },
      [d1]: {
        sleep: '7', sleepQuality: 3, morningEstimate: 6, rhr: '', hrv: '',
        dayTags: { meds: true }, feltEnergy: '1',
        entries: [
          { id: 'sl-d1-1', kind: 'dose', occurredAt: d1 + 'T07:30:00', loggedAt: d1 + 'T07:30:00', mg: 50, note: 'morning dose' },
          { id: 'sl-d1-2', kind: 'activity', occurredAt: d1 + 'T09:00:00', loggedAt: d1 + 'T09:00:00', felt: 2.5, chip: 'writing', label: 'Workshop guide draft', dial: 3, tags: {}, allocation_tag: 'revenue-touching' },
          { id: 'sl-d1-3', kind: 'activity', occurredAt: d1 + 'T13:30:00', loggedAt: d1 + 'T13:30:00', felt: 2.5, chip: 'admin', label: 'Quarterly bookkeeping', dial: 4, tags: { admin: true }, allocation_tag: 'meta' }
        ]
      },
      [d0]: {
        sleep: '7.5', sleepQuality: 4, morningEstimate: 7, rhr: '', hrv: '',
        dayTags: { meds: true }, feltEnergy: '',
        entries: [
          { id: 'sl-d0-1', kind: 'dose', occurredAt: d0 + 'T07:30:00', loggedAt: d0 + 'T07:30:00', mg: 50, note: 'morning dose' },
          { id: 'sl-d0-2', kind: 'activity', occurredAt: d0 + 'T09:00:00', loggedAt: d0 + 'T09:00:00', felt: 2.0, chip: 'desk work', label: 'Client notes & replies', dial: 3, tags: {}, allocation_tag: 'revenue-touching' },
          { id: 'sl-d0-3', kind: 'activity', occurredAt: d0 + 'T11:15:00', loggedAt: d0 + 'T11:15:00', felt: 1.5, chip: 'writing', label: 'Homepage draft edit', dial: 2, tags: { flow: true }, allocation_tag: 'revenue-touching' },
          { id: 'sl-d0-4', kind: 'checkin', occurredAt: d0 + 'T13:00:00', loggedAt: d0 + 'T13:00:00', domains: { energy: ['Fine'], focus: ['Steady'], mood: ['Level'] }, note: '', lastAte: '1 to 2 hours ago', medPhase: 'steady', felt: null },
          { id: 'sl-d0-5', kind: 'activity', occurredAt: d0 + 'T14:30:00', loggedAt: d0 + 'T14:30:00', felt: 1.5, chip: 'admin', label: 'Invoicing & receipts', dial: 3, tags: { admin: true }, allocation_tag: 'meta' }
        ]
      }
    }
  };
}`;

  html = html.replace(
    /window\.startApp = async function\(\) \{[\s\S]*?init\(\);\s*\};/,
    sampleSeedFn + `\nwindow.startApp = async function() {
    if(window.appStarted) return;
    window.appStarted = true;
    const wrap = document.getElementById('app-wrap');
    if (wrap) wrap.style.display = 'block';
    SEED = buildDefaultDemoSeed();
    try {
        const resp = await fetch('seed.json');
        if(resp.ok) {
            const data = await resp.json();
            if (data && data.days && Object.keys(data.days).length > 0) {
                SEED = {
                    settings: data.settings || {},
                    options: data.options || {},
                    days: data.days || {},
                    chips: data.chips || SEED.chips,
                    migrations: data.migrations || []
                };
            }
        }
    } catch(e) {}
    init();
};
if (document.readyState !== 'loading') window.startApp();`
  );

  fs.writeFileSync(htmlPath, html, 'utf8');

  fs.writeFileSync(path.join(dstRoot, 'README.md'), `# Spoon Protocol Ledger (Standalone Demo)

Daily energy capacity, medication timing, and felt-cost check-ins — wired to browser \`localStorage\` with three pre-seeded sample days.

## Run locally

Open \`index.html\` directly in a browser, or run a local server from the repository root:

\`\`\`bash
python3 -m http.server 8000
\`\`\`

Then visit \`http://localhost:8000/spoon-ledger/\`.

## Standalone adaptation

My working copy stores state in a private Vercel Blob endpoint (\`/api/state\`). This public folder stores everything directly in browser \`localStorage\` (\`spoonledger:state:v2\`).

Last synced: ${monthYearNow()}
`, 'utf8');
}

function patchGoalRings(dstRoot, scrub) {
  const htmlPath = path.join(dstRoot, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  html = html.replace(/^<!--(?:(?!-->)[\s\S])*?-->\s*/, '');
  html = stripVercelToolbar(html);
  html = stripLaunchpadNav(html);

  // Clean personal names & formulation examples
  html = html.replace(/const WIZARD_EXAMPLES = \{[\s\S]*?\n\};/, `const WIZARD_EXAMPLES = {
    a: {
        goal: "Redesign client onboarding checklist",
        problem: "Onboarding steps live across four emails and docs so clients miss pre-session prep.",
        fixed: "Keep one single-page checklist; no new software accounts required."
    },
    b: {
        goal: "Plan quarterly studio budget and tax reserve",
        problem: "Lumpy project income makes it hard to tell what can be spent safely each month.",
        fixed: "Tax reserve stays untouchable; rent and utilities covered first."
    }
};`);
  html = applyScrubList(html, scrub.goalRings);

  // Replace network persistence & add rich default sample map + offline support
  const localAdapter = `
function sampleGoalRingsState() {
  return {
    goal: "Launch calm Q1 studio rhythm",
    problem: "Too many overlapping half-finished tasks make every morning feel equally urgent.",
    rootDone: "Two recurring studio mornings live with prep guide and booking link tested.",
    fixed: "Keep max 6 seats per morning. No subscription paywall.",
    zoom: 0.86,
    log: [{ t: new Date().toISOString(), event: "sample map loaded" }],
    variables: {
      room_max_seats: { wants: "integer seat cap", source: "ask venue host", value: null, declined: false, gates: ["n-cap"], default: "6" },
      session_price: { wants: "price in ZAR", source: "your call", value: "350", declined: false, gates: ["n-pay"], default: "350" }
    },
    nodes: [
      { id: "root", parentId: null, ring: 0, title: "Launch calm Q1 studio rhythm", done: "Two recurring studio mornings live with prep guide and booking link tested.", vars: [], status: "judgeable", keptAnyway: false, expanded: true, raw: "", error: null, settled: false },
      { id: "n-venue", parentId: "root", ring: 1, title: "Confirm room dates & access", why: "Need locked mornings before inviting anyone", done: "Dates confirmed in writing and key pickup agreed", vars: [], status: "judgeable", keptAnyway: false, expanded: true, raw: "", error: null, settled: true },
      { id: "n-keys", parentId: "n-venue", ring: 2, title: "Test Wi-Fi & power strip in room", why: "Avoid morning tech surprises", done: "Speed test > 20 Mbps and spare extension cord packed", vars: [], status: "judgeable", keptAnyway: false, expanded: false, raw: "", error: null, settled: true },
      { id: "n-prep", parentId: "root", ring: 1, title: "Write 1-page morning guide", why: "Keep instructions low-friction before arrival", done: "Single-page PDF covers arrival time, desk etiquette, and Wi-Fi", vars: [], status: "judgeable", keptAnyway: false, expanded: true, raw: "", error: null, settled: false },
      { id: "n-cap", parentId: "n-prep", ring: 2, title: "Lock room seat limit at {room_max_seats}", why: "Sensory ceiling depends on final chair count", done: "Arrival sheet states max {room_max_seats} desks", vars: ["room_max_seats"], status: "judgeable", keptAnyway: false, expanded: false, raw: "", error: null, settled: false },
      { id: "n-draft", parentId: "n-prep", ring: 2, title: "Trim welcome note to 120 words", why: "Short enough to read on a phone at the door", done: "Word count <= 120 and door code visible without scrolling", vars: [], status: "judgeable", keptAnyway: false, expanded: false, raw: "", error: null, settled: false },
      { id: "n-book", parentId: "root", ring: 1, title: "Publish booking & check-in flow", why: "Visitors need one clear place to reserve a seat", done: "Page live and test booking arrives in inbox", vars: [], status: "judgeable", keptAnyway: false, expanded: true, raw: "", error: null, settled: false },
      { id: "n-pay", parentId: "n-book", ring: 2, title: "Publish seat rate at R{session_price}", why: "Clear single number removes hesitation", done: "Booking page shows R{session_price} per morning", vars: ["session_price"], status: "judgeable", keptAnyway: false, expanded: true, raw: "", error: null, settled: false },
      { id: "n-mob", parentId: "n-pay", ring: 3, title: "Verify mobile submit at 375px", why: "Most visitors book from WhatsApp links on phones", done: "Test form submitted on phone viewport without overflow", vars: [], status: "judgeable", keptAnyway: false, expanded: false, raw: "", error: null, settled: false },
      { id: "n-invite", parentId: "root", ring: 1, title: "Message five past contacts", why: "First seats fill fastest through direct conversation", done: "Five short personal notes sent", vars: [], status: "judgeable", keptAnyway: false, expanded: false, raw: "", error: null, settled: false }
    ]
  };
}
`;

  html = html.replace('let state = { goal: "", problem: "", rootDone: "", fixed: "", nodes: [], variables: {}, zoom: 1, log: [] };',
    localAdapter + '\nlet state = { goal: "", problem: "", rootDone: "", fixed: "", nodes: [], variables: {}, zoom: 1, log: [] };');

  // Replace saveState() and loadState() with localStorage (anchored cleanly on column-0 closing brace)
  html = html.replace(
    /async function saveState\(\) \{[\s\S]*?\n\}/,
    `async function saveState() {
    let syncEl = document.getElementById('header-sync-status');
    try {
        localStorage.setItem('goalRings:state:' + (currentProfile || 'personal'), JSON.stringify(stateForSave()));
        stateRev++;
        if (syncEl) syncEl.innerHTML = "&bull; saved locally";
    } catch (e) {
        if (syncEl) syncEl.innerText = "save failed";
    }
}`
  );

  html = html.replace(
    /async function loadState\(\) \{[\s\S]*?\n\}/,
    `async function loadState() {
    let key = 'goalRings:state:' + (currentProfile || 'personal');
    let syncEl = document.getElementById('header-sync-status');
    if (syncEl) syncEl.innerHTML = "&bull; saved locally";
    try {
        let raw = localStorage.getItem(key);
        if (raw) {
            let parsed = JSON.parse(raw);
            if (parsed && parsed.goal) {
                state = parsed;
                normaliseLoadedState();
                return true;
            }
        }
        if ((currentProfile || 'personal') === 'personal' && !localStorage.getItem('goalRings:cleared:' + (currentProfile || 'personal'))) {
            state = sampleGoalRingsState();
            normaliseLoadedState();
            localStorage.setItem(key, JSON.stringify(stateForSave()));
            return true;
        }
    } catch (e) { console.warn('Local state load issue', e); }
    return false;
}`
  );

  // Replace loadSettings/saveSettings with localStorage
  html = html.replace(
    /async function loadSettings\(\) \{[\s\S]*?\n\}/,
    `async function loadSettings() {
    try {
        let raw = localStorage.getItem('goalRings:config:' + (currentProfile || 'personal'));
        if (raw) applySettings(JSON.parse(raw));
        else applySettings({});
        return true;
    } catch (e) { applySettings({}); return true; }
}`
  );

  html = html.replace(
    /async function saveSettings\(next\) \{[\s\S]*?\n\}/,
    `async function saveSettings(next) {
    try {
        localStorage.setItem('goalRings:config:' + (currentProfile || 'personal'), JSON.stringify(next));
        applySettings(next);
        return true;
    } catch (e) {
        return "save failed: " + e.message;
    }
}`
  );

  // Replace sessionsCall with localStorage-backed sessions API
  html = html.replace(
    /async function sessionsCall\(path, opts, what\) \{[\s\S]*?\n\}/,
    `async function sessionsCall(path, opts, what) {
    let skey = 'goalRings:sessions:' + (currentProfile || 'personal');
    let readAll = () => { try { return JSON.parse(localStorage.getItem(skey) || '[]'); } catch { return []; } };
    let writeAll = (arr) => localStorage.setItem(skey, JSON.stringify(arr));
    let method = (opts && opts.method) || 'GET';
    if (path.startsWith('/sessions') && method === 'GET') {
        let arr = readAll();
        if (path.includes('?id=')) {
            let id = decodeURIComponent(path.split('?id=')[1]);
            return arr.find(s => s.id === id) || { error: 'Session not found' };
        }
        return { sessions: arr };
    }
    if (path.startsWith('/sessions') && method === 'POST') {
        let body = JSON.parse((opts && opts.body) || '{}');
        let arr = readAll();
        if (body.op === 'save') {
            let rec = { id: 'sess-' + Date.now(), title: body.title, savedAt: body.savedAt, state: body.state, md: body.md || '', mdWorkshop: body.mdWorkshop || '', mdMode: body.mdMode || '', nodeCount: (body.state && body.state.nodes ? body.state.nodes.length : 0) };
            arr.unshift(rec);
            writeAll(arr);
            return rec;
        }
        if (body.op === 'delete') {
            arr = arr.filter(s => s.id !== body.id);
            writeAll(arr);
            return { ok: true };
        }
    }
    if (path.startsWith('/memory')) {
        return { projects: [{ name: 'Local Export', external_id: 'local', is_default: true }], hits: [], error: 'Memory sync is disabled in standalone mode — use Download Markdown instead.' };
    }
    return {};
}`
  );

  // Track deliberate "start over" so the sample map stays cleared unless reloaded cleanly
  html = html.replace(
    'async function clearLiveMap(why) {',
    'async function clearLiveMap(why) {\n    if (why && currentProfile) localStorage.setItem("goalRings:cleared:" + currentProfile, "1");'
  );

  // Auto-select "personal" profile on first boot so the map displays immediately without a gate
  html = html.replace(
    /function startApp\(\) \{[\s\S]*?\n\}/,
    `function startApp() {
    renderProfileScreen();
    let switchTo = sessionStorage.getItem('goalRingsSwitchTo');
    if (switchTo) {
        sessionStorage.removeItem('goalRingsSwitchTo');
        if (PROFILES.includes(switchTo)) { pickProfile(switchTo); return; }
    }
    let target = rememberedProfile() || PROFILES[0];
    pickProfile(target);
}`
  );

  // Make callReplicate fail cleanly with an offline template / message rather than throwing 404 fetch
  html = html.replace(
    /async function callReplicate\([\s\S]*?\n\}\n\n\/\/ Neutral counterpart/,
    `async function callReplicate(prompt, nodeForError = null, call = "break", mapAtCall = state, byTable = false) {
    if (call === "done") {
        return JSON.stringify({
            done_signals: [
                { scope: "modest", artifact: "Draft outline", check: "First draft exists as one readable checklist", anchor: "goal only", done_signal: "One-page outline saved and reviewed for: " + (state.goal || "this goal") + "." },
                { scope: "middle", artifact: "Complete plan", check: "Every step testable on one page", anchor: "goal only", done_signal: "The deliverable for '" + (state.goal || "this goal") + "' is live and tested once end to end." },
                { scope: "ambitious", artifact: "Complete plan + follow-up", check: "Live and shared with first person", anchor: "goal only", done_signal: "The deliverable for '" + (state.goal || "this goal") + "' is live, tested, and sent to one real user." }
            ],
            assumptions: []
        });
    }
    if (call === "break") {
        return JSON.stringify([
            { title: "Clarify scope & constraints", why: "Prevents building the wrong piece", done_signal: "Scope notes written in 3 lines", variables: [] },
            { title: "Create first working version", why: "Produces something concrete to inspect", done_signal: "First version runs locally with sample input", variables: [] },
            { title: "Test edge cases once", why: "Catches obvious breaks early", done_signal: "Checked on mobile and desktop sizes", variables: [] }
        ]);
    }
    if (call === "prune") {
        return JSON.stringify({ decisions: [{ id: "i1", decision: "keep" }, { id: "i2", decision: "keep" }, { id: "i3", decision: "keep" }] });
    }
    if (call === "varmerge") {
        return JSON.stringify({ variable_renames: {} });
    }
    if (call === "xconsolidate" || call === "xsplit" || call === "xorder") {
        return JSON.stringify([]);
    }
    if (call === "bsread") {
        return JSON.stringify({ kind: "choosing between options", material: state.problem || state.goal || "options" });
    }
    if (call === "bsquestions") {
        return JSON.stringify({
            ring1: "What are the main angles or options here?",
            ring2: "What makes this one worth testing?",
            ring3: "What is the smallest concrete next step for this one?",
            centre: "Looking at the whole map, what stands out right now?",
            move: ["list", "probe", "instance", "scan"]
        });
    }
    showError("Live AI synthesis requires an API backend; exporting and local map editing still work offline.", nodeForError);
    return null;
}

// Neutral counterpart`
  );

  // Also ensure export-md-btn works cleanly offline by exporting direct Markdown outline of the map when offline
  html = html.replace(
    /document\.getElementById\('export-md-btn'\)\.addEventListener\('click',\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\n\}\);/,
    `document.getElementById('export-md-btn').addEventListener('click', async () => {
    if (!state.nodes.length) { showError("nothing to export yet", null); return; }
    let mdLines = ['# ' + (state.goal || 'Goal Rings Map'), '', '**Problem:** ' + (state.problem || '—'), '**Done signal:** ' + (state.rootDone || '—'), ''];
    const walkExport = (pid, depth) => {
        for (const n of state.nodes.filter(x => x.parentId === pid)) {
            mdLines.push('  '.repeat(depth) + '- ' + (n.settled ? '[settled] ' : '') + n.title + (n.done ? ' — _' + n.done + '_' : ''));
            walkExport(n.id, depth + 1);
        }
    };
    const rootNode = state.nodes.find(n => n.ring === 0);
    if (rootNode) walkExport(rootNode.id, 0);
    downloadMarkdown(mdLines.join('\\n'), goalSlug());
    showNotice('Exported map outline as Markdown (' + goalSlug() + '.md).');
});`
  );

  fs.writeFileSync(htmlPath, html, 'utf8');

  fs.writeFileSync(path.join(dstRoot, 'README.md'), `# Goal Rings (Standalone Demo)

Three concentric rings (\`Inner / Mid / Outer\`) for unknotting big, vague goals into concrete spatial branches — pre-seeded with a sample map and persisted in browser \`localStorage\`.

## Run locally

Open \`index.html\` directly in a browser, or run a local server from the repository root:

\`\`\`bash
python3 -m http.server 8000
\`\`\`

Then visit \`http://localhost:8000/goal-rings/\`.

## Standalone adaptation

My working copy saves maps in Vercel Blob and expands nodes via a Replicate API proxy. This public copy saves maps and sessions in browser \`localStorage\`, boots with a sample 3-ring map, and exports clean Markdown outlines directly in the browser.

Last synced: ${monthYearNow()}
`, 'utf8');
}

function patchMuscleLookup(dstRoot) {
  // Clean catalogue.json gym field
  const catPath = path.join(dstRoot, 'data/catalogue.json');
  const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));
  cat.gym = 'Strength gym equipment catalogue';
  fs.writeFileSync(catPath, JSON.stringify(cat, null, 2) + '\n', 'utf8');

  // Remove /api/session fetches in app.js so standalone mode works with zero failed requests
  const appPath = path.join(dstRoot, 'app.js');
  let appJs = fs.readFileSync(appPath, 'utf8');

  const seedSnippet = `
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
`;

  appJs = appJs
    .replace('let todaysSession = readTodaysSession();', seedSnippet + '\nlet todaysSession = readTodaysSession();')
    .replace(/let syncState = "checking";/, 'let syncState = "saved";')
    .replace(/saved: "Saved\. Shows on every device you're signed in on\."/, 'saved: "Saved locally in this browser."')
    .replace(/async function pushTodaysSession\(\) \{[\s\S]*?\n\}/, 'async function pushTodaysSession() {\n  markSynced();\n  syncState = "saved";\n  showSessionEverywhere();\n}')
    .replace(/async function pullTodaysSession\(\) \{[\s\S]*?\n\}/, 'async function pullTodaysSession() {\n  syncState = "saved";\n  showSessionEverywhere();\n}');

  fs.writeFileSync(appPath, appJs, 'utf8');

  fs.writeFileSync(path.join(dstRoot, 'README.md'), `# Muscle Look-up (Standalone Demo)

A tap-a-muscle strength exercise manual with zero streaks, zero notifications, and zero workout plans telling you what today demands.

## Run locally

Because \`index.html\` uses ES modules (\`app.js\`) and fetches \`data/catalogue.json\`, serve the folder over HTTP rather than \`file://\`:

\`\`\`bash
python3 -m http.server 8000
\`\`\`

Then visit \`http://localhost:8000/muscle-lookup/\`.

Last synced: ${monthYearNow()}
`, 'utf8');
}

function main() {
  const { sourceRoot, scrubPath, targets } = parseArgs(process.argv.slice(2));
  const scrub = loadScrubRules(scrubPath);
  const selected = targets.length ? targets : Object.keys(MANIFEST.apps);

  for (const key of selected) {
    console.log(`Syncing ${key}...`);
    const { srcRoot, dstRoot } = syncAllowlist(key, sourceRoot);
    MANIFEST.apps[key]._srcRoot = srcRoot;
    if (key === 'five-days') patchFiveDays(dstRoot, scrub);
    else if (key === 'the-randlord') patchRandlord(dstRoot, scrub);
    else if (key === 'spoon-ledger') patchSpoonLedger(dstRoot, scrub);
    else if (key === 'goal-rings') patchGoalRings(dstRoot, scrub);
    else if (key === 'muscle-lookup') patchMuscleLookup(dstRoot, scrub);
    console.log(`  Synced -> ${dstRoot}`);
  }

  console.log('Running verify-clean.mjs...');
  execSync('node scripts/verify-clean.mjs', { cwd: ROOT, stdio: 'inherit' });
}

main();
