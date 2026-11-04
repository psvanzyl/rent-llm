module.exports = [
(()=>{"use strict";return[
"[project]/src/app/api/auth/me/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$http$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/http.ts [app-route] (ecmascript)");
;
;
;
const dynamic = "force-dynamic";
const handler_GET = async (req)=>{
    const user = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["currentUser"])(req);
    if (!user) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        user: null
    }, {
        status: 401
    });
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        user: {
            id: user.id,
            email: user.email,
            name: user.name ?? null
        }
    });
};
const GET = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$http$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["jsonRoute"])("auth-me", {
    GET: handler_GET
});
}),
"[project]/src/lib/accounts.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createUser",
    ()=>createUser,
    "findUserByEmail",
    ()=>findUserByEmail,
    "getUser",
    ()=>getUser,
    "listUsers",
    ()=>listUsers,
    "mutateCollection",
    ()=>mutateCollection,
    "normalizeEmail",
    ()=>normalizeEmail,
    "readAccounts",
    ()=>readAccounts,
    "readCollection",
    ()=>readCollection,
    "updateUser",
    ()=>updateUser,
    "writeAccounts",
    ()=>writeAccounts,
    "writeCollection",
    ()=>writeCollection
]);
/**
 * Account + collection storage — file-backed, server-only, no native deps.
 *
 * Mirrors the proven gavelll.eu store (atomic tmp+rename writes, serialised write chain) because it
 * has the same constraints: a Next.js server in a container with a mounted data dir, and adding a
 * native SQLite module would mean rebuilding the image with a compiler. The store is small by
 * design — a handful of accounts, one document per user's collection.
 *
 * Two files:
 *   <dir>/accounts.json        every account (email, scrypt hash, created/last seen)
 *   <dir>/collections/<id>.json one user's owned cards
 *
 * The daily catalogue refresh writes cards.json.gz / history.json.gz / stats.json into /app/data;
 * this store lives in /app/data/accounts so a refresh can never touch it.
 */ var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
;
;
const EMPTY_ACCOUNTS = {
    users: {}
};
/**
 * Concurrent writes must not clobber each other, and a rejected write must not poison the chain:
 * `chain.then(...)` on an already-rejected promise never runs its callback and hands every later
 * caller that same rejection, so the store would be permanently wedged. Swallow the failure here
 * (the caller still sees the error from its own write) and keep the chain alive.
 */ let accountsChain = Promise.resolve();
