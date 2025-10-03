import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { blinkProcessManager } from './blinkProcessManager';
import fs from 'fs/promises';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Disable CORS for localhost development
    },
  });

  // Set the main window for process manager
  blinkProcessManager.setMainWindow(mainWindow);

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools in development
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
};

// IPC Handlers
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  return result.filePaths[0];
});

ipcMain.handle('start-blink-project', async (event, projectId: string, projectPath: string, port: number) => {
  try {
    await blinkProcessManager.startProject(projectId, projectPath, port);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-blink-project', async (event, projectId: string) => {
  try {
    blinkProcessManager.stopProject(projectId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-file', async (event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-file', async (event, filePath: string, content: string) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-blink-project', async (event, projectPath: string) => {
  try {
    // Check if agent.ts exists
    const agentPath = path.join(projectPath, 'agent.ts');
    await fs.access(agentPath);
    return { success: true, isBlinkProject: true };
  } catch {
    return { success: true, isBlinkProject: false };
  }
});

ipcMain.handle('init-blink-project', async (event, projectPath: string) => {
  try {
    // Run blink init in the project directory
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
      const initProcess = spawn('blink', ['init'], {
        cwd: projectPath,
        shell: true,
      });

      let output = '';
      let errorOutput = '';

      initProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      initProcess.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      initProcess.on('close', (code: number) => {
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          resolve({ success: false, error: errorOutput || output });
        }
      });

      initProcess.on('error', (error: Error) => {
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('run-blink-login', async () => {
  try {
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
      const loginProcess = spawn('blink', ['login'], {
        shell: true,
        stdio: 'inherit', // Show interactive prompt in terminal
      });

      loginProcess.on('close', (code: number) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: `Login process exited with code ${code}` });
        }
      });

      loginProcess.on('error', (error: Error) => {
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-agent-api-key', async (event, projectPath: string, apiKey: string, provider: string) => {
  try {
    const agentPath = path.join(projectPath, 'agent.ts');
    let agentContent = await fs.readFile(agentPath, 'utf-8');
    
    // Update the model line based on provider
    if (provider === 'anthropic') {
      // Replace blink.model with direct Anthropic
      agentContent = agentContent.replace(
        /model: blink\.model\([^)]+\)/,
        `model: anthropic('claude-3-5-sonnet-20241022')`
      );
      
      // Add Anthropic import if not present
      if (!agentContent.includes('import { anthropic }')) {
        agentContent = `import { anthropic } from '@ai-sdk/anthropic';\n${agentContent}`;
      }
    } else if (provider === 'openai') {
      // Replace blink.model with direct OpenAI
      agentContent = agentContent.replace(
        /model: blink\.model\([^)]+\)/,
        `model: openai('gpt-4-turbo')`
      );
      
      // Add OpenAI import if not present
      if (!agentContent.includes('import { openai }')) {
        agentContent = `import { openai } from '@ai-sdk/openai';\n${agentContent}`;
      }
    }
    
    await fs.writeFile(agentPath, agentContent, 'utf-8');
    
    // Update .env.local with API key
    const envPath = path.join(projectPath, '.env.local');
    let envContent = '';
    try {
      envContent = await fs.readFile(envPath, 'utf-8');
    } catch {
      // File doesn't exist, create new
    }
    
    const envKey = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
    const envLine = `${envKey}=${apiKey}`;
    
    if (envContent.includes(envKey)) {
      // Replace existing key
      envContent = envContent.replace(new RegExp(`${envKey}=.*`), envLine);
    } else {
      // Add new key
      envContent += `\n${envLine}\n`;
    }
    
    await fs.writeFile(envPath, envContent, 'utf-8');
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  blinkProcessManager.stopAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  blinkProcessManager.stopAll();
});
