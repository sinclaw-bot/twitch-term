#!/usr/bin/env node

/**
 * twitch-term — Twitch chat in your terminal
 *
 * Split-screen: live chat scrolls above, message input below.
 *
 * Usage:
 *   npx twitch-term <channel>                 # read-only
 *   npx twitch-term <channel> --oauth <token> # send messages
 */

import * as readline from 'node:readline';
import tmi from 'tmi.js';

// ── CLI Args ──

const CHANNEL = process.argv[2]?.replace(/^#/, '')?.toLowerCase();
const OAUTH_INDEX = process.argv.indexOf('--oauth');
const OAUTH = OAUTH_INDEX !== -1 ? process.argv[OAUTH_INDEX + 1] : undefined;

if (!CHANNEL || CHANNEL === '--help') {
  console.error(
    [
      '',
      '  twitch-term — Twitch chat in your terminal',
      '',
      '  Usage:',
      '    twitch-term <channel>                 read chat (anonymous)',
      '    twitch-term <channel> --oauth <token> read + send messages',
      '',
      '  Get an OAuth token: https://twitchtokengenerator.com/ (scope: chat:read + chat:edit)',
      '',
    ].join('\n'),
  );
  process.exit(CHANNEL ? 0 : 1);
}

// ── Constants ──

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

const USER_COLORS = [
  '\x1b[31m',
  '\x1b[32m',
  '\x1b[33m',
  '\x1b[34m',
  '\x1b[35m',
  '\x1b[36m',
  '\x1b[91m',
  '\x1b[92m',
  '\x1b[93m',
  '\x1b[94m',
  '\x1b[95m',
  '\x1b[96m',
];

function hashColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h << 5) - h + c.charCodeAt(0);
  return USER_COLORS[(Math.abs(h) >>> 0) % USER_COLORS.length];
}

// ── Chat State ──

type ChatLine =
  | { type: 'msg'; user: string; text: string }
  | { type: 'system'; text: string }
  | { type: 'join'; user: string }
  | { type: 'part'; user: string };

const chat: ChatLine[] = [];
const MAX_VISIBLE = 500;
let dirty = true;
let running = true;

// ── Input State ──

let input = '';
const history: string[] = [];
let histIdx = -1;

// ── Render ──

function render() {
  if (!dirty && !needsInput) return;
  dirty = false;
  needsInput = false;

  // Read terminal dimensions fresh every render
  const rows = process.stdout.rows;

  const title = ` ${DIM}twitch-term — #${CHANNEL}${RESET}`;
  const inputRow = rows;
  const prompt = '> ';
  const chatRows = rows - 3; // title + separator + input line

  const start = Math.max(0, chat.length - chatRows);
  const visible = chat.slice(start, start + chatRows);

  let out = '\x1b[0;0H\x1b[J'; // home + clear to end
  out += `${title}\n`;

  for (const line of visible) {
    if (line.type === 'msg') {
      const color = hashColor(line.user);
      out += `${color}${BOLD}${line.user}:${RESET} ${line.text}\n`;
    } else if (line.type === 'system') {
      out += `\x1b[32m[${line.text}]\x1b[0m\n`;
    } else if (line.type === 'join') {
      out += `${DIM}→ ${line.user} joined${RESET}\n`;
    } else if (line.type === 'part') {
      out += `${DIM}← ${line.user} left${RESET}\n`;
    }
  }

  out += `${DIM}─${'─'.repeat(process.stdout.columns - 2)}${RESET}\n`;
  out += `${BOLD}${prompt}${RESET}${input}`;

  const cx = prompt.length + input.length + 1;
  out += `\x1b[${inputRow};${cx}H`;
  process.stdout.write(out);
}

let needsInput = true;
let renderPending = false;

function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  setImmediate(() => {
    renderPending = false;
    render();
  });
}

// ── Twitch Client ──

const client = new tmi.Client({
  identity: OAUTH ? { username: 'fix', password: OAUTH } : undefined,
  channels: [CHANNEL],
  connection: { reconnect: true },
});

function append(line: ChatLine) {
  chat.push(line);
  if (chat.length > MAX_VISIBLE) chat.splice(0, chat.length - MAX_VISIBLE);
  dirty = true;
  scheduleRender();
}

client.on('message', (_channel, tags, message) => {
  const user = tags['display-name'] ?? tags.username ?? '?';
  append({ type: 'msg', user, text: message });
});

client.on('join', (_channel, user) => append({ type: 'join', user }));
client.on('part', (_channel, user) => append({ type: 'part', user }));
client.on('connected', () => append({ type: 'system', text: 'Connected' }));
client.on('disconnected', (reason) => append({ type: 'system', text: `Disconnected: ${reason}` }));

// ── Keyboard ──

function cleanup() {
  running = false;
  process.stdin.setRawMode?.(false);
  process.stdin.removeAllListeners('keypress');
  process.stdout.write('\x1b[2J\x1b[0;0H\x1b[?1049l'); // restore screen
  client.disconnect().catch(() => {});
}

process.stdin.setRawMode?.(true);
readline.emitKeypressEvents(process.stdin);

process.stdin.on('keypress', (_str, key) => {
  if (!running) return;

  if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
    cleanup();
    process.exit(0);
  }

  if (key.name === 'return') {
    if (input.trim()) {
      client.say(CHANNEL, input.trim()).catch(() => {});
      history.push(input.trim());
      histIdx = history.length;
      input = '';
    }
  } else if (key.name === 'backspace') {
    input = input.slice(0, -1);
  } else if (key.name === 'up') {
    if (history.length > 0) {
      histIdx = Math.max(0, histIdx - 1);
      input = history[histIdx] ?? '';
    }
  } else if (key.name === 'down') {
    histIdx = Math.min(history.length, histIdx + 1);
    input = history[histIdx] ?? '';
  } else if (key.sequence?.length === 1 && key.sequence.charCodeAt(0) >= 32) {
    input += key.sequence;
  }

  dirty = true;
  scheduleRender();
});

process.stdout.on('resize', () => {
  // Reset renderPending so resize always triggers a fresh render
  renderPending = false;
  dirty = true;
  scheduleRender();
});

// ── Main ──

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});
process.on('exit', () => process.stdout.write('\x1b[?1049l'));

console.clear();
process.stdout.write('\x1b[?1049h'); // alt screen
client.connect().catch(() => {});
scheduleRender();

// Keep cursor responsive even when no chat activity
setInterval(() => {
  if (!dirty) {
    const rows = process.stdout.rows;
    const prompt = '> ';
    const cx = prompt.length + input.length + 1;
    process.stdout.write(`\x1b[${rows};${cx}H`);
  }
}, 100);
