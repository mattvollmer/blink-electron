# Quick Start Guide

## 1. Install Dependencies

```bash
cd blink-desktop
npm install
```

## 2. Make Sure You Have Blink Projects

Create a test project if you don't have one:

```bash
cd ~/Desktop  # or wherever you want
mkdir my-blink-agent
cd my-blink-agent
npx blink init
```

## 3. Run the App

```bash
cd blink-desktop
npm start
```

## 4. Add Your First Project

1. Click "Add Project" button
2. Navigate to your blink project directory (the one with `agent.ts`)
3. Select it

## 5. Start Chatting

1. Click the ▶️ Play button next to your project
2. Wait for it to show "● Running" (green dot)
3. Type a message and press Enter

## That's It!

You now have a beautiful GUI for your Blink agents.

## Tips

- You can run multiple projects at once
- Each project gets its own port (3000, 3001, 3002...)
- Use the sidebar to switch between projects
- Projects remember their state between app restarts

## What's Next?

- Edit your `agent.ts` file to customize your agent
- Add tools using the Vercel AI SDK syntax
- The app automatically hot-reloads when you save changes
