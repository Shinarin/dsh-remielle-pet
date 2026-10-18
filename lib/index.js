/**
 * dsh-remielle-pet 插件服务端入口
 * 功能：
 *   1. 提供默认 GIF 静态文件服务
 *   2. 保存/读取用户配置（GIF、大小、提醒等）
 *
 * 身份约定（见 spec/plugin-identity.md）：
 *   - 包名 / Cordis entry id / client loader id / HTTP 前缀统一为 dsh-remielle-pet。
 *   - 旧版本使用 dsh-pet 与 /pet/*；旧配置路径仅只读一次用于迁移，旧文件保留。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const name = "dsh-remielle-pet";
export const inject = ["webServer"];

/** 本插件的全局唯一标识：包名、bundle entry id、HTTP 前缀共用。 */
const PLUGIN_ID = "dsh-remielle-pet";
/** 旧版本标识：只用于读取历史配置，不再注册任何路由。 */
const LEGACY_PLUGIN_ID = "dsh-pet";
/** 本插件独占的 HTTP 命名空间，避免与其它桌宠插件的通用 /pet/* 冲突。 */
const ROUTE_BASE = `/plugins/${PLUGIN_ID}`;

const DEFAULT_CONFIG = {
  enabled: true,
  scale: 1.0,
  hideMode: "off",
  alertApproval: true,
  alertSound: false,
  alertDone: true,
  alertDoneSound: true,
  dblclickAction: "pat",
};

function getConfigPath(dshHome) {
  return join(dshHome, "plugins", PLUGIN_ID, "config.json");
}

function getLegacyConfigPath(dshHome) {
  return join(dshHome, "plugins", LEGACY_PLUGIN_ID, "config.json");
}

/** 读取一个配置文件；不存在或损坏时返回 null，不抛错。 */
function readConfig(path) {
  try {
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return null;
  }
}

function saveConfig(dshHome, config) {
  try {
    const path = getConfigPath(dshHome);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch (e) {
    console.warn(`[${PLUGIN_ID}] 保存配置失败:`, e);
    return false;
  }
}

/**
 * 读取用户配置：
 *   1. 优先新路径；
 *   2. 新路径不存在时读取旧 dsh-pet 路径并一次性迁移到新路径；
 *   3. 都没有则返回默认值。
 * 迁移失败不阻塞启动，旧文件不删除（便于回滚）。
 */
function loadConfig(dshHome) {
  const current = readConfig(getConfigPath(dshHome));
  if (current) return current;

  const legacy = readConfig(getLegacyConfigPath(dshHome));
  if (legacy) {
    const migrated = saveConfig(dshHome, legacy);
    console.log(
      `[${PLUGIN_ID}] 已迁移旧配置: ${getLegacyConfigPath(dshHome)} -> ${getConfigPath(dshHome)}` +
        (migrated ? "" : "（写入新路径失败，本次仅使用内存配置）"),
    );
    return legacy;
  }

  return { ...DEFAULT_CONFIG };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > 256 * 1024) throw new Error("request body too large");
    chunks.push(buf);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const __dirname = dirname(fileURLToPath(import.meta.url));

function serveGif(req, res, state) {
  if (req.method !== "GET") {
    res.writeHead(405, { allow: "GET" });
    res.end();
    return;
  }
  try {
    const gifPath = join(__dirname, "..", "default-gifs", `${state}.gif`);
    const data = readFileSync(gifPath);
    res.writeHead(200, {
      "content-type": "image/gif",
      "cache-control": "public, max-age=86400",
    });
    res.end(data);
  } catch (err) {
    console.error(`[${PLUGIN_ID}] serveGif ${state} failed:`, err.message);
    res.writeHead(404);
    res.end("not found");
  }
}

export function apply(ctx, config) {
  console.log(`[${PLUGIN_ID}] 插件加载中...`);
  const cfg = { ...DEFAULT_CONFIG, ...(config || {}) };
  if (!cfg.enabled) {
    console.log(`[${PLUGIN_ID}] 插件已禁用`);
    return;
  }

  const dshHome =
    process.env.DSH_HOME || join(process.env.HOME || process.env.USERPROFILE || ".", ".dsh");
  const userConfig = loadConfig(dshHome);
  console.log(`[${PLUGIN_ID}] 配置已加载:`, userConfig);

  console.log(`[${PLUGIN_ID}] 注册 HTTP 路由: ${ROUTE_BASE}/*`);

  ctx.effect(
    () =>
      ctx.webServer.register(
        {
          kind: "exact",
          path: `${ROUTE_BASE}/state`,
          handler: (req, res) => {
            if (req.method !== "GET") {
              res.writeHead(405);
              res.end();
              return;
            }
            sendJson(res, 200, { ok: true, state: "idle" });
          },
        },
        "pet: state",
      ),
    "pet route: state",
  );

  ctx.effect(
    () =>
      ctx.webServer.register(
        {
          kind: "exact",
          path: `${ROUTE_BASE}/config`,
          handler: (req, res) => {
            if (req.method === "GET") {
              sendJson(res, 200, { ok: true, config: userConfig });
            } else if (req.method === "POST") {
              readJsonBody(req)
                .then((body) => {
                  if (body.config && typeof body.config === "object") {
                    Object.assign(userConfig, body.config);
                    saveConfig(dshHome, userConfig);
                  }
                  sendJson(res, 200, { ok: true, config: userConfig });
                })
                .catch((e) => sendJson(res, 500, { ok: false, error: String(e) }));
            } else {
              res.writeHead(405);
              res.end();
            }
          },
        },
        "pet: config",
      ),
    "pet route: config",
  );

  ctx.effect(
    () =>
      ctx.webServer.register(
        {
          kind: "exact",
          path: `${ROUTE_BASE}/default-gif/idle`,
          handler: (req, res) => serveGif(req, res, "idle"),
        },
        "pet: gif idle",
      ),
    "pet route: gif-idle",
  );

  ctx.effect(
    () =>
      ctx.webServer.register(
        {
          kind: "exact",
          path: `${ROUTE_BASE}/default-gif/thinking`,
          handler: (req, res) => serveGif(req, res, "thinking"),
        },
        "pet: gif thinking",
      ),
    "pet route: gif-thinking",
  );

  ctx.effect(
    () =>
      ctx.webServer.register(
        {
          kind: "exact",
          path: `${ROUTE_BASE}/default-gif/answering`,
          handler: (req, res) => serveGif(req, res, "answering"),
        },
        "pet: gif answering",
      ),
    "pet route: gif-answering",
  );

  ctx.effect(
    () =>
      ctx.webServer.register(
        {
          kind: "exact",
          path: `${ROUTE_BASE}/default-gif/approval`,
          handler: (req, res) => serveGif(req, res, "approval"),
        },
        "pet: gif approval",
      ),
    "pet route: gif-approval",
  );

  console.log(`[${PLUGIN_ID}] HTTP 路由注册完成`);
}
