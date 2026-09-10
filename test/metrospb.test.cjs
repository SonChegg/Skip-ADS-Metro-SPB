const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');

test('clicks only supported actions and preserves accelerated timer arguments', async () => {
    const userscript = await readFile(
        new URL('../metrospb.js', `file://${__filename}`),
        'utf8'
    );

    const html = `<!doctype html>
        <html>
            <body>
                <button onclick="testState.skip++">Пропустить рекламу</button>
                <div onclick="testState.trip++"><span>Обычная поездка</span></div>
                <button onclick="testState.wrong++">Пропустить подписку</button>
                <button onclick="testState.paid++">Turn-off advertising for 1 rub</button>
                <button onclick="testState.connect++">Connect</button>
                <button disabled onclick="testState.disabledNext++">Next</button>
                <button onclick="testState.regularTrip++">Regular trip</button>
                <script>${userscript}</script>
                <script>
                    const startedAt = performance.now();
                    setTimeout((first, second) => {
                        testState.timer = {
                            args: [first, second],
                            elapsed: performance.now() - startedAt
                        };
                    }, 1000, 'A', 'B');

                    setTimeout(() => {
                        const next = document.createElement('button');
                        next.textContent = 'Далее';
                        next.onclick = () => testState.next++;
                        document.body.append(next);
                    }, 200);
                </script>
            </body>
        </html>`;

    const dom = new JSDOM(html, {
        beforeParse(window) {
            window.testState = {
                skip: 0,
                trip: 0,
                wrong: 0,
                paid: 0,
                connect: 0,
                disabledNext: 0,
                regularTrip: 0,
                next: 0,
                timer: null
            };

            window.HTMLElement.prototype.getBoundingClientRect = () => ({
                width: 100,
                height: 30,
                top: 0,
                right: 100,
                bottom: 30,
                left: 0
            });

            window.getComputedStyle = () => ({
                display: 'block',
                visibility: 'visible',
                opacity: '1'
            });
        },
        pretendToBeVisual: true,
        runScripts: 'dangerously',
        url: 'https://login.wi-fi.ru/'
    });

    try {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        assert.equal(dom.window.testState.skip, 1);
        assert.equal(dom.window.testState.trip, 1);
        assert.equal(dom.window.testState.wrong, 0);
        assert.equal(dom.window.testState.paid, 0);
        assert.equal(dom.window.testState.connect, 1);
        assert.equal(dom.window.testState.disabledNext, 0);
        assert.equal(dom.window.testState.regularTrip, 1);
        assert.equal(dom.window.testState.next, 1);
        assert.deepEqual(Array.from(dom.window.testState.timer.args), ['A', 'B']);
        assert.ok(dom.window.testState.timer.elapsed >= 80);
        assert.ok(dom.window.testState.timer.elapsed < 300);
    } finally {
        dom.window.close();
    }
});