const collectionChains = new Map();
function dataDir() {
    return process.env.RENT_DATA_DIR || process.env.RENT_DATA_DIR || "/app/data/accounts";
}
/**
 * Make sure the store directory exists and is traversable.
 *
 * The directory can lose its execute bit: a blanket `chmod 644` on the parent
 * (which the seeding script used to do) strips it from subdirectories too. The
 * app user then cannot traverse into the directory, every read and write fails
 * with EACCES, and the route 500s with an empty body. Repairing the mode here
 * means the app heals itself instead of needing a manual fix on the host.
 *
 * `chmod` only succeeds if we own the directory; if it does not, we leave the
 * mode alone and the operation fails with a proper error instead of silently.
 */ async function ensureStoreDir() {
    const dir = dataDir();
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].mkdir(dir, {
        recursive: true,
        mode: 0o775
    });
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].chmod(dir, 0o775).catch(()=>{});
    // The collections live in a SUBDIRECTORY, and a fresh volume does not have it yet.
    // Writing a collection file then fails with ENOENT and the add box answers 500.
    // Creating it here means a fresh deployment works on the very first add.
    const collections = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(dir, "collections");
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].mkdir(collections, {
        recursive: true,
        mode: 0o775
    });
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].chmod(collections, 0o775).catch(()=>{});
}
function accountsPath() {
    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(dataDir(), "accounts.json");
}
function collectionPath(userId) {
    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(dataDir(), "collections", `${userId}.json`);
}
async function writeJsonAtomic(file, value) {
    const dir = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].dirname(file);
    await ensureStoreDir();
    const tmp = `${file}.${process.pid}.tmp`;
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].writeFile(tmp, JSON.stringify(value), "utf8");
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].rename(tmp, file);
}
function queue(chain, run) {
    const done = chain.then(run, run);
    return {
        chain: done.then(()=>undefined, ()=>undefined),
        done
    };
}
async function readAccounts() {
    await ensureStoreDir();
    let raw;
    try {
        raw = await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].readFile(accountsPath(), "utf8");
    } catch (e) {
        if (isNotFound(e)) return {
            ...EMPTY_ACCOUNTS,
            users: {}
        };
        throw e;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        throw new Error(`account store at ${accountsPath()} is corrupt: ${e instanceof Error ? e.message : "unknown"}`);
    }
    return {
        users: parsed.users || {}
    };
}
/** True for ENOENT -- the only error that legitimately means "not there yet". */ function isNotFound(e) {
    return typeof e === "object" && e !== null && e.code === "ENOENT";
}
async function writeAccounts(store) {
    const next = queue(accountsChain, ()=>writeJsonAtomic(accountsPath(), store));
    accountsChain = next.chain;
    return next.done;
}
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
async function getUser(id) {
    const store = await readAccounts();
    return store.users[id];
}
async function findUserByEmail(email) {
    const wanted = normalizeEmail(email);
    const store = await readAccounts();
    return Object.values(store.users).find((u)=>normalizeEmail(u.email) === wanted);
}
async function createUser(user) {
    const email = normalizeEmail(user.email);
    const record = {
        ...user,
        email,
        createdAt: user.createdAt || new Date().toISOString()
    };
    return withAccountsStore((store)=>{
        if (Object.values(store.users).some((u)=>normalizeEmail(u.email) === email)) {
            throw new Error("email_taken");
        }
        store.users[record.id] = record;
        return record;
    });
}
async function updateUser(id, patch) {
    return withAccountsStore((store)=>{
        const current = store.users[id];
        if (!current) return undefined;
        const next = {
            ...current,
            ...patch,
            id: current.id,
            updatedAt: new Date().toISOString()
        };
        store.users[id] = next;
        return next;
    });
}
/**
 * Run a read-modify-write against the account store under the write chain, so
 * concurrent mutations cannot lose each other. A failing read aborts the whole
 * operation: the store is never written from a snapshot we could not read.
 */ async function withAccountsStore(fn) {
    const prev = accountsChain;
    const done = prev.then(async ()=>{
        const store = await readAccounts();
        const result = fn(store);
        await writeJsonAtomic(accountsPath(), store);
        return result;
    });
    accountsChain = done.then(()=>undefined, ()=>undefined);
    return done;
}
async function listUsers() {
    const store = await readAccounts();
    return Object.values(store.users).map(({ id, email, name, createdAt, lastLoginAt })=>({
            id,
            email,
            name,
            createdAt,
            lastLoginAt
        }));
}
async function readCollection(userId) {
    await ensureStoreDir();
    let raw;
    try {
        raw = await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].readFile(collectionPath(userId), "utf8");
    } catch (e) {
        if (isNotFound(e)) return {
            items: {}
        };
        throw e;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        throw new Error(`collection for ${userId} is corrupt: ${e instanceof Error ? e.message : "unknown"}`);
    }
    return {
        items: parsed.items || {},
        updatedAt: parsed.updatedAt
    };
}
async function writeCollection(userId, doc) {
    const prev = collectionChains.get(userId) ?? Promise.resolve();
    const next = queue(prev, ()=>writeJsonAtomic(collectionPath(userId), doc));
    collectionChains.set(userId, next.chain);
    return next.done;
}
async function mutateCollection(userId, fn) {
    const prev = collectionChains.get(userId) ?? Promise.resolve();
    const done = prev.then(async ()=>{
        const doc = await readCollection(userId);
        const next = fn(doc);
        if (!next) return doc;
        next.updatedAt = new Date().toISOString();
        await writeJsonAtomic(collectionPath(userId), next);
        return next;
    });
    const chain = done.then(()=>undefined, ()=>undefined);
    collectionChains.set(userId, chain);
    return done;
}
}),
"[project]/src/lib/auth.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PASSWORD_MAX",
    ()=>PASSWORD_MAX,
    "PASSWORD_MIN",
    ()=>PASSWORD_MIN,
    "SESSION_COOKIE",
    ()=>SESSION_COOKIE,
    "SESSION_DAYS",
    ()=>SESSION_DAYS,
    "authConfigured",
    ()=>authConfigured,
    "clientIp",
    ()=>clientIp,
    "currentUser",
    ()=>currentUser,
    "hashPassword",
    ()=>hashPassword,
    "isSecureRequest",
    ()=>isSecureRequest,
    "isValidEmail",
    ()=>isValidEmail,
    "isValidPassword",
    ()=>isValidPassword,
    "originAllowed",
    ()=>originAllowed,
    "rateLimit",
    ()=>rateLimit,
    "serverErrorResponse",
    ()=>serverErrorResponse,
    "sessionCookieValue",
    ()=>sessionCookieValue,
    "signSession",
    ()=>signSession,
    "verifyPassword",
    ()=>verifyPassword,
    "verifySession",
    ()=>verifySession,
    "withClearedSessionCookie",
    ()=>withClearedSessionCookie,
    "withSessionCookie",
    ()=>withSessionCookie
]);
/**
 * Account auth — email + password with scrypt hashing and HMAC-signed session cookies.
 *
 * Mirrors the proven gavelll.eu implementation (no auth dependency, no session table, nothing
 * native to compile), with two deliberate hardenings:
 *
 *   1. AUTH_SECRET is REQUIRED. gavelll falls back to a fixed derived key when the env var is
 *      missing; on a public site that would let anyone forge a session cookie for any user id, so
 *      a missing secret is a hard failure here instead of a silent downgrade.
 *   2. The session cookie is marked Secure when the request arrived over https (Traefik sets
 *      x-forwarded-proto), so production is https-only while local http QA still works.
 */ var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$http$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/http.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$util__$5b$external$5d$__$28$node$3a$util$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:util [external] (node:util, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$accounts$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/accounts.ts [app-route] (ecmascript)");
;
;
;
;
const SESSION_COOKIE = "rent_session";
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 30);
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;
const scrypt = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$util__$5b$external$5d$__$28$node$3a$util$2c$__cjs$29$__["promisify"])(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["scrypt"]);
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;
function secret() {
    const s = process.env.AUTH_SECRET;
    if (s && s.length >= 16) return s;
    throw new Error("AUTH_SECRET is not set (or too short). Refusing to sign sessions with a predictable key — set AUTH_SECRET to a random 32+ byte value.");
}
function authConfigured() {
    const s = process.env.AUTH_SECRET;
    return Boolean(s && s.length >= 16);
}
function signSession(userId, now = new Date()) {
    const expiresAt = Math.floor(now.getTime() / 1000) + SESSION_DAYS * 24 * 3600;
    const payload = `${userId}.${expiresAt}`;
    const mac = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHmac"])("sha256", secret()).update(payload).digest("hex");
    return `${payload}.${mac}`;
}
function verifySession(token) {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [userId, expStr, mac] = parts;
    const exp = Number(expStr);
    if (!userId || !Number.isFinite(exp)) return null;
    let expected;
    try {
        expected = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHmac"])("sha256", secret()).update(`${userId}.${expStr}`).digest("hex");
    } catch  {
        return null;
    }
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["timingSafeEqual"])(a, b)) return null;
    if (exp * 1000 <= Date.now()) return null;
    return userId;
}
function sessionCookieValue(req) {
    const cookie = req.headers.get("cookie") || "";
    const m = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
    return m?.[1];
}
async function currentUser(req) {
    const uid = verifySession(sessionCookieValue(req));
    if (!uid) return undefined;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$accounts$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getUser"])(uid);
}
function isSecureRequest(req) {
    const proto = req.headers.get("x-forwarded-proto");
    if (proto) return proto.split(",")[0].trim() === "https";
    try {
        return new URL(req.url).protocol === "https:";
    } catch  {
        return false;
    }
}
function cookieAttrs(req, maxAge) {
    return `Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly${isSecureRequest(req) ? "; Secure" : ""}`;
}
function withSessionCookie(res, req, userId, maxAge = SESSION_DAYS * 24 * 3600) {
    res.headers.append("Set-Cookie", `${SESSION_COOKIE}=${signSession(userId)}; ${cookieAttrs(req, maxAge)}`);
    return res;
}
function withClearedSessionCookie(res) {
    res.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`);
    return res;
}
async function hashPassword(password) {
    const salt = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomBytes"])(16);
    const hash = await scrypt(password, salt, KEYLEN);
    return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}
async function verifyPassword(password, stored) {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
    const n = Number(nStr);
    const r = Number(rStr);
    const p = Number(pStr);
    if (![
        n,
        r,
        p
    ].every(Number.isFinite)) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const withOpts = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$util__$5b$external$5d$__$28$node$3a$util$2c$__cjs$29$__["promisify"])(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["scrypt"]);
    const actual = await withOpts(password, salt, expected.length, {
        N: n,
        r,
        p
    });
    return actual.length === expected.length && (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["timingSafeEqual"])(actual, expected);
}
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
function isValidPassword(pw) {
    return pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX;
}
function originAllowed(req) {
    const origin = req.headers.get("origin");
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") return false;
    if (!origin) return true;
    try {
        const host = req.headers.get("host") || new URL(req.url).host;
        return new URL(origin).host === host;
    } catch  {
        return false;
    }
}
function clientIp(req) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    return req.headers.get("x-real-ip") || "unknown";
}
const buckets = new Map();
function rateLimit(key, limit, windowMs) {
    const now = Date.now();
    if (buckets.size > 5000) {
        for (const [k, v] of buckets)if (v.reset <= now) buckets.delete(k);
    }
    const b = buckets.get(key);
    if (!b || b.reset <= now) {
        buckets.set(key, {
            n: 1,
            reset: now + windowMs
        });
        return {
            ok: true,
            retryAfter: 0
        };
    }
    b.n += 1;
    if (b.n > limit) return {
        ok: false,
        retryAfter: Math.ceil((b.reset - now) / 1000)
    };
    return {
        ok: true,
        retryAfter: 0
    };
}
function serverErrorResponse(e, where) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$http$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["jsonError"])(e, where, 500, "Sign-in failed on our side. Please try again in a moment.");
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
"[externals]/node:util [external] (node:util, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:util", () => require("node:util"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1igiqryyar46b._.js.map