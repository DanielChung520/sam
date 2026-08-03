module.exports = {
  testDir: './admin/e2e',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:7012',
    headless: true,
    launchOptions: {
      executablePath: '/home/daniel/.cache/ms-playwright/chromium_headless_shell-1228/chrome-linux/headless_shell',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },
};
