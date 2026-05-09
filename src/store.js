import { writable, derived } from 'svelte/store'

export const room        = writable(null)
export const myId        = writable(null)
export const myName      = writable('')
export const page        = writable('home') // 'home' | 'history' | 'auth'
export const currentUser = writable(null)   // { id, email, name } or null
export const selectedSessionId = writable(null)

export const isFacilitator = derived(
  [room, myId],
  ([$room, $myId]) => $room?.facilitatorId === $myId
)

export const myVoteCount = derived(
  [room, myId],
  ([$room, $myId]) =>
    $room?.cards.reduce((n, c) => n + (c.votes.includes($myId) ? 1 : 0), 0) ?? 0
)
