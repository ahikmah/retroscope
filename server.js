import { createServer } from 'http'
import { createRequire } from 'module'
import { WebSocketServer } from 'ws'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

const PORT = 3000
const rooms = new Map()
const disconnectTimers = new Map()

const ICEBREAKER_QUESTIONS = [
  'describe this sprint in one word',
  'what do you need from this retro?',
  'if this sprint were a weather pattern, it was…',
  'your honest reaction to "retro time" was…',
  "what's one thing you're hoping someone else brings up?",
  'if this sprint had a theme song, it would be…',
  'rate your energy right now, no lying',
  'one word for how this sprint treated you',
  'what survived this sprint that probably shouldn\'t have?',
]
function pickQuestion() {
  return ICEBREAKER_QUESTIONS[Math.floor(Math.random() * ICEBREAKER_QUESTIONS.length)]
}

// ── DB setup ──────────────────────────────────────────────────────────────────
const db = new Database('retro.db')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    name       TEXT NOT NULL,
    verified   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS auth_tokens (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS email_verifications (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    session_name TEXT NOT NULL,
    room_code    TEXT NOT NULL,
    template_id  TEXT NOT NULL DEFAULT '4ls',
    completed_at TEXT NOT NULL,
    players      TEXT NOT NULL,
    cards        TEXT NOT NULL,
    columns      TEXT NOT NULL DEFAULT '[]',
    creator_id   TEXT
  );
  CREATE TABLE IF NOT EXISTS teams (
    id         TEXT PRIMARY KEY,
    owner_id   TEXT NOT NULL,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS team_members (
    id      TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    name    TEXT NOT NULL,
    email   TEXT NOT NULL
  )
`)
// migrate existing users table
for (const col of ['verified INTEGER NOT NULL DEFAULT 0']) {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col}`) } catch {}
}

// migrate existing sessions table
for (const col of [
  'template_id TEXT NOT NULL DEFAULT "4ls"',
  'columns TEXT NOT NULL DEFAULT "[]"',
  'creator_id TEXT',
  'team_id TEXT',
]) {
  try { db.exec(`ALTER TABLE sessions ADD COLUMN ${col}`) } catch {}
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(pw, salt, 64).toString('hex')
  return `${salt}:${hash}`
}
function verifyPassword(pw, stored) {
  try {
    const [salt, hash] = stored.split(':')
    const input = scryptSync(pw, salt, 64)
    return timingSafeEqual(Buffer.from(hash, 'hex'), input)
  } catch { return false }
}
function makeToken() { return randomBytes(32).toString('hex') }
function getUserByToken(token) {
  if (!token) return null
  const row = db.prepare('SELECT user_id FROM auth_tokens WHERE token = ?').get(token)
  if (!row) return null
  return db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(row.user_id)
}
function getTokenFromReq(req) {
  const auth = req.headers['authorization'] || ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : null
}

function readBody(req) {
  return new Promise(resolve => {
    let body = ''
    req.on('data', c => body += c)
    req.on('end', () => { try { resolve(JSON.parse(body)) } catch { resolve({}) } })
  })
}

async function sendBottleEmail(email, recipientName, senderName, message, sessionName) {
  const displaySender = senderName?.trim() ? senderName.trim() : 'someone from your team'
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL,
      to: email,
      subject: `💌 message in a bottle — ${sessionName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#09090f;color:#fff;border-radius:16px">
          <h1 style="font-size:24px;font-weight:900;margin:0 0 8px">💌 message in a bottle</h1>
          <p style="color:#666;font-size:12px;margin:0 0 32px">from the retro: ${sessionName}</p>
          <p style="margin:0 0 8px">hey ${recipientName},</p>
          <p style="color:#aaa;font-size:12px;margin:0 0 24px">${displaySender} left you a note.</p>
          <div style="background:#111120;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px 24px;margin:0 0 32px">
            <p style="color:#e0e0ff;font-size:15px;line-height:1.6;margin:0;white-space:pre-wrap">${message}</p>
          </div>
          <p style="color:#444;font-size:11px;margin:0">sent anonymously via retroscope 🍶</p>
        </div>
      `,
    }),
  })
}

