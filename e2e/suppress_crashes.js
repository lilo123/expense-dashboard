process.on('uncaughtException', (err) => {
  console.error('Suppressed Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Suppressed Unhandled Rejection:', err);
});
const origExit = process.exit;
process.exit = (code) => {
  console.error(`Suppressed process.exit(${code}) call to prevent Next.js server from terminating during E2E tests.`);
};
const origKill = process.kill;
process.kill = (pid, signal) => {
  if (signal === 0) {
    return origKill.call(process, pid, 0);
  }
  console.error(`Suppressed process.kill(${pid}, ${signal}) call to prevent Next.js server from terminating during E2E tests.`);
};
process.on('SIGTERM', () => {
  console.error('Suppressed SIGTERM signal to prevent Next.js server from terminating during E2E tests.');
});
process.on('SIGINT', () => {
  console.error('Suppressed SIGINT signal to prevent Next.js server from terminating during E2E tests.');
});
