# twitch-term

Twitch chat in your terminal. Split-screen: live chat scrolls above, message input below — all in one process, no tmux needed.

![demo](./demo.gif)

## Features

- **Live chat** — real-time updates via Twitch IRC
- **Send messages** — just type and press Enter
- **Input history** — arrow up/down to recall sent messages
- **Color-coded** — usernames are coloured by hash
- **Reconnect** — automatic reconnection on disconnect
- **Lightweight** — single TypeScript file, zero external runtime deps (just `tmi.js`)

## Usage

```bash
# Read-only (anonymous)
npx twitch-term <channel>

# Read + send messages (requires OAuth token)
npx twitch-term <channel> --oauth oauth:xxx
```

### Keyboard

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `↑` / `↓` | Input history |
| `Esc` / `Ctrl+C` | Exit |

## OAuth Token

To send messages, you need a Twitch OAuth token with `chat:read` and `chat:edit` scopes.

Get one at [twitchtokengenerator.com](https://twitchtokengenerator.com/) or use the quick CLI:

```bash
curl -s https://twitchtokengenerator.com/api/chat
```

## Install

```bash
# Via npm (soon)
npm install -g twitch-term

# Or clone and run locally
git clone https://github.com/sinclaw-bot/twitch-term.git
cd twitch-term
npm install
npm start <channel>
```

## Development

```bash
npm run dev      # run with tsx watch (auto-reload)
npm run build    # compile to dist/
npm run lint     # Biome check
npm run format   # Biome format
```

Built with:
- [tmi.js](https://github.com/tmijs/tmi.js) — Twitch IRC client
- [tsx](https://github.com/privatenumber/tsx) — TypeScript execution
- [Biome](https://biomejs.dev/) — formatting & linting

## License

MIT
