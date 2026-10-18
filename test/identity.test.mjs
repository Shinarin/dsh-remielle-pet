import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { apply, inject, name as pluginName } from "../lib/index.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TMP_ROOT = join(ROOT, "tmp");
const PLUGIN_ID = "dsh-remielle-pet";
const ROUTE_BASE = `/plugins/${PLUGIN_ID}`;
const LEGACY_ID = "dsh-pet";

mkdirSync(TMP_ROOT, { recursive: true });

function readText(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

/**
 * Minimal Cordis-like context: `ctx.effect(fn)` executes the registration and
 * keeps the returned disposer; `webServer.register` records the route.
 */
function createMockCtx() {
  const routes = [];
  const ctx = {
    effect(fn) {
      const dispose = fn();
      return typeof dispose === "function" ? dispose : () => {};
    },
    webServer: {
      register(route) {
        routes.push(route);
        return () => {};
      },
    },
  };
  return { ctx, routes };
}

async function withHome(fn) {
  const home = mkdtempSync(join(TMP_ROOT, "identity-"));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  try {
    return await fn(home);
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
}

function getJson(route) {
  let status;
  let body = "";
  const res = {
    writeHead(nextStatus) {
      status = nextStatus;
    },
    end(chunk) {
      body += chunk ?? "";
    },
  };
  route.handler({ method: "GET" }, res);
  return { status, body: JSON.parse(body) };
}

function postJson(route, payload) {
  return new Promise((resolve) => {
    const res = {
      writeHead() {},
      end(chunk) {
        resolve(JSON.parse(chunk ?? "{}"));
      },
    };
    const req = (async function* () {
      yield Buffer.from(JSON.stringify(payload));
    })();
    req.method = "POST";
    route.handler(req, res);
  });
}

function silenceLogs(fn) {
  const { log, warn } = console;
  console.log = () => {};
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
    console.warn = warn;
  }
}

test("package, patch and client share one unique identity", () => {
  const pkg = JSON.parse(readText("package.json"));
  assert.equal(pkg.name, PLUGIN_ID);

  const patch = readText("cordis.patch.yml");
  assert.match(patch, new RegExp(`- id: ${PLUGIN_ID}`));
  assert.match(patch, new RegExp(`name: '${PLUGIN_ID}'`));

  assert.equal(pluginName, PLUGIN_ID);
  assert.deepEqual(inject, ["webServer"]);

  const client = readText("client.js");
  assert.match(client, new RegExp(`id: "${PLUGIN_ID}"`));
  assert.match(client, new RegExp(`API_BASE = "${ROUTE_BASE}"`));
  assert.match(client, new RegExp(`id: "${PLUGIN_ID}",\\s*\\n\\s*order: 45`));
  assert.match(client, /exports\.name = "dsh-remielle-pet"/);
  assert.doesNotMatch(client, /id: "dsh-pet"/);
  assert.doesNotMatch(client, /API_BASE = "\/pet"/);
});

test("legacy localStorage keys are preserved for user data compatibility", () => {
  const client = readText("client.js");
  for (const key of ["dsh-pet:position", "dsh-pet:config", "dsh-pet:visible", "dsh-pet:gif:"]) {
    assert.ok(client.includes(key), `missing legacy key ${key}`);
  }
});

test("host registers only the private route namespace", async () => {
  await withHome(() => {
    const { ctx, routes } = createMockCtx();
    silenceLogs(() => apply(ctx, { enabled: true }));

    const paths = routes.map((route) => route.path).sort();
    assert.deepEqual(paths, [
      `${ROUTE_BASE}/config`,
      `${ROUTE_BASE}/default-gif/answering`,
      `${ROUTE_BASE}/default-gif/approval`,
      `${ROUTE_BASE}/default-gif/idle`,
      `${ROUTE_BASE}/default-gif/thinking`,
      `${ROUTE_BASE}/state`,
    ]);
    assert.equal(routes.every((route) => route.kind === "exact"), true);
    assert.equal(routes.some((route) => route.path.startsWith("/pet/")), false);
  });
});

test("fresh install serves defaults", async () => {
  await withHome(() => {
    const { ctx, routes } = createMockCtx();
    silenceLogs(() => apply(ctx, { enabled: true }));
    const route = routes.find((item) => item.path === `${ROUTE_BASE}/config`);
    const { status, body } = getJson(route);
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.config.scale, 1.0);
  });
});

test("legacy dsh-pet config is migrated to the new path once", async () => {
  await withHome((home) => {
    const legacyDir = join(home, "plugins", LEGACY_ID);
    const newPath = join(home, "plugins", PLUGIN_ID, "config.json");
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(
      join(legacyDir, "config.json"),
      JSON.stringify({ scale: 1.5, alertSound: true }),
      "utf8",
    );

    const { ctx, routes } = createMockCtx();
    silenceLogs(() => apply(ctx, { enabled: true }));

    const route = routes.find((item) => item.path === `${ROUTE_BASE}/config`);
    const { body } = getJson(route);
    assert.equal(body.config.scale, 1.5);
    assert.equal(body.config.alertSound, true);

    const migrated = JSON.parse(readFileSync(newPath, "utf8"));
    assert.equal(migrated.scale, 1.5);
    assert.equal(migrated.alertSound, true);
    assert.ok(readFileSync(join(legacyDir, "config.json"), "utf8").length > 0, "legacy file kept");
  });
});

test("POST config persists to the new path", async () => {
  await withHome(async (home) => {
    const { ctx, routes } = createMockCtx();
    silenceLogs(() => apply(ctx, { enabled: true }));
    const route = routes.find((item) => item.path === `${ROUTE_BASE}/config`);

    await postJson(route, { config: { scale: 2, alertDone: false } });

    const saved = JSON.parse(
      readFileSync(join(home, "plugins", PLUGIN_ID, "config.json"), "utf8"),
    );
    assert.equal(saved.scale, 2);
    assert.equal(saved.alertDone, false);
  });
});
