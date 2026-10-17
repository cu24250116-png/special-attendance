import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\x1b[36m%s\x1b[0m', '=====================================================');
console.log('\x1b[36m%s\x1b[0m', ' College Special Assignment & Attendance Dashboard  ');
console.log('\x1b[36m%s\x1b[0m', ' Starting Backend Server & Vite Frontend...          ');
console.log('\x1b[36m%s\x1b[0m', '=====================================================\n');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

// Spawn Backend Server
const serverProc = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'server'),
  stdio: 'inherit',
  shell: true,
});

// Spawn Client Vite App
const clientProc = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'client'),
  stdio: 'inherit',
  shell: true,
});

const cleanup = () => {
  console.log('\n\x1b[33mStopping all processes...\x1b[0m');
  try {
    serverProc.kill('SIGINT');
  } catch (e) {}
  try {
    clientProc.kill('SIGINT');
  } catch (e) {}
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
