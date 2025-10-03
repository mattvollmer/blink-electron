# Deployment Guide

## Prerequisites

Before deploying, ensure:
- All tests pass (if you add them)
- Code is linted: `npm run lint`
- All dependencies are installed
- You've tested on your target platform

## Local Testing

```bash
npm start
```

Test all features:
- Add project
- Start/stop project
- Chat with agent
- Multiple projects simultaneously
- Error handling

## Building for Production

### Package (without installer)

```bash
npm run package
```

This creates a runnable app in `out/` without an installer.

**Output locations:**
- macOS: `out/blink-desktop-darwin-x64/`
- Windows: `out/blink-desktop-win32-x64/`
- Linux: `out/blink-desktop-linux-x64/`

### Make (with installer)

```bash
npm run make
```

This creates distributable installers:

**macOS:**
- `.dmg` file in `out/make/`
- `.zip` file in `out/make/zip/darwin/x64/`

**Windows:**
- `.exe` installer in `out/make/squirrel.windows/x64/`

**Linux:**
- `.deb` package in `out/make/deb/x64/`
- `.rpm` package in `out/make/rpm/x64/`

## Cross-Platform Building

### Building Windows from macOS/Linux

```bash
npm run make -- --platform=win32 --arch=x64
```

Note: You'll need Wine installed for this to work fully.

### Building Linux from macOS

```bash
npm run make -- --platform=linux
```

### Building macOS from Linux (not recommended)

Requires significant setup. Better to build on actual macOS.

## Code Signing

### macOS

1. Get an Apple Developer certificate
2. Add to Forge config:

```javascript
// forge.config.ts
export default {
  packagerConfig: {
    osxSign: {
      identity: 'Developer ID Application: Your Name (TEAM_ID)',
      hardened-runtime: true,
      entitlements: 'entitlements.plist',
      'entitlements-inherit': 'entitlements.plist',
    },
    osxNotarize: {
      tool: 'notarytool',
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    },
  },
};
```

3. Create `entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <true/>
</dict>
</plist>
```

### Windows

1. Get a code signing certificate
2. Add to Forge config:

```javascript
// forge.config.ts
export default {
  packagerConfig: {
    win32metadata: {
      CompanyName: 'Your Company',
      FileDescription: 'Blink Desktop',
      OriginalFilename: 'blink-desktop.exe',
      ProductName: 'Blink Desktop',
      InternalName: 'Blink Desktop',
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        certificateFile: './cert.pfx',
        certificatePassword: process.env.CERT_PASSWORD,
      },
    },
  ],
};
```

## Auto-Update Setup

### Using electron-updater

1. Install:

```bash
npm install electron-updater
```

2. Update main process:

```typescript
import { autoUpdater } from 'electron-updater';

app.on('ready', () => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});
```

3. Configure in package.json:

```json
{
  "build": {
    "publish": [
      {
        "provider": "github",
        "owner": "your-username",
        "repo": "blink-desktop"
      }
    ]
  }
}
```

## Distribution

### Option 1: GitHub Releases

1. Create a GitHub release
2. Upload the built installers
3. Users download and install

### Option 2: Website

1. Host installers on your website
2. Provide download links
3. Include checksums for verification

### Option 3: App Stores

**Mac App Store:**
- Requires Apple Developer Program ($99/year)
- Additional entitlements needed
- Sandboxing required
- Review process (1-2 weeks)

**Microsoft Store:**
- Requires Developer account
- MSIX packaging needed
- Review process

### Option 4: Package Managers

**Homebrew (macOS):**
```bash
brew install --cask blink-desktop
```

**Chocolatey (Windows):**
```bash
choco install blink-desktop
```

**Snap (Linux):**
```bash
sudo snap install blink-desktop
```

## CI/CD Setup

### GitHub Actions Example

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run make
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.os }}-build
          path: out/make/**/*
      
      - name: Release
        uses: softprops/action-gh-release@v1
        if: startsWith(github.ref, 'refs/tags/')
        with:
          files: out/make/**/*
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Version Management

### Semantic Versioning

Follow semver (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes

Update in `package.json`:

```json
{
  "version": "1.0.0"
}
```

### Changelog

Keep a CHANGELOG.md:

```markdown
# Changelog

## [1.0.0] - 2024-01-15

### Added
- Multi-project management
- Real-time chat interface
- Process monitoring

### Changed
- Improved UI responsiveness

### Fixed
- Memory leak in chat component
```

## Pre-Release Checklist

- [ ] All features working
- [ ] No console errors
- [ ] Tested on target platform(s)
- [ ] Code signed (if applicable)
- [ ] Version number updated
- [ ] CHANGELOG updated
- [ ] README updated
- [ ] Screenshots/demos prepared
- [ ] License file included
- [ ] Dependencies audited: `npm audit`
- [ ] Build artifacts tested

## Post-Release

1. Tag the release:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. Create GitHub release with notes

3. Update download links on website

4. Announce on social media/community

5. Monitor for issues

## Troubleshooting Builds

### Build fails on macOS

**Issue**: Code signing fails
**Fix**: Ensure certificate is valid and not expired

### Build fails on Windows

**Issue**: Missing Visual Studio Build Tools
**Fix**: Install from https://visualstudio.microsoft.com/downloads/

### Build succeeds but app won't start

**Issue**: Missing native dependencies
**Fix**: Check `npm install` ran successfully

### Large bundle size

**Issue**: App is >200MB
**Fix**: 
- Remove unused dependencies
- Use `asar` packing (enabled by default)
- Exclude dev dependencies from build

## Security Considerations

- [ ] Context isolation enabled
- [ ] Node integration disabled in renderer
- [ ] CSP headers configured
- [ ] No eval() usage
- [ ] Dependencies updated
- [ ] Secrets not hardcoded
- [ ] User input sanitized

## Performance Optimization

- Use `--production` flag when packaging
- Enable compression in Forge config
- Lazy load large components
- Minimize bundle with tree-shaking
- Use native modules where possible

## Support

After deployment:

1. Set up error tracking (Sentry, Rollbar)
2. Create FAQ/troubleshooting guide
3. Set up support email/chat
4. Monitor GitHub issues
5. Respond to user feedback

## Next Steps

After successful deployment:

1. Collect user feedback
2. Plan next version features
3. Fix critical bugs quickly
4. Release patches regularly
5. Build community around the app
