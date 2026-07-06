/**
 * MOE Result Telegram Bot — single-file backend for cPanel.
 * Application startup file: server.js
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
import { Bot, GrammyError, InlineKeyboard, Keyboard, webhookCallback } from "grammy";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from the app folder (cPanel cwd is not always the app root)
dotenv.config({ path: path.join(__dirname, ".env") });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Add it in cPanel → Setup Node.js App → Environment variables, or upload a .env file next to server.js.`
    );
  }
  return value.trim();
}

function optionalEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === null || String(value).trim() === "") {
    return undefined;
  }
  return String(value).trim();
}

let env;
try {
  env = {
    BOT_TOKEN: requireEnv("BOT_TOKEN"),
    CHANNEL_CHAT_ID: optionalEnv("CHANNEL_CHAT_ID"),
    WEBHOOK_URL: optionalEnv("WEBHOOK_URL"),
    WEBHOOK_SECRET: optionalEnv("WEBHOOK_SECRET"),
    DATABASE_URL: requireEnv("DATABASE_URL"),
    JWT_SECRET: requireEnv("JWT_SECRET"),
    // Prefer cPanel-injected PORT; do not force 3000 in production .env
    PORT: Number(process.env.PORT || 3000),
    NODE_ENV: process.env.NODE_ENV || "development",
    // Admin panel on a separate subdomain (enables CORS + cross-site cookies)
    ADMIN_ORIGIN: optionalEnv("ADMIN_ORIGIN"),
  };

  if (env.JWT_SECRET.length < 16) {
    throw new Error("JWT_SECRET must be at least 16 characters");
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

function isBotTokenConfigured(token) {
  return /^\d+:[A-Za-z0-9_-]{20,}$/.test(token) && !token.includes("REPLACE");
}

function log(level, message, data) {
  const entry = data ? { level, message, ...data } : { level, message };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else console.log(line);
}

function createId() {
  return randomBytes(12).toString("hex");
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

function parseDatabaseUrl(urlString) {
  const u = new URL(urlString);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    waitForConnections: true,
    connectionLimit: 10,
  };
}

const pool = mysql.createPool(parseDatabaseUrl(env.DATABASE_URL));

function isDatabaseAccessError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const code = error && error.code;
  return (
    ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ER_ACCESS_DENIED_ERROR", "ER_DBACCESS_DENIED_ERROR"].includes(
      code
    ) ||
    message.includes("denied access") ||
    message.includes("ECONNREFUSED") ||
    message.includes("connect ETIMEDOUT") ||
    message.includes("Can't reach database") ||
    message.includes("Access denied")
  );
}

function databaseErrorMessage() {
  return (
    "Cannot connect to MySQL. Check DATABASE_URL in .env, run sql/init.sql in phpMyAdmin, " +
    "link the database user with ALL PRIVILEGES in cPanel, and enable Remote MySQL for your IP."
  );
}

// ---------------------------------------------------------------------------
// Settings / analytics / users
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS = {
  remedialReleased: false,
  entranceReleased: false,
  remedialChannelLink: "",
  entranceChannelLink: "",
  remedialChannelChatId: "",
  entranceChannelChatId: "",
  remedialUrl: "",
  entranceUrl: "",
  preReleaseMessage: "Your result will be released soon.",
  postActionMessage:
    "Thank you for joining our channel! You can now check your result using the link below.",
};

function getChannelConfig(settings, type) {
  if (type === "remedial") {
    return {
      link: settings.remedialChannelLink,
      chatId: settings.remedialChannelChatId,
    };
  }
  return {
    link: settings.entranceChannelLink,
    chatId: settings.entranceChannelChatId,
  };
}

function mapSettings(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    remedialReleased: !!row.remedialReleased,
    entranceReleased: !!row.entranceReleased,
    remedialChannelLink: row.remedialChannelLink || "",
    entranceChannelLink: row.entranceChannelLink || "",
    remedialChannelChatId: row.remedialChannelChatId || "",
    entranceChannelChatId: row.entranceChannelChatId || "",
    remedialUrl: row.remedialUrl || "",
    entranceUrl: row.entranceUrl || "",
    preReleaseMessage: row.preReleaseMessage || DEFAULT_SETTINGS.preReleaseMessage,
    postActionMessage: row.postActionMessage || DEFAULT_SETTINGS.postActionMessage,
  };
}

async function getSettings() {
  const [rows] = await pool.query("SELECT * FROM `Settings` WHERE `id` = 'default' LIMIT 1");
  if (!rows.length) {
    await pool.query(
      `INSERT INTO \`Settings\` (
        \`id\`, \`remedialReleased\`, \`entranceReleased\`,
        \`remedialChannelLink\`, \`entranceChannelLink\`,
        \`remedialChannelChatId\`, \`entranceChannelChatId\`,
        \`remedialUrl\`, \`entranceUrl\`, \`preReleaseMessage\`, \`postActionMessage\`
      ) VALUES ('default', 0, 0, '', '', '', '', '', '', ?, ?)
      ON DUPLICATE KEY UPDATE \`id\` = \`id\``,
      [DEFAULT_SETTINGS.preReleaseMessage, DEFAULT_SETTINGS.postActionMessage]
    );
    return { ...DEFAULT_SETTINGS };
  }
  return mapSettings(rows[0]);
}

async function updateSettings(data) {
  const current = await getSettings();
  const next = { ...current, ...data };
  await pool.query(
    `UPDATE \`Settings\` SET
      \`remedialReleased\` = ?,
      \`entranceReleased\` = ?,
      \`remedialChannelLink\` = ?,
      \`entranceChannelLink\` = ?,
      \`remedialChannelChatId\` = ?,
      \`entranceChannelChatId\` = ?,
      \`remedialUrl\` = ?,
      \`entranceUrl\` = ?,
      \`preReleaseMessage\` = ?,
      \`postActionMessage\` = ?
    WHERE \`id\` = 'default'`,
    [
      next.remedialReleased ? 1 : 0,
      next.entranceReleased ? 1 : 0,
      next.remedialChannelLink,
      next.entranceChannelLink,
      next.remedialChannelChatId,
      next.entranceChannelChatId,
      next.remedialUrl,
      next.entranceUrl,
      next.preReleaseMessage,
      next.postActionMessage,
    ]
  );
  return next;
}

async function incrementRemedialClicks() {
  await pool.query(
    `INSERT INTO \`Analytics\` (\`id\`, \`remedialClicks\`, \`entranceClicks\`)
     VALUES ('default', 1, 0)
     ON DUPLICATE KEY UPDATE \`remedialClicks\` = \`remedialClicks\` + 1`
  );
}

async function incrementEntranceClicks() {
  await pool.query(
    `INSERT INTO \`Analytics\` (\`id\`, \`remedialClicks\`, \`entranceClicks\`)
     VALUES ('default', 0, 1)
     ON DUPLICATE KEY UPDATE \`entranceClicks\` = \`entranceClicks\` + 1`
  );
}

async function getAnalytics() {
  const [[totals]] = await pool.query(
    `SELECT
      COUNT(*) AS totalUsers,
      SUM(CASE WHEN \`isBlocked\` = 0 THEN 1 ELSE 0 END) AS activeUsers,
      SUM(CASE WHEN \`isBlocked\` = 1 THEN 1 ELSE 0 END) AS blockedUsers
     FROM \`User\``
  );
  const [analyticsRows] = await pool.query(
    "SELECT * FROM `Analytics` WHERE `id` = 'default' LIMIT 1"
  );
  let analytics = analyticsRows[0];
  if (!analytics) {
    await pool.query(
      "INSERT INTO `Analytics` (`id`, `remedialClicks`, `entranceClicks`) VALUES ('default', 0, 0)"
    );
    analytics = { remedialClicks: 0, entranceClicks: 0 };
  }
  return {
    totalUsers: Number(totals.totalUsers || 0),
    activeUsers: Number(totals.activeUsers || 0),
    blockedUsers: Number(totals.blockedUsers || 0),
    remedialClicks: analytics.remedialClicks,
    entranceClicks: analytics.entranceClicks,
  };
}

async function trackUser(ctx, next) {
  if (ctx.from) {
    const { id, username, first_name } = ctx.from;
    const userId = createId();
    await pool.query(
      `INSERT INTO \`User\` (\`id\`, \`telegramId\`, \`username\`, \`firstName\`, \`lastSeenAt\`)
       VALUES (?, ?, ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE
         \`username\` = VALUES(\`username\`),
         \`firstName\` = VALUES(\`firstName\`),
         \`lastSeenAt\` = NOW(3)`,
      [userId, id, username ?? null, first_name ?? null]
    );
  }
  await next();
}

async function isUserChannelVerified(telegramId, type) {
  const column =
    type === "remedial" ? "remedialChannelVerified" : "entranceChannelVerified";
  const [rows] = await pool.query(
    `SELECT \`${column}\` AS verified FROM \`User\` WHERE \`telegramId\` = ? LIMIT 1`,
    [telegramId]
  );
  return rows.length ? !!rows[0].verified : false;
}

async function markUserChannelVerified(telegramId, type) {
  const column =
    type === "remedial" ? "remedialChannelVerified" : "entranceChannelVerified";
  await pool.query(`UPDATE \`User\` SET \`${column}\` = 1 WHERE \`telegramId\` = ?`, [
    telegramId,
  ]);
}

function channelIdMatches(configuredChatId, chat) {
  const configured = (configuredChatId || "").trim();
  if (!configured) return false;
  if (configured.startsWith("@")) {
    const username = configured.slice(1).toLowerCase();
    return chat.username?.toLowerCase() === username;
  }
  return String(chat.id) === configured;
}

async function verifyForwardedChannelPost(telegramId, chat) {
  const settings = await getSettings();
  if (channelIdMatches(settings.remedialChannelChatId, chat)) {
    await markUserChannelVerified(telegramId, "remedial");
    return "remedial";
  }
  if (channelIdMatches(settings.entranceChannelChatId, chat)) {
    await markUserChannelVerified(telegramId, "entrance");
    return "entrance";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Channel membership
// ---------------------------------------------------------------------------

const JOINED_STATUSES = new Set(["member", "administrator", "creator", "restricted"]);

async function checkChannelMembershipDetailed(api, userId, channelChatId, type) {
  if (!channelChatId) {
    log("warn", "channelChatId not configured", { type });
    return { joined: false, reason: "not_configured" };
  }

  if (await isUserChannelVerified(userId, type)) {
    return { joined: true };
  }

  try {
    const member = await api.getChatMember(channelChatId, userId);
    if (JOINED_STATUSES.has(member.status)) {
      return { joined: true };
    }
    return { joined: false, reason: "not_member" };
  } catch (error) {
    if (error instanceof GrammyError) {
      const desc = error.description ?? "";
      if (desc.includes("chat not found") || desc.includes("CHAT_ID_INVALID")) {
        log("error", "getChatMember: bot cannot access channel", {
          chatId: channelChatId,
          userId,
          description: desc,
        });
        return { joined: false, reason: "bot_not_in_channel" };
      }
      if (desc.includes("member list is inaccessible")) {
        log("warn", "getChatMember: bot is not channel admin — use forward verification", {
          chatId: channelChatId,
          userId,
        });
        return { joined: false, reason: "bot_needs_admin" };
      }
      if (desc.includes("user not found")) {
        return { joined: false, reason: "not_member" };
      }
    }
    log("error", "getChatMember failed", {
      error: error instanceof Error ? error.message : String(error),
      chatId: channelChatId,
      userId,
    });
    return { joined: false, reason: "error" };
  }
}

async function checkChannelMembershipWithReason(ctx, type) {
  if (!ctx.from) return { joined: false, reason: "error" };
  const settings = await getSettings();
  const { chatId } = getChannelConfig(settings, type);
  return checkChannelMembershipDetailed(ctx.api, ctx.from.id, chatId, type);
}

// ---------------------------------------------------------------------------
// Bot keyboards & handlers
// ---------------------------------------------------------------------------

const REMEDIAL_TEXT = "👉 2018 Remedial Result";
const ENTRANCE_TEXT = "👉 2018 Entrance Result";
const BACK_TEXT = "🔙 Back to Menu";
const CALLBACK_REMEDIAL = "flow:remedial";
const CALLBACK_ENTRANCE = "flow:entrance";
const CALLBACK_JOINED_REMEDIAL = "joined:remedial";
const CALLBACK_JOINED_ENTRANCE = "joined:entrance";

const WELCOME_MESSAGE =
  "Welcome to MOE Result Bot!\n\nPlease select which result you would like to check:";

const RESULT_LABELS = {
  remedial: "🌐 Open Remedial Result",
  entrance: "🌐 Open Entrance Result",
};

const JOIN_MESSAGE = "To check your result, you must first join our official channel.";
const BOT_SETUP_MESSAGE =
  "Channel verification is temporarily unavailable. The bot must be added as an administrator to the channel. Please contact support.";
const FORWARD_VERIFY_MESSAGE =
  "Join our channel, then forward any post from the channel to this bot. After that, tap your result button again.\n\n" +
  "Or ask the channel owner to add this bot as a channel administrator.";

function mainMenuKeyboard() {
  return new Keyboard().text(REMEDIAL_TEXT).text(ENTRANCE_TEXT).resized().persistent();
}

function joinChannelKeyboard(channelLink, joinedCallback) {
  const keyboard = new InlineKeyboard();
  if (channelLink) {
    keyboard.url("📢 Join Channel", channelLink);
  }
  keyboard.text("Joined ✅", joinedCallback);
  return keyboard;
}

function resultUrlKeyboard(url, label) {
  return new InlineKeyboard().url(label, url);
}

function membershipMessage(reason) {
  if (reason === "bot_needs_admin") return FORWARD_VERIFY_MESSAGE;
  if (reason === "bot_not_in_channel" || reason === "not_configured") return BOT_SETUP_MESSAGE;
  if (reason === "error") return "Could not verify channel membership. Please try again later.";
  return "You have not joined the channel yet. Please join, forward any channel post to this bot, then tap Joined ✅ again.";
}

async function sendResultResponse(ctx, type, settings) {
  const released = type === "remedial" ? settings.remedialReleased : settings.entranceReleased;
  const url = type === "remedial" ? settings.remedialUrl : settings.entranceUrl;

  if (!released) {
    await ctx.reply(settings.preReleaseMessage, { reply_markup: mainMenuKeyboard() });
    return;
  }

  const message = settings.postActionMessage;
  if (url) {
    await ctx.reply(message, {
      reply_markup: resultUrlKeyboard(url, RESULT_LABELS[type]),
    });
    await ctx.reply("Use the button above or return to the main menu.", {
      reply_markup: mainMenuKeyboard(),
    });
  } else {
    await ctx.reply(
      `${message}\n\n(Result link is not configured yet. Please try again later.)`,
      { reply_markup: mainMenuKeyboard() }
    );
  }
}

async function handleResultFlow(ctx, type, joinedCallback) {
  const settings = await getSettings();
  const { link } = getChannelConfig(settings, type);
  const check = await checkChannelMembershipWithReason(ctx, type);

  if (!check.joined) {
    const text = check.reason === "not_member" ? JOIN_MESSAGE : membershipMessage(check.reason);
    await ctx.reply(text, {
      reply_markup: joinChannelKeyboard(link, joinedCallback),
    });
    return;
  }

  await sendResultResponse(ctx, type, settings);
}

async function handleJoinedConfirmation(ctx, type, joinedCallback) {
  await ctx.answerCallbackQuery();
  const settings = await getSettings();
  const { link } = getChannelConfig(settings, type);
  const check = await checkChannelMembershipWithReason(ctx, type);

  if (!check.joined) {
    await ctx.reply(membershipMessage(check.reason), {
      reply_markup: joinChannelKeyboard(link, joinedCallback),
    });
    return;
  }

  await sendResultResponse(ctx, type, settings);
}

async function handleStart(ctx) {
  await ctx.reply(WELCOME_MESSAGE, { reply_markup: mainMenuKeyboard() });
}

async function handleBackToMenu(ctx) {
  await ctx.reply(WELCOME_MESSAGE, { reply_markup: mainMenuKeyboard() });
}

async function handleRemedial(ctx) {
  await incrementRemedialClicks();
  await handleResultFlow(ctx, "remedial", CALLBACK_JOINED_REMEDIAL);
}

async function handleEntrance(ctx) {
  await incrementEntranceClicks();
  await handleResultFlow(ctx, "entrance", CALLBACK_JOINED_ENTRANCE);
}

async function handleChannelForward(ctx) {
  if (!ctx.from || !ctx.message) return;
  const origin = ctx.message.forward_origin;
  if (origin?.type !== "channel") return;

  const verifiedType = await verifyForwardedChannelPost(ctx.from.id, origin.chat);
  if (!verifiedType) {
    await ctx.reply(
      "This forward is not from our official channel. Please forward a post from the channel you joined.",
      { reply_markup: mainMenuKeyboard() }
    );
    return;
  }

  const label = verifiedType === "remedial" ? "Remedial" : "Entrance";
  await ctx.reply(
    `${label} channel membership verified! Return to the main menu and tap your result button again.`,
    { reply_markup: mainMenuKeyboard() }
  );
}

function hasChannelForward(ctx) {
  return ctx.message?.forward_origin?.type === "channel";
}

function createBot() {
  const bot = new Bot(env.BOT_TOKEN);

  bot.use(trackUser);
  bot.command("start", handleStart);
  bot.hears(REMEDIAL_TEXT, handleRemedial);
  bot.hears(ENTRANCE_TEXT, handleEntrance);
  bot.hears(BACK_TEXT, handleBackToMenu);

  bot.callbackQuery(CALLBACK_REMEDIAL, async (ctx) => {
    await incrementRemedialClicks();
    await handleResultFlow(ctx, "remedial", CALLBACK_JOINED_REMEDIAL);
  });
  bot.callbackQuery(CALLBACK_JOINED_REMEDIAL, async (ctx) => {
    await handleJoinedConfirmation(ctx, "remedial", CALLBACK_JOINED_REMEDIAL);
  });
  bot.callbackQuery(CALLBACK_ENTRANCE, async (ctx) => {
    await incrementEntranceClicks();
    await handleResultFlow(ctx, "entrance", CALLBACK_JOINED_ENTRANCE);
  });
  bot.callbackQuery(CALLBACK_JOINED_ENTRANCE, async (ctx) => {
    await handleJoinedConfirmation(ctx, "entrance", CALLBACK_JOINED_ENTRANCE);
  });

  bot.on("message").filter(hasChannelForward, handleChannelForward);

  bot.catch((err) => {
    log("error", "Bot error", { err: err.error instanceof Error ? err.error.message : String(err.error) });
  });

  return bot;
}

// ---------------------------------------------------------------------------
// Broadcast (in-process, no Redis)
// ---------------------------------------------------------------------------

const RATE_LIMIT_MS = 40;
const runningBroadcasts = new Set();

function isBlockedError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("403") ||
    message.includes("blocked") ||
    message.includes("Forbidden") ||
    message.includes("deactivated")
  );
}

function mapBroadcast(row) {
  return {
    id: row.id,
    content: row.content,
    photoUrl: row.photoUrl,
    status: row.status,
    sent: row.sent,
    failed: row.failed,
    total: row.total,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

async function runBroadcast(bot, broadcastId) {
  if (runningBroadcasts.has(broadcastId)) return;
  runningBroadcasts.add(broadcastId);

  try {
    const [users] = await pool.query(
      "SELECT `telegramId` FROM `User` WHERE `isBlocked` = 0"
    );
    const total = users.length;

    await pool.query(
      "UPDATE `Broadcast` SET `total` = ?, `status` = ?, `sent` = 0, `failed` = 0 WHERE `id` = ?",
      [total, total === 0 ? "COMPLETED" : "RUNNING", broadcastId]
    );

    if (total === 0) return;

    const [broadcastRows] = await pool.query(
      "SELECT * FROM `Broadcast` WHERE `id` = ? LIMIT 1",
      [broadcastId]
    );
    const broadcast = broadcastRows[0];
    if (!broadcast) return;

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      const telegramId = Number(user.telegramId);
      try {
        if (broadcast.photoUrl) {
          await bot.api.sendPhoto(telegramId, broadcast.photoUrl, {
            caption: broadcast.content,
          });
        } else {
          await bot.api.sendMessage(telegramId, broadcast.content);
        }
        sent++;
      } catch (error) {
        failed++;
        if (isBlockedError(error)) {
          await pool.query("UPDATE `User` SET `isBlocked` = 1 WHERE `telegramId` = ?", [
            user.telegramId,
          ]);
        }
      }

      if ((sent + failed) % 25 === 0) {
        await pool.query(
          "UPDATE `Broadcast` SET `sent` = ?, `failed` = ? WHERE `id` = ?",
          [sent, failed, broadcastId]
        );
      }

      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }

    await pool.query(
      "UPDATE `Broadcast` SET `sent` = ?, `failed` = ?, `status` = 'COMPLETED' WHERE `id` = ?",
      [sent, failed, broadcastId]
    );
    log("info", "Broadcast completed", { broadcastId, sent, failed });
  } catch (error) {
    await pool.query("UPDATE `Broadcast` SET `status` = 'FAILED' WHERE `id` = ?", [
      broadcastId,
    ]);
    log("error", "Broadcast failed", {
      broadcastId,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    runningBroadcasts.delete(broadcastId);
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function signToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

async function requireAuth(request, reply) {
  const token = request.cookies.token;
  if (!token) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
  try {
    request.admin = verifyToken(token);
  } catch {
    return reply.status(401).send({ error: "Invalid or expired token" });
  }
}

// ---------------------------------------------------------------------------
// API server
// ---------------------------------------------------------------------------

async function createApiServer(bot) {
  const app = Fastify({ logger: false });

  await app.register(cookie);

  // Allow http + https for the admin host (browsers send exact Origin).
  let corsOrigin = env.NODE_ENV === "development" ? true : false;
  if (env.ADMIN_ORIGIN) {
    const base = env.ADMIN_ORIGIN.replace(/\/$/, "");
    const allowed = new Set([
      base,
      base.replace(/^https:/i, "http:"),
      base.replace(/^http:/i, "https:"),
    ]);
    corsOrigin = (origin, cb) => {
      if (!origin || allowed.has(origin)) {
        cb(null, true);
        return;
      }
      cb(null, false);
    };
  }
  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
  });

  // Separate admin subdomain needs SameSite=None + Secure (HTTPS on the API).
  const cookieOptions = env.ADMIN_ORIGIN
    ? {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      }
    : {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      };

  app.post("/api/auth/login", async (request, reply) => {
    const body = request.body || {};
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
      return reply.status(400).send({ error: "Invalid credentials format" });
    }

    try {
      const [rows] = await pool.query(
        "SELECT `id`, `email`, `passwordHash` FROM `Admin` WHERE `email` = ? LIMIT 1",
        [email]
      );
      const admin = rows[0];
      if (!admin) {
        return reply.status(401).send({ error: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, admin.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: "Invalid email or password" });
      }

      const token = signToken({ adminId: admin.id, email: admin.email });
      reply.setCookie("token", token, cookieOptions);

      return { email: admin.email };
    } catch (error) {
      if (isDatabaseAccessError(error)) {
        return reply.status(503).send({ error: databaseErrorMessage() });
      }
      throw error;
    }
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    reply.clearCookie("token", {
      path: cookieOptions.path,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
    });
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (request) => {
    return { email: request.admin.email };
  });

  app.get("/api/settings", { preHandler: requireAuth }, async () => getSettings());

  app.put("/api/settings", { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body || {};
    const allowed = [
      "remedialReleased",
      "entranceReleased",
      "remedialChannelLink",
      "entranceChannelLink",
      "remedialChannelChatId",
      "entranceChannelChatId",
      "remedialUrl",
      "entranceUrl",
      "preReleaseMessage",
      "postActionMessage",
    ];
    const data = {};
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (!Object.keys(data).length) {
      return reply.status(400).send({ error: "No settings fields provided" });
    }
    return updateSettings(data);
  });

  app.post("/api/settings/test-channel", { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body || {};
    const type = body.type === "entrance" ? "entrance" : "remedial";
    const settings = await getSettings();
    const { chatId } = getChannelConfig(settings, type);
    const label = type === "remedial" ? "Remedial" : "Entrance";

    if (!chatId) {
      return reply.status(400).send({ error: `${label} channel chat ID is not configured` });
    }

    try {
      const chat = await bot.api.getChat(chatId);
      const botMember = await bot.api.getChatMember(chatId, (await bot.api.getMe()).id);
      const isAdmin = ["administrator", "creator"].includes(botMember.status);

      return {
        ok: true,
        chatTitle: "title" in chat ? chat.title : chatId,
        botIsAdmin: isAdmin,
        message: isAdmin
          ? `${label} channel connection successful. Bot can verify members with getChatMember.`
          : `${label} channel found, but bot is NOT an administrator. Add the bot as channel admin, ` +
            "or users must forward a channel post to verify membership.",
      };
    } catch (error) {
      return reply.status(400).send({
        error: `Failed to connect to ${label.toLowerCase()} channel. Check chat ID and bot permissions.`,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get("/api/analytics", { preHandler: requireAuth }, async () => getAnalytics());

  app.get("/api/broadcasts", { preHandler: requireAuth }, async () => {
    const [rows] = await pool.query(
      "SELECT * FROM `Broadcast` ORDER BY `createdAt` DESC LIMIT 50"
    );
    return rows.map(mapBroadcast);
  });

  app.get("/api/broadcasts/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params;
    const [rows] = await pool.query("SELECT * FROM `Broadcast` WHERE `id` = ? LIMIT 1", [id]);
    if (!rows.length) {
      return reply.status(404).send({ error: "Broadcast not found" });
    }
    return mapBroadcast(rows[0]);
  });

  app.get("/api/broadcasts/:id/status", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params;
    const [rows] = await pool.query("SELECT * FROM `Broadcast` WHERE `id` = ? LIMIT 1", [id]);
    if (!rows.length) {
      return reply.status(404).send({ error: "Broadcast not found" });
    }
    const broadcast = rows[0];
    const processed = broadcast.sent + broadcast.failed;
    return {
      id: broadcast.id,
      status: broadcast.status,
      sent: broadcast.sent,
      failed: broadcast.failed,
      total: broadcast.total,
      processed,
      progress: broadcast.total > 0 ? Math.round((processed / broadcast.total) * 100) : 0,
      message: `Sending to ${processed}/${broadcast.total} users...`,
    };
  });

  app.post("/api/broadcasts", { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body || {};
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const photoUrl =
      typeof body.photoUrl === "string" && body.photoUrl.trim() ? body.photoUrl.trim() : null;

    if (!content) {
      return reply.status(400).send({ error: "Content is required" });
    }

    const id = createId();
    await pool.query(
      `INSERT INTO \`Broadcast\` (\`id\`, \`content\`, \`photoUrl\`, \`status\`, \`sent\`, \`failed\`, \`total\`)
       VALUES (?, ?, ?, 'PENDING', 0, 0, 0)`,
      [id, content, photoUrl]
    );

    const [rows] = await pool.query("SELECT * FROM `Broadcast` WHERE `id` = ? LIMIT 1", [id]);
    const broadcast = mapBroadcast(rows[0]);

    setImmediate(() => {
      runBroadcast(bot, id).catch((err) => {
        log("error", "Broadcast runner error", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    });

    return broadcast;
  });

  app.get("/api/health", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { ok: true, database: "connected" };
    } catch {
      return reply.status(503).send({ ok: false, database: "disconnected" });
    }
  });

  const publicDir = path.join(__dirname, "public");
  const hasAdminBuild = fs.existsSync(path.join(publicDir, "index.html"));

  if (hasAdminBuild) {
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: "/",
      decorateReply: true,
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api")) {
        return reply.status(404).send({ error: "Not found" });
      }
      return reply.sendFile("index.html");
    });
  } else {
    app.get("/", async (_request, reply) => {
      return reply.send({
        message: "MOE Result Bot API is running. Build admin UI with: npm run build:admin",
      });
    });
  }

  return app;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const bot = createBot();
  const app = await createApiServer(bot);

  if (env.NODE_ENV === "production" && env.WEBHOOK_URL) {
    const webhookPath = "/webhook";
    const fullWebhookUrl = `${env.WEBHOOK_URL.replace(/\/$/, "")}${webhookPath}`;

    const handler = webhookCallback(bot, "fastify");
    app.post(webhookPath, async (request, reply) => {
      if (env.WEBHOOK_SECRET) {
        const token = request.headers["x-telegram-bot-api-secret-token"];
        if (token !== env.WEBHOOK_SECRET) {
          return reply.status(403).send({ error: "Forbidden" });
        }
      }
      return handler(request, reply);
    });

    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    log("info", "API server listening", { port: env.PORT });

    await bot.api.setWebhook(fullWebhookUrl, {
      secret_token: env.WEBHOOK_SECRET,
    });
    log("info", "Running in webhook mode", { webhookUrl: fullWebhookUrl });
  } else {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    log("info", "API server listening", { port: env.PORT });

    if (!isBotTokenConfigured(env.BOT_TOKEN)) {
      log(
        "warn",
        "BOT_TOKEN is missing or still a placeholder — Telegram bot not started. " +
          "Set your real token from @BotFather in .env, then restart."
      );
      log("info", "API server is running — admin dashboard can be used for UI testing");
      return;
    }

    bot
      .start({
        onStart: (botInfo) => {
          log("info", "Bot started", { username: botInfo.username });
        },
      })
      .catch((err) => {
        log("error", "Bot polling failed", {
          err: err instanceof Error ? err.message : String(err),
        });
        if (env.NODE_ENV === "production") {
          process.exit(1);
        }
        log("warn", "API server still running without Telegram bot");
      });

    log("info", "Running in polling mode (development)");
  }
}

main().catch((err) => {
  log("error", "Failed to start application", {
    err: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