async function sendVerificationEmail(email, name, token) {
  const verifyUrl = `${process.env.APP_URL || `http://localhost:${PORT}`}/api/auth/verify/${token}`
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL,
      to: email,
      subject: 'verify your retroscope account',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#09090f;color:#fff;border-radius:16px">
          <h1 style="font-size:24px;font-weight:900;margin:0 0 8px">Retroscope</h1>
          <p style="color:#666;font-size:12px;margin:0 0 32px">your feedback has been received and ignored.</p>
          <p style="margin:0 0 8px">hey ${name},</p>
          <p style="color:#aaa;margin:0 0 32px">click below to verify your email. or don't. we'll wait.</p>
          <a href="${verifyUrl}"
            style="display:inline-block;background:#4f46e5;color:#fff;font-weight:900;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:14px">
            verify my account
          </a>
          <p style="color:#444;font-size:11px;margin:32px 0 0">link expires in 24 hours. you've been warned.</p>
        </div>
      `,
    }),
  })
}

const stmtInsert = db.prepare(`
  INSERT OR REPLACE INTO sessions
    (id, session_name, room_code, template_id, completed_at, players, cards, columns, creator_id, team_id)
  VALUES
    (@id, @sessionName, @roomCode, @templateId, @completedAt, @players, @cards, @columns, @creatorId, @teamId)
`)

function saveSession(room) {
  stmtInsert.run({
    id:          room.code + '_' + Date.now(),
    sessionName: room.sessionName,
    roomCode:    room.code,
    templateId:  room.templateId ?? '4ls',
    completedAt: new Date().toISOString(),
    players:     JSON.stringify(room.players.map(({ ws, ...p }) => p)),
    cards:       JSON.stringify(room.cards),
    columns:     JSON.stringify(room.columns ?? []),
    creatorId:   room.creatorId ?? null,
    teamId:      room.team?.id ?? null,
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeCode() { return randomBytes(2).toString('hex').toUpperCase() }
function makeId()   { return randomBytes(4).toString('hex') }

function broadcast(room) {
  const msg = JSON.stringify({ type: 'state', room: sanitize(room) })
  for (const p of room.players) {
    if (p.ws?.readyState === 1) p.ws.send(msg)
  }
}

function sanitize(room) {
  return { ...room, players: room.players.map(({ ws, ...p }) => p) }
}

function wsSend(ws, payload) { ws.send(JSON.stringify(payload)) }

function jsonReply(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(data))
}

// ── HTTP (REST) ───────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  // ── Auth: register ──────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/auth/register') {
    const { email, password, name } = await readBody(req)
    if (!email || !password || !name)
      return jsonReply(res, { error: 'email, password and name required' }, 400)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return jsonReply(res, { error: 'that does not look like a real email' }, 400)
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
    if (existing) return jsonReply(res, { error: 'Email already registered' }, 409)
    const id = makeId()
    db.prepare('INSERT INTO users (id, email, password, name, verified, created_at) VALUES (?, ?, ?, ?, 0, ?)')
      .run(id, email.toLowerCase(), hashPassword(password), name.trim(), new Date().toISOString())
    const verifyToken = makeToken()
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    db.prepare('INSERT INTO email_verifications (token, user_id, expires_at) VALUES (?, ?, ?)')
      .run(verifyToken, id, expires)
    await sendVerificationEmail(email.toLowerCase(), name.trim(), verifyToken)
    return jsonReply(res, { message: 'check your email to verify your account.' })
  }

  // ── Auth: login ─────────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const { email, password } = await readBody(req)
    if (!email || !password) return jsonReply(res, { error: 'email and password required' }, 400)
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase())
    if (!user || !verifyPassword(password, user.password))
      return jsonReply(res, { error: 'Invalid email or password' }, 401)
    if (!user.verified)
      return jsonReply(res, { error: 'check your email. verify first, then come back.' }, 403)
    const token = makeToken()
    db.prepare('INSERT INTO auth_tokens (token, user_id, created_at) VALUES (?, ?, ?)')
      .run(token, user.id, new Date().toISOString())
    return jsonReply(res, { token, user: { id: user.id, email: user.email, name: user.name } })
  }

  // ── Auth: verify email ──────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname.startsWith('/api/auth/verify/')) {
    const token = url.pathname.split('/').pop()
    const row = db.prepare('SELECT * FROM email_verifications WHERE token = ?').get(token)
    if (!row || new Date(row.expires_at) < new Date()) {
      res.writeHead(302, { Location: 'http://localhost:5274/?verified=expired' })
      return res.end()
    }
    db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(row.user_id)
    db.prepare('DELETE FROM email_verifications WHERE token = ?').run(token)
    res.writeHead(302, { Location: 'http://localhost:5274/?verified=true' })
    return res.end()
  }

  // ── Auth: me ────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    const user = getUserByToken(getTokenFromReq(req))
    if (!user) return jsonReply(res, { error: 'Unauthorized' }, 401)
    return jsonReply(res, { user })
  }

  // ── History ─────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/history') {
    const user = getUserByToken(getTokenFromReq(req))
    if (!user) return jsonReply(res, { error: 'Unauthorized' }, 401)
    const rows = db.prepare(`
      SELECT id, session_name, room_code, template_id, completed_at,
             json_array_length(players) as player_count,
             json_array_length(cards)   as card_count
      FROM sessions WHERE creator_id = ?
      ORDER BY completed_at DESC LIMIT 100
    `).all(user.id)
    return jsonReply(res, rows)
  }

  // ── Session detail ──────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname.startsWith('/api/session/')) {
    const user = getUserByToken(getTokenFromReq(req))
    if (!user) return jsonReply(res, { error: 'Unauthorized' }, 401)
    const id = url.pathname.split('/').pop()
    const row = db.prepare('SELECT * FROM sessions WHERE id = ? AND creator_id = ?').get(id, user.id)
    if (!row) return jsonReply(res, { error: 'Not found' }, 404)
    return jsonReply(res, {
      ...row,
      players: JSON.parse(row.players),
      cards:   JSON.parse(row.cards),
      columns: JSON.parse(row.columns || '[]'),
    })
  }

  // ── Teams: list ─────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/teams') {
    const user = getUserByToken(getTokenFromReq(req))
    if (!user) return jsonReply(res, { error: 'Unauthorized' }, 401)
    const teams = db.prepare('SELECT id, name, created_at FROM teams WHERE owner_id = ? ORDER BY created_at DESC').all(user.id)
    return jsonReply(res, teams)
  }

  // ── Teams: create ───────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/teams') {
    const user = getUserByToken(getTokenFromReq(req))
    if (!user) return jsonReply(res, { error: 'Unauthorized' }, 401)
    const { name } = await readBody(req)
    if (!name?.trim()) return jsonReply(res, { error: 'name required' }, 400)
    const id = makeId()
    db.prepare('INSERT INTO teams (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)').run(id, user.id, name.trim(), new Date().toISOString())
    return jsonReply(res, { id, name: name.trim() })
  }

  // ── Teams: delete member ─────────────────────────────────────────────────────
  {
    const m = url.pathname.match(/^\/api\/teams\/([^/]+)\/members\/([^/]+)$/)
    if (m && req.method === 'DELETE') {
      const user = getUserByToken(getTokenFromReq(req))
      if (!user) return jsonReply(res, { error: 'Unauthorized' }, 401)
      const [, teamId, memberId] = m
      const team = db.prepare('SELECT id FROM teams WHERE id = ? AND owner_id = ?').get(teamId, user.id)
      if (!team) return jsonReply(res, { error: 'Not found' }, 404)
      db.prepare('DELETE FROM team_members WHERE id = ? AND team_id = ?').run(memberId, teamId)
      return jsonReply(res, { ok: true })
    }
  }

  // ── Teams: add member ────────────────────────────────────────────────────────
  {
    const m = url.pathname.match(/^\/api\/teams\/([^/]+)\/members$/)
    if (m && req.method === 'POST') {
      const user = getUserByToken(getTokenFromReq(req))
      if (!user) return jsonReply(res, { error: 'Unauthorized' }, 401)
      const [, teamId] = m
      const team = db.prepare('SELECT id FROM teams WHERE id = ? AND owner_id = ?').get(teamId, user.id)
      if (!team) return jsonReply(res, { error: 'Not found' }, 404)
      const { name, email } = await readBody(req)
      if (!name?.trim() || !email?.trim()) return jsonReply(res, { error: 'name and email required' }, 400)
      const id = makeId()
      db.prepare('INSERT INTO team_members (id, team_id, name, email) VALUES (?, ?, ?, ?)').run(id, teamId, name.trim(), email.trim().toLowerCase())
      return jsonReply(res, { id, name: name.trim(), email: email.trim().toLowerCase() })
    }
  }

  // ── Teams: get one (with members) ────────────────────────────────────────────
  {
    const m = url.pathname.match(/^\/api\/teams\/([^/]+)$/)
    if (m && req.method === 'GET') {
      const user = getUserByToken(getTokenFromReq(req))
      if (!user) return jsonReply(res, { error: 'Unauthorized' }, 401)
      const [, teamId] = m
      const team = db.prepare('SELECT id, name FROM teams WHERE id = ? AND owner_id = ?').get(teamId, user.id)
      if (!team) return jsonReply(res, { error: 'Not found' }, 404)
      const members = db.prepare('SELECT id, name, email FROM team_members WHERE team_id = ?').all(teamId)
      return jsonReply(res, { ...team, members })
    }
  }

  // ── Teams: delete ────────────────────────────────────────────────────────────
  {
    const m = url.pathname.match(/^\/api\/teams\/([^/]+)$/)
    if (m && req.method === 'DELETE') {
      const user = getUserByToken(getTokenFromReq(req))
      if (!user) return jsonReply(res, { error: 'Unauthorized' }, 401)
      const [, teamId] = m
      const team = db.prepare('SELECT id FROM teams WHERE id = ? AND owner_id = ?').get(teamId, user.id)
      if (!team) return jsonReply(res, { error: 'Not found' }, 404)
      db.prepare('DELETE FROM team_members WHERE team_id = ?').run(teamId)
      db.prepare('DELETE FROM teams WHERE id = ?').run(teamId)
      return jsonReply(res, { ok: true })
    }
  }

  // ── Bottle: send ─────────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/bottle') {
    const { roomCode, recipientId, message, senderName } = await readBody(req)
    if (!roomCode || !recipientId || !message?.trim())
      return jsonReply(res, { error: 'roomCode, recipientId and message required' }, 400)
    const room = rooms.get(roomCode.toUpperCase())
    if (!room) return jsonReply(res, { error: 'Room not found' }, 404)
    if (!room.team?.id) return jsonReply(res, { error: 'Room has no team' }, 400)
    const member = db.prepare('SELECT name, email FROM team_members WHERE id = ? AND team_id = ?').get(recipientId, room.team.id)
    if (!member) return jsonReply(res, { error: 'Recipient not found' }, 404)
    try {
      await sendBottleEmail(member.email, member.name, senderName, message.trim(), room.sessionName)
    } catch (e) {
      console.error('bottle email error:', e)
      return jsonReply(res, { error: 'Failed to send email' }, 500)
    }
    return jsonReply(res, { ok: true })
  }

  res.writeHead(404)
  res.end()
})

// ── WebSocket ─────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  let myId   = null
  let myRoom = null

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    if (msg.type === 'create') {
      // Must be authenticated to create a room
      const creator = getUserByToken(msg.token)
      if (!creator) { wsSend(ws, { type: 'error', message: 'Login required to create a room' }); return }
      const code = makeCode()
      myId = makeId()

      // Resolve team if provided
      let team = null
      if (msg.teamId) {
        const teamRow = db.prepare('SELECT id, name FROM teams WHERE id = ? AND owner_id = ?').get(msg.teamId, creator.id)
        if (teamRow) {
          const members = db.prepare('SELECT id, name FROM team_members WHERE team_id = ?').all(teamRow.id)
          team = { id: teamRow.id, name: teamRow.name, members }
        }
      }

      const room = {
        code,
        sessionName: msg.sessionName || 'Retro',
        templateId:  msg.templateId  || '4ls',
        columns:     msg.columns     || [],
        liveMode:    !!msg.liveMode,
        phase: 'lobby',
        facilitatorId: myId,
        creatorId: creator.id,
        players: [{ id: myId, name: msg.name || creator.name, submitted: false, ws }],
        cards: [],
        icebreaker: { question: pickQuestion(), answers: {} },
        music: null,
        team,
      }
      rooms.set(code, room)
      myRoom = room
      wsSend(ws, { type: 'welcome', id: myId, code })
      broadcast(room)
      return
    }

    if (msg.type === 'join') {
      const room = rooms.get(msg.roomCode?.toUpperCase())
      if (!room) { wsSend(ws, { type: 'error', message: 'Room not found' }); return }
      myId = makeId()
      myRoom = room
      room.players.push({ id: myId, name: msg.name || 'Player', submitted: room.phase !== 'lobby' && room.phase !== 'write', ws })
      wsSend(ws, { type: 'welcome', id: myId, code: room.code })
      broadcast(room)
      return
    }

    if (msg.type === 'rejoin') {
      const room = rooms.get(msg.roomCode?.toUpperCase())
      if (!room) { wsSend(ws, { type: 'error', message: 'Room not found' }); return }
      const player = room.players.find(p => p.id === msg.playerId)
      if (!player) { wsSend(ws, { type: 'error', message: 'Session expired' }); return }
      clearTimeout(disconnectTimers.get(msg.playerId))
      disconnectTimers.delete(msg.playerId)
      player.ws = ws
      myId   = player.id
      myRoom = room
      wsSend(ws, { type: 'welcome', id: player.id, code: room.code })
      broadcast(room)
      return
    }

    if (!myRoom || !myId) return

    if (msg.type === 'card') {
      if (myRoom.phase !== 'write') return
      myRoom.cards.push({
        id:         makeId(),
        authorId:   myId,
        authorName: myRoom.players.find(p => p.id === myId)?.name,
        column:     msg.column,
        text:       msg.text?.trim() ?? '',
        gif:        msg.gif     ?? null,
        gifMp4:     msg.gifMp4  ?? null,
        gifTiny:    msg.gifTiny ?? null,
        votes:      [],
      })
      broadcast(myRoom)
      return
    }

    if (msg.type === 'submit') {
      if (myRoom.phase !== 'write') return
      const player = myRoom.players.find(p => p.id === myId)
      if (player) player.submitted = true
      broadcast(myRoom)
      return
    }

    if (msg.type === 'advance') {
      // Bottle phase: anyone can advance themselves (each person decides when done)
      // All other phases: facilitator only
      if (myRoom.phase !== 'bottle' && myRoom.facilitatorId !== myId) return
      const phases = myRoom.liveMode
        ? ['lobby', 'write', 'vote', 'bottle', 'summary']
        : ['lobby', 'write', 'reveal', 'vote', 'bottle', 'summary']
      const idx = phases.indexOf(myRoom.phase)
      if (idx < phases.length - 1) {
        myRoom.phase = phases[idx + 1]
        if (myRoom.phase === 'bottle') saveSession(myRoom)
      }
      broadcast(myRoom)
      return
    }

    if (msg.type === 'vibe') {
      if (!myRoom || myRoom.phase !== 'lobby') return
      const player = myRoom.players.find(p => p.id === myId)
      if (!player) return
      player.emoji    = msg.emoji ?? '👋'
      player.vibeText = (msg.text ?? '').trim().slice(0, 80)
      broadcast(myRoom)
      return
    }

    if (msg.type === 'music') {
      if (!myRoom || myRoom.phase !== 'lobby') return
      myRoom.music = msg.ytId
        ? { ytId: msg.ytId, label: msg.label ?? 'music', icon: msg.icon ?? '🎵' }
        : null
      broadcast(myRoom)
      return
    }

    if (msg.type === 'vote') {
      if (myRoom.phase !== 'vote') return
      const card = myRoom.cards.find(c => c.id === msg.cardId)
      if (!card || card.authorId === myId) return
      const myVotes = myRoom.cards.reduce((n, c) => n + (c.votes.includes(myId) ? 1 : 0), 0)
      if (myVotes >= 3) return
      if (card.votes.includes(myId)) {
        card.votes = card.votes.filter(v => v !== myId)
      } else {
        card.votes.push(myId)
      }
      broadcast(myRoom)
      return
    }
  })

  ws.on('close', () => {
    if (!myRoom || !myId) return
    const timer = setTimeout(() => {
      disconnectTimers.delete(myId)
      myRoom.players = myRoom.players.filter(p => p.id !== myId)
      if (myRoom.players.length === 0) {
        rooms.delete(myRoom.code)
      } else {
        if (myRoom.facilitatorId === myId) myRoom.facilitatorId = myRoom.players[0].id
        broadcast(myRoom)
      }
    }, 60_000)
    disconnectTimers.set(myId, timer)
  })
})

server.listen(PORT, () => {
  console.log(`Retro server :${PORT}  db: retro.db`)
})
