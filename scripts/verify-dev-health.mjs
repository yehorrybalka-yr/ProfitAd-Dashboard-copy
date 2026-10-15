#!/usr/bin/env node
/**
 * Проверяет, что dev-сервер отдаёт CSS и JS без 404.
 * Запуск: node scripts/verify-dev-health.mjs [url]
 */
const baseUrl = process.argv[2] ?? "http://localhost:3000";

async function check(path) {
  const res = await fetch(`${baseUrl}${path}`, { redirect: "follow" });
  return { path, status: res.status, ok: res.ok };
}

async function main() {
  const homeRes = await fetch(baseUrl);
  if (!homeRes.ok) {
    console.error(`FAIL: ${baseUrl} → HTTP ${homeRes.status}`);
    console.error("Запустите: npm run dev");
    process.exit(1);
  }

  const html = await homeRes.text();
  const cssMatch = html.match(/href="(\/_next\/static\/css\/[^"]+)"/);
  const jsMatch = html.match(/src="(\/_next\/static\/chunks\/main-app\.js[^"]*)"/);

  if (!cssMatch) {
    console.error("FAIL: в HTML нет ссылки на layout.css");
    process.exit(1);
  }

  const css = await check(cssMatch[1]);
  const js = jsMatch ? await check(jsMatch[1]) : { ok: false, status: 0, path: "main-app.js" };

  if (!css.ok) {
    console.error(`FAIL: CSS ${css.path} → HTTP ${css.status}`);
    console.error("Исправление: pkill -f 'next dev'; rm -rf .next; npm run dev");
    process.exit(1);
  }

  if (!js.ok) {
    console.error(`FAIL: JS ${js.path} → HTTP ${js.status}`);
    console.error("Исправление: pkill -f 'next dev'; rm -rf .next; npm run dev");
    process.exit(1);
  }

  const cssBody = await (await fetch(`${baseUrl}${cssMatch[1]}`)).text();
  if (!cssBody.includes("--bg") && !cssBody.includes("tailwind")) {
    console.error("FAIL: CSS загружен, но не содержит ожидаемых стилей");
    process.exit(1);
  }

  console.log(`OK: ${baseUrl} — CSS ${css.status}, JS ${js.status}`);
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  console.error("Убедитесь, что dev-сервер запущен: npm run dev");
  process.exit(1);
});
