# Blink Desktop

A beautiful Electron desktop app for managing and chatting with Blink AI agents.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Electron](https://img.shields.io/badge/Electron-191970?logo=Electron&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)

## Features

- **Multi-Project Management** - Add and manage unlimited Blink agent projects
- **Real-Time Chat** - Stream responses from your AI agents in real-time
- **Process Control** - Start/stop agents with visual status indicators
- **Beautiful UI** - Modern interface built with shadcn/ui and Tailwind CSS
- **Type-Safe** - Full TypeScript support throughout

## Prerequisites

- **Node.js 20+**
- **Blink CLI**: `npm install -g blink`
- At least one Blink project (`blink init`)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/mattvollmer/blink-electron.git
cd blink-electron

# Install dependencies  
npm install

# Start the app
npm start
```

> **Having issues?** Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - especially the PostCSS/Tailwind section.

## Usage

### 1. Add a Project

1. Click "Add Project" in the sidebar
2. Select a directory containing a Blink project (`agent.ts` file)
3. Project appears in the sidebar

### 2. Start Chatting

1. Click the ▶️ Play button next to your project
2. Wait for status to show "● Running" (green)
3. Type your message and press Enter
4. Watch responses stream in real-time

### 3. Manage Projects

- **Stop**: Click ■ Stop button
- **Switch**: Click different project in sidebar  
- **Remove**: Click 🗑️ trash icon (with confirmation)

## How It Works

```
Electron App
  ├─ Main Process
  │   ├─ Spawns: blink start --port 3000
  │   ├─ Spawns: blink start --port 3001
  │   └─ IPC handlers for file/process operations
  │
  └─ Renderer Process (React)
      ├─ Uses blink/client to connect to localhost:3000
      ├─ Streams responses via HTTP/SSE
      └─ Updates UI in real-time
```

Each project runs independently on its own port.

## Project Structure

```
src/
├── main.ts                    # Electron main process
├── preload.ts                 # IPC bridge (secure)
├── renderer.ts                # React entry point
├── blinkProcessManager.ts     # Process spawning
├── App.tsx                    # Root component
├── components/
│   ├── ChatInterface.tsx      # Chat UI + blink/client
│   ├── ProjectSidebar.tsx     # Project list + controls
│   └── ui/                    # shadcn/ui components
└── store/
    └── projectStore.ts        # Zustand state management
```

## Development

```bash
# Start dev server with hot reload
npm start

# Lint code
npm run lint

# Package for current platform
npm run package

# Create distributables
npm run make
```

## Building for Production

### Package (no installer)

```bash
npm run package
# Output: out/blink-desktop-{platform}-{arch}/
```

### Make (with installer)

```bash
npm run make
# macOS: out/make/*.dmg
# Windows: out/make/squirrel.windows/x64/*.exe
# Linux: out/make/*.deb, *.rpm
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for code signing, auto-updates, and distribution.

## Tech Stack

| Technology | Purpose |
|------------|--------|
| Electron | Desktop app framework |
| React 19 | UI library |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| Tailwind CSS | Styling |
| shadcn/ui | Component library |
| Zustand | State management |
| blink/client | Official Blink client |
| Vercel AI SDK | Streaming responses |

## Architecture Decisions

### Why HTTP API instead of terminal wrapping?

✅ **Clean communication** - No parsing terminal output  
✅ **Type-safe** - Official client library with TypeScript  
✅ **Reliable** - HTTP/SSE is production-ready  
✅ **Multi-project** - Each project on separate port  
✅ **Streaming** - Real-time responses via ReadableStream

### Why Electron?

- Native file system access (for project directories)
- Process spawning (`blink start`)
- System integration (menus, notifications)
- Cross-platform (macOS, Windows, Linux)

## Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 5 minutes
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues and fixes
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Architecture deep-dive
- **[UI_OVERVIEW.md](UI_OVERVIEW.md)** - Visual interface guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment

## Troubleshooting

### PostCSS Error on Start

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#postcss--tailwind-errors) - This is fixed in latest version.

### Project Won't Start

1. Ensure Blink CLI is installed: `which blink`
2. Check project has dependencies: `cd project && npm install`
3. Try manual start: `cd project && blink dev`

### Can't Connect to Agent

1. Verify project status shows green "● Running"
2. Check port isn't in use: `lsof -i :3000`
3. Restart the project (Stop then Start)

For more issues, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Roadmap

### Planned Features

- [ ] Agent.ts editor (syntax highlighting)
- [ ] Environment variable manager
- [ ] Deploy to Blink Cloud button
- [ ] Chat history persistence
- [ ] Multiple chats per project
- [ ] Dark mode toggle
- [ ] Project templates
- [ ] Settings panel

### Known Limitations

- No persistence between sessions
- Single chat per project
- Manual port management
- No in-app agent editing

Contributions welcome!

## Contributing

This is a demonstration project, but PRs are welcome!

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feat/amazing-feature`
5. Open a Pull Request

## License

MIT

## Credits

Built with:
- [Blink](https://blink.so) - AI agent framework
- [Electron Forge](https://www.electronforge.io/) - Electron toolkit
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [Vercel AI SDK](https://sdk.vercel.ai/) - AI streaming

## Support

- **Issues**: [GitHub Issues](https://github.com/mattvollmer/blink-electron/issues)
- **Documentation**: See docs folder
- **Blink Docs**: [blink.so/docs](https://blink.so/docs)

---

Made with ❤️ for the Blink community
