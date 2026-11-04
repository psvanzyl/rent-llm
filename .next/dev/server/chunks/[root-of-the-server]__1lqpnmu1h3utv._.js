module.exports = [
(()=>{"use strict";return[
"[project]/src/app/api/v1/chat/completions/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$apikeys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/apikeys.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$usage$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/usage.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$http$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/http.ts [app-route] (ecmascript)");
;
;
;
;
const dynamic = "force-dynamic";
const BACKEND = process.env.LLM_BACKEND_URL || "http://192.168.178.16:8086/v1";
const BACKEND_KEY = process.env.LLM_BACKEND_KEY || "local-no-auth";
const handler_POST = async (req)=>{
    const auth = req.headers.get("authorization") || "";
    const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : req.headers.get("x-api-key") || "";
    const rec = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$apikeys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateApiKey"])(raw);
    if (!rec) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: "invalid_api_key"
    }, {
        status: 401
    });
    let body;
    try {
        body = await req.json();
    } catch  {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "bad_json"
        }, {
            status: 400
        });
    }
    const stream = body?.stream === true;
    let upstream;
    try {
        upstream = await fetch(`${BACKEND}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${BACKEND_KEY}`
            },
            body: JSON.stringify(body)
        });
    } catch (e) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "backend_unavailable"
        }, {
            status: 502
        });
    }
    if (!upstream.ok || !upstream.body) {
        const text = await upstream.text().catch(()=>"");
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"](text, {
            status: upstream.status,
            headers: {
                "Content-Type": "application/json"
            }
        });
    }
    if (!stream) {
        const data = await upstream.json();
        const pt = data?.usage?.prompt_tokens ?? 0;
        const ct = data?.usage?.completion_tokens ?? 0;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$usage$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["recordUsage"])(rec.id, pt, ct).catch(()=>{});
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(data);
    }
    // Streaming: tee the stream to track usage from the final chunk, pass through to client.
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let promptTokens = 0;
    let completionTokens = 0;
    const readable = new ReadableStream({
        async pull (controller) {
            const { done, value } = await reader.read();
            if (done) {
                controller.close();
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$usage$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["recordUsage"])(rec.id, promptTokens, completionTokens).catch(()=>{});
                return;
            }
            controller.enqueue(value);
            // parse SSE for usage
            buf += decoder.decode(value, {
                stream: true
            });
            const lines = buf.split("\n");
            buf = lines.pop() || "";
            for (const line of lines){
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;
                const payload = trimmed.slice(5).trim();
                if (payload === "[DONE]") continue;
                try {
                    const obj = JSON.parse(payload);
                    if (obj?.usage) {
                        promptTokens = obj.usage.prompt_tokens ?? promptTokens;
                        completionTokens = obj.usage.completion_tokens ?? completionTokens;
                    }
                } catch  {
                // ignore parse errors
                }
            }
        },
        cancel () {
            reader.cancel();
        }
    });
    return new Response(readable, {
        status: 200,
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive"
        }
    });
};
const POST = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$http$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["jsonRoute"])("v1-chat", {
    POST: handler_POST
});
}),
"[project]/src/lib/apikeys.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createApiKey",
    ()=>createApiKey,
    "findApiKeyByHash",
    ()=>findApiKeyByHash,
    "generateRawKey",
    ()=>generateRawKey,
    "hashKey",
    ()=>hashKey,
    "listApiKeys",
    ()=>listApiKeys,
    "revokeApiKey",
    ()=>revokeApiKey,
    "validateApiKey",
    ()=>validateApiKey
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
;
;
function dataDir() {
    return process.env.RENT_DATA_DIR || "/app/data/accounts";
}
async function ensureDir() {
    const dir = dataDir();
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].mkdir(dir, {
        recursive: true,
        mode: 0o775
    }).catch(()=>{});
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].chmod(dir, 0o775).catch(()=>{});
}
function keysPath() {
    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(dataDir(), "apikeys.json");
}
async function readStore() {
    await ensureDir();
    let raw;
    try {
        raw = await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].readFile(keysPath(), "utf8");
    } catch (e) {
        if (e?.code === "ENOENT") return {
            keys: {}
        };
        throw e;
    }
    try {
        const parsed = JSON.parse(raw);
        return {
            keys: parsed.keys || {}
        };
    } catch (e) {
        throw new Error(`api key store corrupt: ${e instanceof Error ? e.message : "unknown"}`);
    }
}
async function writeStore(store) {
    await ensureDir();
    const tmp = `${keysPath()}.${process.pid}.tmp`;
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].writeFile(tmp, JSON.stringify(store), "utf8");
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].rename(tmp, keysPath());
}
function hashKey(raw) {
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHash"])("sha256").update(raw).digest("hex");
}
function generateRawKey() {
    return `rl_${(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomBytes"])(24).toString("base64url")}`;
}
async function createApiKey(userId, name) {
    const rawKey = generateRawKey();
    const record = {
        id: (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomBytes"])(8).toString("hex"),
        userId,
        keyHash: hashKey(rawKey),
        prefix: rawKey.slice(0, 10),
        name: name || "default",
        createdAt: new Date().toISOString()
    };
    const store = await readStore();
    store.keys[record.id] = record;
    await writeStore(store);
    return {
        record,
        rawKey
    };
}
async function listApiKeys(userId) {
    const store = await readStore();
    return Object.values(store.keys).filter((k)=>k.userId === userId);
}
async function findApiKeyByHash(keyHash) {
    const store = await readStore();
    return Object.values(store.keys).find((k)=>k.keyHash === keyHash && !k.revokedAt);
}
async function validateApiKey(rawKey) {
    if (!rawKey) return undefined;
    const rec = await findApiKeyByHash(hashKey(rawKey));
    if (!rec) return undefined;
    // update lastUsedAt
    const store = await readStore();
    if (store.keys[rec.id]) {
        store.keys[rec.id].lastUsedAt = new Date().toISOString();
        await writeStore(store);
    }
    return rec;
}
async function revokeApiKey(userId, keyId) {
    const store = await readStore();
    const rec = store.keys[keyId];
    if (!rec || rec.userId !== userId) return false;
    rec.revokedAt = new Date().toISOString();
    await writeStore(store);
    return true;
}
}),
"[project]/src/lib/http.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "jsonError",
    ()=>jsonError,
    "jsonRoute",
    ()=>jsonRoute
]);
/**
 * JSON-safe route helpers.
 *
 * An unhandled error inside an App Router route handler produces a 500 with an
 * EMPTY body. The browser then fails with
 *   "Failed to execute 'json' on 'Response': Unexpected end of JSON input"
 * which tells the user nothing and hides the real cause from us. Every API route
 * is wrapped in `jsonRoute`, so a crash always returns parseable JSON with a
 * readable message -- and the real error is logged server-side.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
;
function jsonError(e, where, status = 500, message = "Something went wrong on our side. Please try again in a moment.") {
    console.error(`[carddex:${where}] unhandled error:`, e);
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: "server_error",
        message
    }, {
        status
    });
}
function jsonRoute(where, handlers) {
    return async (req)=>{
        const method = req.method.toUpperCase();
        const handler = handlers[method];
        if (!handler) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "method_not_allowed"
            }, {
                status: 405
            });
        }
        try {
            return await handler(req);
        } catch (e) {
            return jsonError(e, `${where}:${method}`);
        }
    };
}
}),
"[project]/src/lib/usage.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getUsage",
    ()=>getUsage,
    "getUsageForKeys",
    ()=>getUsageForKeys,
    "recordUsage",
    ()=>recordUsage
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
;
;
function dataDir() {
    return process.env.RENT_DATA_DIR || "/app/data/accounts";
}
async function ensureDir() {
    const dir = dataDir();
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].mkdir(dir, {
        recursive: true,
        mode: 0o775
    }).catch(()=>{});
}
function usagePath() {
    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(dataDir(), "usage.json");
}
async function readStore() {
    await ensureDir();
    let raw;
    try {
        raw = await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].readFile(usagePath(), "utf8");
    } catch (e) {
        if (e?.code === "ENOENT") return {
            usage: {}
        };
        throw e;
    }
    try {
        const parsed = JSON.parse(raw);
        return {
            usage: parsed.usage || {}
        };
    } catch (e) {
        throw new Error(`usage store corrupt: ${e instanceof Error ? e.message : "unknown"}`);
    }
}
async function writeStore(store) {
    await ensureDir();
    const tmp = `${usagePath()}.${process.pid}.tmp`;
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].writeFile(tmp, JSON.stringify(store), "utf8");
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].rename(tmp, usagePath());
}
async function recordUsage(keyId, promptTokens, completionTokens) {
    const store = await readStore();
    const cur = store.usage[keyId] || {
        keyId,
        requests: 0,
        promptTokens: 0,
        completionTokens: 0
    };
    cur.requests += 1;
    cur.promptTokens += promptTokens || 0;
    cur.completionTokens += completionTokens || 0;
    cur.lastUsedAt = new Date().toISOString();
    store.usage[keyId] = cur;
    await writeStore(store);
}
async function getUsage(keyId) {
    const store = await readStore();
    return store.usage[keyId] || {
        keyId,
        requests: 0,
        promptTokens: 0,
        completionTokens: 0
    };
}
async function getUsageForKeys(keyIds) {
    const store = await readStore();
    const out = {};
    for (const id of keyIds){
        out[id] = store.usage[id] || {
            keyId: id,
            requests: 0,
            promptTokens: 0,
            completionTokens: 0
        };
    }
    return out;
}
}),
]})(),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/runtime-reacts.external.js [external] (next/dist/server/runtime-reacts.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/runtime-reacts.external.js", () => require("next/dist/server/runtime-reacts.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:crypto [external] (node:crypto, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:crypto", () => require("node:crypto"));

module.exports = mod;
}),
"[externals]/node:fs [external] (node:fs, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:fs", () => require("node:fs"));

module.exports = mod;
}),
"[externals]/node:path [external] (node:path, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:path", () => require("node:path"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1lqpnmu1h3utv._.js.map