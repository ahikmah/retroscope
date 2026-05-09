import { WS_URL } from './config.js'
import { room, myId } from './store.js'

const SESSION_KEY = 'retro_session'
let ws = null

export function saveSession(id, roomCode, name) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, roomCode, name }))
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) } catch { return null }
}

export function connect(onWelcome) {
  ws = new WebSocket(WS_URL)

  ws.onopen = () => {
    const session = loadSession()
    if (session) {
      ws.send(JSON.stringify({ type: 'rejoin', roomCode: session.roomCode, playerId: session.id }))
    }
  }

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    if (msg.type === 'state')   room.set(msg.room)
    if (msg.type === 'welcome') {
      myId.set(msg.id)
      // Persist room code in localStorage so history is scoped per device
      if (msg.code) {
        try {
          const codes = JSON.parse(localStorage.getItem('retro_rooms') || '[]')
          if (!codes.includes(msg.code)) {
            codes.push(msg.code)
            localStorage.setItem('retro_rooms', JSON.stringify(codes))
          }
        } catch {}
      }
      onWelcome?.(msg)
    }
    if (msg.type === 'error') {
      // Rejoin failed — clear stale session
      clearSession()
      room.set(null)
      alert(msg.message)
    }
  }

  ws.onclose = () => {
    setTimeout(() => connect(onWelcome), 2000)
  }

  return ws
}

export function send(payload) {
  if (ws?.readyState === WebSocket.OPEN) {
    // Automatically attach auth token to 'create' messages
    if (payload.type === 'create') {
      payload = { ...payload, token: localStorage.getItem('retro_token') }
    }
    ws.send(JSON.stringify(payload))
  }
}

export function getToken()  { return localStorage.getItem('retro_token') }
export function setToken(t) { localStorage.setItem('retro_token', t) }
export function removeToken() { localStorage.removeItem('retro_token') }
