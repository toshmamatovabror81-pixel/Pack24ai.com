/* Headless smoke test for Driver web preview */
const { execSync } = require('child_process');

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.argv[2] || 'http://localhost:8082';

const tmp = require('os').tmpdir();
const profileDir = require('path').join(tmp, 'pack24-smoke-' + Date.now());

const cmd = [
    `"${CHROME}"`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--virtual-time-budget=12000',
    `--user-data-dir="${profileDir}"`,
    '--dump-dom',
    `"${URL}"`,
].join(' ');

try {
    const out = execSync(cmd, { timeout: 30000, maxBuffer: 20 * 1024 * 1024 }).toString();
    const len = out.length;
    const bodyMatch = out.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyLen = bodyMatch ? bodyMatch[1].length : 0;
    const hasReact = /id="root"/.test(out) || /__expo_router/.test(out) || /Pack24/.test(out);
    const hasError = /SyntaxError|TypeError|Cannot use|undefined is not/i.test(out);
    console.log(JSON.stringify({
        ok: true,
        totalLen: len,
        bodyLen,
        hasReact,
        hasError,
        snippet: bodyLen > 0 ? bodyMatch[1].slice(0, 400).replace(/\s+/g, ' ').trim() : '(empty body)',
    }, null, 2));
} catch (e) {
    console.log(JSON.stringify({ ok: false, error: String(e.message || e).slice(0, 400) }));
}
