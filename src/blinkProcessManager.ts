import { spawn, ChildProcess, exec as execCb } from "child_process";
import { BrowserWindow } from "electron";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import http from "node:http";

const execPromise = promisify(execCb);

interface BlinkProcess {
  process: ChildProcess;
  port: number;
  projectPath: string;
}

class BlinkProcessManager {
  private processes: Map<string, BlinkProcess> = new Map();
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private async killProcessOnPort(port: number): Promise<void> {
    try {
      if (process.platform === "win32") {
        // Windows
        const { stdout } = await execPromise(`netstat -ano | findstr :${port}`);
        const lines = stdout
          .split("\n")
          .filter((line: string) => line.includes("LISTENING"));

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== "0") {
            await execPromise(`taskkill /F /PID ${pid}`);
            console.log(`Killed process ${pid} on port ${port}`);
          }
        }
      } else {
        // macOS/Linux
        try {
          const { stdout } = await execPromise(`lsof -ti:${port}`);
          const pids = stdout
            .trim()
            .split("\n")
            .filter((pid: string) => pid);

          for (const pid of pids) {
            await execPromise(`kill -9 ${pid}`);
            console.log(`Killed process ${pid} on port ${port}`);
          }
        } catch (error) {
          // No process found on port, that's fine
        }
      }
    } catch (error) {
      console.log(`No process to kill on port ${port}`);
    }
  }

  async startProject(
    projectId: string,
    projectPath: string,
    port: number,
  ): Promise<void> {
    if (this.processes.has(projectId)) {
      throw new Error(`Project ${projectId} is already running`);
    }

    // Kill any existing process on this port
    await this.killProcessOnPort(port);

    return new Promise((resolve, reject) => {
      // First, build the project
      const buildProcess = spawn("blink", ["build"], {
        cwd: projectPath,
        shell: true,
      });

      buildProcess.on("close", (code) => {
        if (code !== 0) {
          reject(new Error("Failed to build project"));
          return;
        }

        // Run the built agent with custom port via environment variable
        // Read .env.production to get API keys
        const envProdPath = path.join(projectPath, ".env.production");
        const envVars: Record<string, string> = {};

        try {
          const envContent = fs.readFileSync(envProdPath, "utf-8");
          // Simple .env parser
          envContent.split("\n").forEach((line) => {
            line = line.trim();
            if (line && !line.startsWith("#")) {
              const [key, ...valueParts] = line.split("=");
              if (key) {
                envVars[key.trim()] = valueParts.join("=").trim();
              }
            }
          });
          console.log(`[${projectId}] Loaded env vars:`, Object.keys(envVars));
        } catch (error) {
          console.log(`[${projectId}] No .env.production file found`);
        }

        const blinkProcess = spawn("node", [".blink/build/agent.js"], {
          cwd: projectPath,
          env: { ...process.env, ...envVars, PORT: port.toString() },
          shell: true,
        });

        let startupError = "";

        blinkProcess.stdout?.on("data", (data) => {
          console.log(`[${projectId}] stdout:`, data.toString());
          // Send logs to renderer
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send("blink:log", {
              projectId,
              level: "info",
              message: data.toString(),
            });
          }
        });

        blinkProcess.stderr?.on("data", (data) => {
          const message = data.toString();
          console.error(`[${projectId}] stderr:`, message);
          startupError += message;

          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send("blink:log", {
              projectId,
              level: "error",
              message,
            });
          }
        });

        blinkProcess.on("error", (error) => {
          console.error(`[${projectId}] Failed to start:`, error);
          this.processes.delete(projectId);
          reject(error);
        });

        blinkProcess.on("exit", (code) => {
          console.log(`[${projectId}] Process exited with code ${code}`);
          this.processes.delete(projectId);

          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send("blink:process-exit", {
              projectId,
              code,
            });
          }
        });

        // Store the process
        this.processes.set(projectId, {
          process: blinkProcess,
          port,
          projectPath,
        });

        // Wait for the agent to actually be listening on the port
        const checkPort = async (retries = 30): Promise<void> => {
          for (let i = 0; i < retries; i++) {
            try {
              await new Promise<void>((resolveCheck, rejectCheck) => {
                const req = http.get(`http://127.0.0.1:${port}/`, () => {
                  resolveCheck();
                });
                req.on("error", () => {
                  rejectCheck();
                });
                req.setTimeout(500);
              });
              // Port is responding
              console.log(`[${projectId}] Agent is ready on port ${port}`);
              return;
            } catch {
              // Port not ready yet, wait and retry
              await new Promise((r) => setTimeout(r, 200));
            }
          }
          throw new Error(
            `Agent failed to start on port ${port} after ${retries} retries`,
          );
        };

        checkPort()
          .then(() => {
            if (this.processes.has(projectId)) {
              resolve();
            } else {
              reject(new Error(`Failed to start project: ${startupError}`));
            }
          })
          .catch((err) => {
            this.processes.delete(projectId);
            reject(err);
          });
      });
    });
  }

  stopProject(projectId: string): void {
    const process = this.processes.get(projectId);
    if (process) {
      process.process.kill();
      this.processes.delete(projectId);
    }
  }

  stopAll(): void {
    for (const [projectId] of this.processes) {
      this.stopProject(projectId);
    }
  }

  isRunning(projectId: string): boolean {
    return this.processes.has(projectId);
  }

  getPort(projectId: string): number | undefined {
    return this.processes.get(projectId)?.port;
  }

  getProjectInfo(
    projectId: string,
  ): { projectPath: string; port: number } | null {
    const process = this.processes.get(projectId);
    if (!process) {
      return null;
    }
    return {
      projectPath: process.projectPath,
      port: process.port,
    };
  }
}

export const blinkProcessManager = new BlinkProcessManager();
