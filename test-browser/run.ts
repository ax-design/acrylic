// Builds and runs the acrylic browser test. Usage: bun test-browser/run.ts [chromium|firefox|webkit|safari ...]
// Chromium and Safari also get a pixel check: blurred inside the shape, sharp outside a corner.
// (Playwright screenshots of Firefox and WebKit do not include backdrop-filter.)
import { join } from 'node:path';
import { PNG } from 'pngjs';

const dir = import.meta.dir;
const dist = join(dir, 'dist');
if (!process.env.SKIP_BUILD) {
    const result = await Bun.build({ entrypoints: [join(dir, 'page.html')], outdir: dist, conditions: ['source'] });
    if (!result.success) throw new Error(result.logs.join('\n'));
}
const server = Bun.serve({
    port: 0,
    fetch(req) {
        const path = new URL(req.url).pathname;
        const file = Bun.file(join(dist, path === '/' ? 'page.html' : path));
        return file.size ? new Response(file) : new Response('', { status: 404 });
    },
});

interface Driver {
    result(): Promise<any>;
    shot(): Promise<Buffer>;
    // Playwright only: the page under forced colors (Windows High Contrast), checked live.
    forcedColors?(): Promise<{ name: string; ok: boolean; detail: string }[]>;
    // Playwright only: reduced motion on, then the fallback switch must land at once.
    reducedMotion?(): Promise<{ name: string; ok: boolean; detail: string }[]>;
    close(): Promise<void>;
}

async function playwright(name: string, url: string): Promise<Driver> {
    const pw = (await import('playwright')) as any;
    // AX_BROWSER_PATH points the run at a system build instead.
    const executablePath = process.env.AX_BROWSER_PATH;
    const browser = await pw[name].launch(executablePath ? { executablePath } : {});
    const page = await browser.newPage({ viewport: { width: 600, height: 400 } });
    await page.goto(url);
    return {
        async result() {
            await page.waitForFunction(() => (window as any).__result, null, { timeout: 60000 });
            return page.evaluate(() => (window as any).__result);
        },
        shot: () => page.screenshot(),
        async reducedMotion() {
            await page.emulateMedia({ reducedMotion: 'reduce' });
            return page.evaluate(() => (window as any).__instantSwitch());
        },
        async forcedColors() {
            await page.emulateMedia({ forcedColors: 'active' });
            return page.evaluate(() => {
                const out: { name: string; ok: boolean; detail: string }[] = [];
                for (const id of ['a', 's']) {
                    const root = document.getElementById(id)?.shadowRoot;
                    const tint = root?.querySelector('.acrylic-tint') as HTMLElement | null;
                    const filter = root?.querySelector('.acrylic-filter') as HTMLElement | null;
                    const noise = root?.querySelector('.acrylic-noise') as HTMLElement | null;
                    if (!tint || !filter || !noise) {
                        out.push({ name: `${id} forced colors: layer elements exist`, ok: false, detail: 'missing' });
                        continue;
                    }
                    const opacity = getComputedStyle(tint).opacity;
                    out.push({ name: `${id} forced colors: tint is opaque`, ok: opacity === '1', detail: opacity });
                    const filterDisplay = getComputedStyle(filter).display;
                    out.push({ name: `${id} forced colors: blur element is hidden`, ok: filterDisplay === 'none', detail: filterDisplay });
                }
                return out;
            });
        },
        close: () => browser.close(),
    };
}

async function safari(url: string): Promise<Driver> {
    const port = 4464;
    const proc = Bun.spawn(['safaridriver', '-p', String(port)]);
    await Bun.sleep(1000);
    const call = async (method: string, path: string, body?: unknown) => {
        const res = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        const json = (await res.json()) as { value: any };
        if (json.value && json.value.error) throw new Error(json.value.message);
        return json.value;
    };
    const sid = (await call('POST', '/session', { capabilities: {} })).sessionId;
    await call('POST', `/session/${sid}/window/rect`, { width: 700, height: 600 });
    await call('POST', `/session/${sid}/url`, { url });
    return {
        async result() {
            for (;;) {
                const r = await call('POST', `/session/${sid}/execute/sync`, { script: 'return window.__result || null', args: [] });
                if (r) return r;
                await Bun.sleep(200);
            }
        },
        async shot() {
            await Bun.sleep(300);
            return Buffer.from(await call('GET', `/session/${sid}/screenshot`), 'base64');
        },
        async close() {
            await call('DELETE', `/session/${sid}`);
            proc.kill();
        },
    };
}

// Blurred: neither of the two checker colors. Sharp: one of them.
function pixelChecks(png: PNG, dpr: number, rects: Record<string, { left: number; top: number; width: number; height: number }>) {
    const at = (x: number, y: number) => {
        const i = (Math.round(y * dpr) * png.width + Math.round(x * dpr)) * 4;
        return [png.data[i], png.data[i + 1], png.data[i + 2]];
    };
    const sharp = (c: number[]) => (c[0] > 230 && c[1] > 230 && c[2] > 230) || (c[0] > 220 && c[1] < 70 && c[2] < 70);
    const out: { name: string; ok: boolean; detail: string }[] = [];
    for (const id of Object.keys(rects)) {
        const r = rects[id];
        const center = at(r.left + r.width / 2, r.top + r.height / 2);
        const corner = at(r.left + 2, r.top + 2);
        out.push({ name: `${id}: blurred inside the shape`, ok: !sharp(center), detail: center.join(',') });
        out.push({ name: `${id}: sharp outside the cut corner`, ok: sharp(corner), detail: corner.join(',') });
    }
    return out;
}

let failed = 0;
for (const name of process.argv.slice(2).length ? process.argv.slice(2) : ['chromium']) {
    for (const fallback of [false, true]) {
        const url = `http://127.0.0.1:${server.port}/${fallback ? '?fallback=1' : ''}`;
        const d = name === 'safari' ? await safari(url) : await playwright(name, url);
        let result: any;
        try {
            result = await d.result();
            if (!result.error && !fallback && (name === 'chromium' || name === 'safari')) {
                result.checks.push(...pixelChecks(PNG.sync.read(await d.shot()), result.dpr, result.rects));
            }
            // Reduced motion before forced colors: the switch of the fallback is checked at once.
            if (!result.error && !fallback && d.reducedMotion) result.checks.push(...(await d.reducedMotion()));
            // After the screenshot: forced colors would change the pixels the blur check reads.
            if (!result.error && d.forcedColors) result.checks.push(...(await d.forcedColors()));
        } finally {
            await d.close();
        }
        const label = `${name}${fallback ? ' fallback' : ''}`;
        if (result.error) {
            console.log(`${label}: ERROR ${result.error}`);
            failed++;
            continue;
        }
        const bad = result.checks.filter((c: any) => !c.ok);
        failed += bad.length;
        console.log(`${label}: ${result.checks.length - bad.length}/${result.checks.length} passed`);
        for (const c of bad) console.log(`  FAIL ${c.name}: ${c.detail}`);
    }
}
server.stop();
process.exit(failed ? 1 : 0);
