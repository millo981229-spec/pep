import { createRequire } from 'node:module';
import path from 'node:path';

const dependencyRoot =
  process.env.BROWSER_TEST_DEPS ||
  '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules';
const require = createRequire(path.join(dependencyRoot, 'package.json'));
const { chromium } = require('playwright');
const baseUrl = process.env.WEB_BASE_URL || 'http://127.0.0.1:3000';
const username = `검증사용자${Date.now().toString().slice(-8)}`;
const password = '브라우저-검증용-안전한-비밀번호-2026';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`${baseUrl}/my`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '로그인하기', exact: true }).click();
  await page.getByRole('button', { name: '처음이신가요? 회원가입' }).click();
  await page.getByLabel('아이디').fill(username);
  await page.getByLabel('비밀번호').fill(password);
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await page.getByText(`@${username}`, { exact: true }).waitFor();

  const cookies = await context.cookies(baseUrl);
  const sessionCookie = cookies.find(
    (cookie) => cookie.name === 'gotgot-session',
  );
  if (!sessionCookie?.httpOnly || sessionCookie.sameSite !== 'Lax')
    throw new Error('세션 쿠키의 HttpOnly 또는 SameSite 설정이 없습니다.');

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText(`@${username}`, { exact: true }).waitFor();
  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.getByRole('button', { name: '로그인하기', exact: true }).waitFor();

  if (errors.length) throw new Error(`브라우저 오류: ${errors.join(' | ')}`);
  console.log(
    '✔ 화면 회원가입·자동 로그인·HttpOnly 세션·새로고침 유지·로그아웃',
  );
} finally {
  await browser.close();
}
