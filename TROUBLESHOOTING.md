# Troubleshooting Guide

## PostCSS / Tailwind Errors

### Error: "It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin"

**Cause**: Tailwind CSS v4 changed how it integrates with PostCSS.

**Fix**: The repo now uses Tailwind v3 which is stable. Run:

```bash
rm -rf node_modules package-lock.json
npm install
npm start
```

### Error: Module not found errors after install

**Fix**: Clear cache and reinstall:

```bash
rm -rf node_modules package-lock.json .vite
npm install
npm start
```

## Electron Won't Start

### Error: "Multiple plugins tried to take control of the start command"

**Cause**: FusesPlugin conflicting with VitePlugin in forge.config.ts

**Fix**: This is already fixed in the latest version. If you still see it:

```bash
git pull origin main
rm -rf node_modules package-lock.json
npm install
npm start
```

If you're on an older version, comment out the FusesPlugin in `forge.config.ts`.

### Error: "libgtk-3.so.0: cannot open shared object file"

**Cause**: Missing system libraries (Linux only)

**Fix**: Install required packages:

```bash
# Ubuntu/Debian
sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libdrm2 libgbm1 libxcb-dri3-0

# Fedora
sudo dnf install gtk3 libnotify nss libXScrnSaver libXtst xdg-utils at-spi2-atk libdrm mesa-libgbm
```

## Blink Integration Issues

### Error: "This directory does not contain a Blink project"

**Cause**: Selected directory doesn't have `agent.ts`

**Fix**: Initialize a Blink project first:

```bash
cd /path/to/your/project
blink init
```

### Error: "Failed to start project"

**Cause**: Blink CLI not found or project missing dependencies

**Fix**:

1. Ensure Blink is installed:
   ```bash
   npm install -g blink
   which blink  # Should show path
   ```

2. Install project dependencies:
   ```bash
   cd /path/to/your/blink/project
   npm install
   ```

3. Try starting manually first:
   ```bash
   cd /path/to/your/blink/project
   blink dev
   ```

### Error: "Cannot connect to agent"

**Cause**: Project not running or port already in use

**Fix**:

1. Check project status in sidebar (should show green "● Running")
2. Click Stop, then Start again
3. Check if port is in use:
   ```bash
   lsof -i :3000  # Replace 3000 with your project's port
   ```
4. Kill conflicting process:
   ```bash
   kill -9 <PID>
   ```

## Build / Package Issues

### Error: Build fails with TypeScript errors

**Fix**: Ensure you're using the correct Node version:

```bash
node -v  # Should be 20.x or higher
npm install -g npm@latest
rm -rf node_modules package-lock.json
npm install
```

### Error: "npm run make" fails

**Cause**: Missing build tools

**Fix**:

**macOS**:
```bash
xcode-select --install
```

**Windows**:
- Install Visual Studio Build Tools
- Or install Visual Studio Community with C++ development tools

**Linux**:
```bash
sudo apt-get install build-essential
```

## Development Issues

### Hot reload not working

**Fix**: Restart the dev server:

1. Stop the app (Cmd/Ctrl+C in terminal)
2. Run `npm start` again

### DevTools not opening

**Fix**: The app only opens DevTools in development mode. Check `src/main.ts`:

```typescript
if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
  mainWindow.webContents.openDevTools();
}
```

### Changes not reflecting in UI

**Fix**:

1. Hard refresh: Cmd/Ctrl+Shift+R
2. Or restart the app: `rs` in terminal (if available)
3. Or stop and `npm start` again

## Runtime Errors

### Error: "Cannot read property of undefined"

**Likely cause**: Race condition with project state

**Fix**: Check that project is running before chatting:

```typescript
if (project.status !== 'running') {
  // Don't allow chat
}
```

### Error: Process won't stop

**Fix**: Manually kill the process:

```bash
# Find blink processes
ps aux | grep blink

# Kill specific process
kill -9 <PID>

# Kill all blink processes
pkill -9 blink
```

## Performance Issues

### App is slow or laggy

**Causes**:
- Too many projects running
- Long chat history
- Memory leak

**Fixes**:

1. Stop unused projects
2. Restart the app to clear memory
3. Clear chat history (if implemented)
4. Check Activity Monitor/Task Manager for memory usage

### High CPU usage

**Cause**: Background blink processes still running

**Fix**:

```bash
# macOS/Linux
ps aux | grep "blink start" | grep -v grep | awk '{print $2}' | xargs kill

# Windows (PowerShell)
Get-Process | Where-Object {$_.ProcessName -like "*blink*"} | Stop-Process
```

## Chat Interface Issues

### Messages not streaming

**Cause**: Network or blink agent not responding

**Fix**:

1. Check browser console for errors (DevTools)
2. Verify agent is responding:
   ```bash
   curl http://localhost:3000  # Replace 3000 with your port
   ```
3. Restart the project

### Messages out of order

**Cause**: Race condition in React state updates

**Fix**: This is a bug - please report it! Workaround:

1. Stop the project
2. Refresh the app (Cmd/Ctrl+R)
3. Start the project again

## Data / State Issues

### Projects disappear after restart

**Cause**: Currently, project state isn't persisted

**Workaround**: Re-add projects each session

**Future fix**: Will add localStorage persistence

### Chat history lost

**Expected behavior**: Chat history is currently not persisted

**Future feature**: Will add chat history saving to `.blink/data/chats/`

## Getting Help

### Still having issues?

1. **Check logs**:
   - Main process: Terminal output
   - Renderer: DevTools Console
   - Blink agent: Terminal running `blink dev`

2. **Enable verbose logging** (future feature):
   ```bash
   DEBUG=* npm start
   ```

3. **Create an issue**:
   - Go to GitHub Issues
   - Include:
     - Operating system and version
     - Node.js version (`node -v`)
     - Error messages (full stack trace)
     - Steps to reproduce
     - Screenshots if applicable

4. **Quick debug checklist**:
   - [ ] Node.js 20+ installed?
   - [ ] Blink CLI installed globally?
   - [ ] Project has `agent.ts`?
   - [ ] Project dependencies installed?
   - [ ] Port not in use?
   - [ ] No console errors in DevTools?

## Common Mistakes

### Pointing to wrong directory

❌ **Wrong**: Selecting a directory without `agent.ts`
✅ **Right**: Select the root of a Blink project (with `agent.ts`, `package.json`, etc.)

### Not installing project dependencies

❌ **Wrong**: Adding a fresh `blink init` without `npm install`
✅ **Right**: 
```bash
cd my-project
blink init
npm install  # Must do this!
```

### Starting app without Blink CLI

❌ **Wrong**: Running app without Blink installed
✅ **Right**:
```bash
npm install -g blink
blink --version  # Verify
npm start  # Now start app
```

## Reset to Clean State

If everything is broken:

```bash
# Stop all blink processes
pkill -9 blink

# Clean the app
cd blink-electron
rm -rf node_modules package-lock.json .vite
npm install

# Restart
npm start
```

## Known Limitations

1. **No persistence**: Projects and chat history not saved between sessions
2. **Single chat per project**: Can't have multiple conversations
3. **No agent editing**: Must edit `agent.ts` externally
4. **No deploy UI**: Must deploy from terminal
5. **Port conflicts**: Manual port management if conflicts occur

These are all future enhancements!
