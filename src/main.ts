import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { blinkProcessManager } from "./blinkProcessManager";
import fs from "fs/promises";
import WebSocket from "ws";

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
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Disable CORS for localhost development
    },
  });

  // Build a custom menu to map Cmd/Ctrl+R to "Refresh Chat" instead of reload
  const menuTemplate: Array<Electron.MenuItemConstructorOptions> = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "View",
      submenu: [
        {
          label: "Refresh Chat",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            if (!mainWindow.isDestroyed()) {
              mainWindow.webContents.send("app:refresh-chat");
            }
          },
        },
        { type: "separator" },
        { role: "toggleDevTools" },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

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
ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle(
  "start-blink-project",
  async (event, projectId: string, projectPath: string, port: number) => {
    try {
      await blinkProcessManager.startProject(projectId, projectPath, port);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle("stop-blink-project", async (event, projectId: string) => {
  try {
    blinkProcessManager.stopProject(projectId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("read-file", async (event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "write-file",
  async (event, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, "utf-8");
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle("check-blink-project", async (event, projectPath: string) => {
  try {
    // Check if agent.ts exists
    const agentPath = path.join(projectPath, "agent.ts");
    await fs.access(agentPath);
    return { success: true, isBlinkProject: true };
  } catch {
    return { success: true, isBlinkProject: false };
  }
});

ipcMain.handle(
  "check-directory-exists",
  async (event, directoryPath: string) => {
    try {
      const stats = await fs.stat(directoryPath);
      return { exists: stats.isDirectory() };
    } catch {
      return { exists: false };
    }
  },
);

ipcMain.handle("init-blink-project", async (event, projectPath: string) => {
  try {
    // Run blink init in the project directory
    const { spawn } = require("child_process");

    return new Promise((resolve) => {
      const initProcess = spawn("blink", ["init"], {
        cwd: projectPath,
        shell: true,
      });

      let output = "";
      let errorOutput = "";

      initProcess.stdout?.on("data", (data: Buffer) => {
        output += data.toString();
      });

      initProcess.stderr?.on("data", (data: Buffer) => {
        errorOutput += data.toString();
      });

      initProcess.on("close", (code: number) => {
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          resolve({ success: false, error: errorOutput || output });
        }
      });

      initProcess.on("error", (error: Error) => {
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("run-blink-login", async (event) => {
  try {
    return new Promise((resolve) => {
      // Generate a unique ID for this auth session
      const authId = `cli-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Connect to Blink's CommandLineAuth WebSocket
      const ws = new WebSocket(`wss://blink.so/api/auth?id=${authId}`, {
        headers: {
          "User-Agent": "Blink-Desktop-App",
        },
        followRedirects: true,
        maxRedirects: 10,
      });

      let resolved = false;

      ws.on("open", () => {
        console.log("[Blink Auth] WebSocket connected");

        // Open browser to auth page with the ID
        const authUrl = `https://blink.so/auth?id=${authId}`;
        shell.openExternal(authUrl);
        console.log("[Blink Auth] Opening:", authUrl);
        console.log("[Blink Auth] Waiting for authorization...");
      });

      ws.on("message", async (data: Buffer) => {
        try {
          const token = data.toString();
          console.log("[Blink Auth] Received token");

          // Save token using Blink's auth system
          const os = require("os");
          const path = require("path");
          const fs = require("fs");

          // Determine Blink data directory
          const homeDir = os.homedir();
          let dataDir;

          if (process.platform === "darwin") {
            dataDir = path.join(
              homeDir,
              "Library",
              "Application Support",
              "blink",
            );
          } else if (process.platform === "win32") {
            dataDir = path.join(homeDir, "AppData", "Roaming", "blink");
          } else {
            dataDir = path.join(homeDir, ".local", "share", "blink");
          }

          // Create directory if it doesn't exist
          if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
          }

          // Save auth.json
          const authPath = path.join(dataDir, "auth.json");
          const authData = {
            _: "This is your Blink credentials file. DO NOT SHARE THIS FILE WITH ANYONE!",
            token: token,
          };

          fs.writeFileSync(authPath, JSON.stringify(authData, null, 2));

          ws.close();
          if (!resolved) {
            resolved = true;
            resolve({ success: true });
          }
        } catch (error: any) {
          ws.close();
          if (!resolved) {
            resolved = true;
            resolve({ success: false, error: error.message });
          }
        }
      });

      ws.on("error", (error: Error) => {
        console.error("[Blink Auth] WebSocket error:", error);
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: error.message });
        }
      });

      ws.on("close", () => {
        console.log("[Blink Auth] WebSocket closed");
        if (!resolved) {
          resolved = true;
          resolve({
            success: false,
            error:
              'Connection closed. Please try again and make sure to click "Authorize" on the blink.so page.',
          });
        }
      });

      // Timeout after 2 minutes
      setTimeout(
        () => {
          if (!resolved) {
            console.log("[Blink Auth] Timeout");
            ws.close();
            resolved = true;
            resolve({
              success: false,
              error:
                'Authentication timeout. Please try again and make sure to click "Authorize" on the blink.so page.',
            });
          }
        },
        2 * 60 * 1000,
      );
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "update-agent-api-key",
  async (event, projectPath: string, apiKey: string, provider: string) => {
    try {
      console.log("[update-agent-api-key] Project path:", projectPath);
      console.log("[update-agent-api-key] Provider:", provider);
      console.log("[update-agent-api-key] API key length:", apiKey.length);

      const envPath = path.join(projectPath, ".env.local");
      console.log("[update-agent-api-key] Env path:", envPath);

      let envContent = "";
      try {
        envContent = await fs.readFile(envPath, "utf-8");
        console.log("[update-agent-api-key] Existing env content:", envContent);
      } catch {
        console.log("[update-agent-api-key] No existing .env.local file");
      }

      let envKey: string;

      if (provider === "blink") {
        // For Blink, just add the API key to env
        envKey = "BLINK_TOKEN";
      } else if (provider === "anthropic") {
        envKey = "ANTHROPIC_API_KEY";
        // Also update agent.ts to use anthropic directly
        const agentPath = path.join(projectPath, "agent.ts");
        let agentContent = await fs.readFile(agentPath, "utf-8");

        agentContent = agentContent.replace(
          /model: blink\.model\([^)]+\)/,
          `model: anthropic('claude-3-5-sonnet-20241022')`,
        );

        if (!agentContent.includes("import { anthropic }")) {
          agentContent = `import { anthropic } from '@ai-sdk/anthropic';\n${agentContent}`;
        }

        await fs.writeFile(agentPath, agentContent, "utf-8");
      } else if (provider === "openai") {
        envKey = "OPENAI_API_KEY";
        // Also update agent.ts to use openai directly
        const agentPath = path.join(projectPath, "agent.ts");
        let agentContent = await fs.readFile(agentPath, "utf-8");

        agentContent = agentContent.replace(
          /model: blink\.model\([^)]+\)/,
          `model: openai('gpt-4-turbo')`,
        );

        if (!agentContent.includes("import { openai }")) {
          agentContent = `import { openai } from '@ai-sdk/openai';\n${agentContent}`;
        }

        await fs.writeFile(agentPath, agentContent, "utf-8");
      } else {
        return { success: false, error: "Unknown provider" };
      }

      const envLine = `${envKey}=${apiKey}`;

      if (envContent.includes(envKey)) {
        // Replace existing key
        envContent = envContent.replace(new RegExp(`${envKey}=.*`), envLine);
      } else {
        // Add new key
        envContent += `\n${envLine}\n`;
      }

      console.log(
        "[update-agent-api-key] Writing env file with content:",
        envContent,
      );
      await fs.writeFile(envPath, envContent, "utf-8");
      console.log("[update-agent-api-key] Env file written successfully");

      // Also write to .env.production since that's used when running the built agent
      const envProdPath = path.join(projectPath, ".env.production");
      console.log("[update-agent-api-key] Also writing to:", envProdPath);
      await fs.writeFile(envProdPath, envContent, "utf-8");
      console.log(
        "[update-agent-api-key] Production env file written successfully",
      );

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle("rebuild-project", async (event, projectId: string) => {
  try {
    console.log("[rebuild-project] Starting rebuild for project:", projectId);

    // Get project info BEFORE stopping (so we don't lose it)
    const projectInfo = blinkProcessManager.getProjectInfo(projectId);
    console.log("[rebuild-project] Project info:", projectInfo);

    if (!projectInfo) {
      console.error("[rebuild-project] Project not found!");
      return { success: false, error: "Project not found" };
    }

    // Stop the project
    console.log("[rebuild-project] Stopping project...");
    blinkProcessManager.stopProject(projectId);
    console.log("[rebuild-project] Project stopped");

    // Wait a moment for it to stop
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Restart with rebuild
    console.log(
      "[rebuild-project] Starting project:",
      projectId,
      "at path:",
      projectInfo.projectPath,
      "on port:",
      projectInfo.port,
    );
    await blinkProcessManager.startProject(
      projectId,
      projectInfo.projectPath,
      projectInfo.port,
    );
    console.log("[rebuild-project] Project started successfully");

    return { success: true };
  } catch (error: any) {
    console.error("[rebuild-project] Error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("is-project-running", async (event, projectId: string) => {
  return blinkProcessManager.isRunning(projectId);
});

ipcMain.handle("read-agent-file", async (event, projectPath: string) => {
  try {
    const agentPath = path.join(projectPath, "agent.ts");
    const content = await fs.readFile(agentPath, "utf-8");
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "write-agent-file",
  async (event, projectPath: string, content: string) => {
    try {
      const agentPath = path.join(projectPath, "agent.ts");
      await fs.writeFile(agentPath, content, "utf-8");
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  blinkProcessManager.stopAll();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  blinkProcessManager.stopAll();
});
