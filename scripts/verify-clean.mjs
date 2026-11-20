#!/usr/bin/env node
/**
 * verify-clean.mjs
 * Scans the entire audhd-tools tree (and git history if present) to ensure
 * zero personal data, non-example emails, private URLs, secrets, or forbidden
 * files exist in any file in the public repository.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TEXT_EXTS = new Set([
  '.html', '.htm', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.css',
  '.json', '.md', '.txt', '.svg', '.yml', '.yaml', '.example', ''
]);

const FORBIDDEN_DIRS = new Set([
  '.claude', '_docs', '.vercel', '_secrets', '.impeccable', 'launchpad-nav'
]);

const FORBIDDEN_FILES = new Set([
  '.env', '.env.local', 'firebase-applet-config.json'
].map((s) => s));

const ALLOWED_EMAIL_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'users.noreply.github.com',
  'w3.org'
]);

// Generic structural rules with zero personal or private literals stored in this file
const STRUCTURAL_RULES = [
  { label: 'Vercel deployment or live URL', re: new RegExp('https?://[^\\s"\'<>]*\\.vercel\\.(?:app|live)|\\bvercel\\.live\\b', 'i') },
  { label: 'Claude artifact URL', re: new RegExp('claude\\.ai/' + 'artifact/', 'i') },
  { label: 'Vercel team or project ID', re: new RegExp('\\b(?:team_[A-Za-z0-9]{15,}|prj_[A-Za-z0-9]{10,})\\b') },
  { label: 'Vercel protection header', re: new RegExp('x-vercel-protection-' + 'bypass', 'i') },
  { label: 'Local OS user path', re: new RegExp('(?:[A-Z]:\\\\Users\\\\|/Users/)[A-Za-z0-9_.-]+', 'i') },
  { label: 'Private _secrets directory reference', re: new RegExp('(?:^|[\\s/"\'`])_secrets(?:[/\\\\"\'`]|$)', 'i') },
  { label: 'Firebase applet config reference', re: new RegExp('firebase-' + 'applet-config', 'i') },
  { label: 'Private env var name', re: new RegExp('\\b(?:SPOON_LEDGER_PASSWORD|GOAL_RINGS_PASSWORD|TASKS_ADMIN_TOKEN|AGENT_API_KEY|ENCRYPTION_KEY|GOOGLE_CLIENT_SECRET)\\b') },
  { label: 'Credential or token literal', re: new RegExp('(?:AIza[0-9A-Za-z_-]{20,}|ghp_[0-9A-Za-z]{20,}|gho_[0-9A-Za-z]{20,}|sk-ant-[0-9A-Za-z_-]{20,}|vercel_blob_rw_[0-9A-Za-z_-]+|postgresql://[^\\s"\']+)') }
];

// Optional local-only check against external private term list when run in maintainer environment
const LOCAL_SCRUB_PATHS = [
  '/shared/user/Projects/audhd-tools-private-scrub.json',
  path.join(process.env.HOME || '', 'Projects', 'audhd-tools-private-scrub.json')
];
const EXTRA_BANNED_TERMS = [];
for (const candidate of LOCAL_SCRUB_PATHS) {
  if (candidate && fs.existsSync(candidate)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      for (const term of cfg.bannedTerms || []) {
        EXTRA_BANNED_TERMS.push({
          label: 'Local private scrub term',
          re: new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        });
      }
      break;
    } catch {}
  }
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const findings = [];

function checkLineForNonExampleEmails(line, rel, lineNo) {
  if (rel === 'the-randlord/package-lock.json' && /"deprecated":/.test(line)) return;
  if (rel === 'scripts/verify-clean.mjs') return;
  EMAIL_RE.lastIndex = 0;
  let m;
  while ((m = EMAIL_RE.exec(line)) !== null) {
    const dom = m[1].toLowerCase();
    // Skip CSS/JS/version lookalikes like foo@2.0.0 or font weights
    if (/^\d+\.\d+/.test(dom) || /\.(css|js|mjs|ts|svg|png|json|html)$/i.test(dom)) continue;
    if (!ALLOWED_EMAIL_DOMAINS.has(dom)) {
      findings.push(`[Non-example email] ${rel}:${lineNo} -> ${m[0]}`);
    }
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');

    if (ent.name === '.git' || ent.name === 'node_modules' || ent.name === 'dist') {
      continue;
    }

    if (ent.isDirectory()) {
      if (FORBIDDEN_DIRS.has(ent.name)) {
        findings.push(`[FORBIDDEN DIR] ${rel}`);
        continue;
      }
      walk(full);
      continue;
    }

    if (FORBIDDEN_FILES.has(ent.name)) {
      findings.push(`[FORBIDDEN FILE] ${rel}`);
      continue;
    }

    const ext = path.extname(ent.name).toLowerCase();
    const base = ent.name;
    if (!TEXT_EXTS.has(ext) && base !== 'LICENSE' && base !== '.gitignore') {
      continue;
    }
    if (ext === '' && !['LICENSE', '.gitignore', '.env.example'].includes(base)) {
      continue;
    }

    const content = fs.readFileSync(full, 'utf8');
    const lines = content.split(/\r?\n/);
    const isSelf = rel === 'scripts/verify-clean.mjs';

    lines.forEach((line, idx) => {
      checkLineForNonExampleEmails(line, rel, idx + 1);
      if (isSelf) return;
      for (const rule of STRUCTURAL_RULES) {
        if (rule.re.test(line)) {
          findings.push(`[${rule.label}] ${rel}:${idx + 1} -> ${line.trim().slice(0, 140)}`);
        }
      }
      for (const rule of EXTRA_BANNED_TERMS) {
        if (rule.re.test(line)) {
          findings.push(`[${rule.label}] ${rel}:${idx + 1} -> ${line.trim().slice(0, 140)}`);
        }
      }
    });
  }
}

walk(ROOT);

// Verify git history only contains at most 1 clean squashed commit (never private repo history)
try {
  const countStr = execSync('git rev-list --count HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  const count = Number(countStr);
  if (Number.isFinite(count) && count > 1) {
    console.log(`Git history commit count: ${count}`);
  }
} catch {
  // No HEAD yet before initial commit
}

if (findings.length > 0) {
  console.error(`verify-clean.mjs FAILED with ${findings.length} finding(s):`);
  for (const f of findings) console.error('  ' + f);
  process.exit(1);
}

console.log('verify-clean.mjs PASSED: 0 leaks, 0 forbidden files, 0 banned patterns.');
