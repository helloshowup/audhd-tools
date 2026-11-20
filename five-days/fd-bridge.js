/* Five Days — Standalone browser localStorage bridge for audhd-tools.
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
        ].join('\n')
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
        ].join('\n')
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
        ].join('\n')
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
        ].join('\n')
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
        ].join('\n')
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
        ].join('\n')
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
        ].join('\n')
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
        ].join('\n')
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
        ].join('\n')
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
        ].join('\n')
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
        ].join('\n')
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
            description: '06h - 09h: ☀ 🌡 15°C\n09h - 12h: ☀ 🌡 19°C\n12h - 15h: ☀ 🌡 22°C\n15h - 18h: ⛅ 🌡 20°C\n18h - 21h: 🌙 🌡 16°C'
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
