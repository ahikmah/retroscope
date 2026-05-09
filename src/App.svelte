<script>
  import { onMount } from 'svelte'
  import { connect, saveSession, getToken, removeToken } from './ws.js'
  import { room, myId, myName, page, currentUser } from './store.js'
  import Lobby   from './phases/Lobby.svelte'
  import Write   from './phases/Write.svelte'
  import Reveal  from './phases/Reveal.svelte'
  import Vote    from './phases/Vote.svelte'
  import Bottle  from './phases/Bottle.svelte'
  import Summary from './phases/Summary.svelte'
  import History from './pages/History.svelte'
  import Auth    from './pages/Auth.svelte'
  import Teams   from './pages/Teams.svelte'
  import Loading from './components/Loading.svelte'

  const PHASES = ['lobby', 'write', 'reveal', 'vote', 'bottle', 'summary']
  let ready = false
  let toast = ''
  let menuOpen = false

  function toggleMenu() { menuOpen = !menuOpen }
  function closeMenu() { menuOpen = false }

  let logoRotate = 0
  function onLogoMove(e) {
    const r = e.currentTarget.getBoundingClientRect()
    const offset = (e.clientX - (r.left + r.width / 2)) / r.width
    logoRotate = offset * 14
  }
  function onLogoLeave() { logoRotate = 0 }

  onMount(async () => {
    // Minimum display time so all letters finish falling
    const minDelay = new Promise(r => setTimeout(r, 1600))

    // Restore user session from token
    const token = getToken()
    if (token) {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          currentUser.set(data.user)
        } else {
          removeToken()
        }
      } catch {}
    }

    connect((welcome) => {
      saveSession(welcome.id, welcome.code, sessionStorage.getItem('retro_name') ?? '')
    })

    await minDelay
    ready = true

    const params = new URLSearchParams(location.search)
    if (params.get('verified') === 'true') {
      toast = 'email verified. welcome to the suffering.'
      setTimeout(() => toast = '', 4000)
      history.replaceState({}, '', '/')
    } else if (params.get('verified') === 'expired') {
      toast = 'link expired. try registering again.'
      setTimeout(() => toast = '', 4000)
      history.replaceState({}, '', '/')
    }
  })

  function logout() {
    removeToken()
    currentUser.set(null)
    page.set('home')
  }
</script>

{#if !ready}
  <Loading />
{/if}

{#if toast}
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/10 backdrop-blur border border-white/15 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl slide-up">
    {toast}
  </div>
{/if}

<div class="max-w-7xl mx-auto px-5 py-5" class:opacity-0={!ready} class:pointer-events-none={!ready}>
  <header class="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
    <button
      on:click={() => page.set('home')}
      on:mousemove={onLogoMove}
      on:mouseleave={onLogoLeave}
      style="transform: rotate({logoRotate}deg); transition: transform 0.12s ease"
      class="logo-brand text-base font-black tracking-tight inline-block">
      {$room?.sessionName ?? 'Retroscope'}
    </button>

    <div class="flex items-center gap-4 text-sm">
      {#if $room && $page !== 'history' && $page !== 'auth'}
        <div class="hidden md:flex items-center gap-1">
          {#each PHASES as p, i}
            <span class="px-2.5 py-1 rounded-lg font-semibold capitalize transition-all
              {$room.phase === p
                ? 'bg-white/10 text-white'
                : PHASES.indexOf($room.phase) > i
                  ? 'text-white/25 line-through'
                  : 'text-white/20'}">
              {p}
            </span>
            {#if i < PHASES.length - 1}
              <span class="text-white/15">›</span>
            {/if}
          {/each}
        </div>
        <span class="font-mono font-bold bg-white/5 border border-white/10 text-indigo-300 px-3 py-1 rounded-lg tracking-widest text-xs">
          {$room.code}
        </span>
        <span class="text-white/30 text-xs">{$room.players.length}p</span>
      {/if}

      {#if $currentUser}
        <div class="relative">
          <!-- Avatar trigger -->
          <button on:click={toggleMenu}
            class="btn w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 transition flex items-center justify-center font-black text-sm text-white select-none">
            {$currentUser.name[0].toUpperCase()}
          </button>

          <!-- Dropdown -->
          {#if menuOpen}
            <!-- Backdrop -->
            <button class="fixed inset-0 z-40" on:click={closeMenu} tabindex="-1" aria-label="close menu"></button>

            <div class="absolute right-0 top-10 z-50 w-48 bg-[#111118] border border-white/10 rounded-2xl shadow-2xl overflow-hidden slide-up">
              <!-- User info -->
              <div class="px-4 py-3 border-b border-white/8">
                <p class="text-xs font-black text-white truncate">{$currentUser.name}</p>
                <p class="text-[11px] text-white/30 truncate mt-0.5">{$currentUser.email}</p>
              </div>

              <!-- Actions -->
              <div class="p-1.5 space-y-0.5">
                <button on:click={() => { page.set($page === 'history' ? 'home' : 'history'); closeMenu() }}
                  class="btn w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition
                    {$page === 'history' ? 'text-white bg-white/8' : 'text-white/60 hover:text-white hover:bg-white/6'}">
                  {$page === 'history' ? '← back' : 'History'}
                </button>
                <button on:click={() => { page.set($page === 'teams' ? 'home' : 'teams'); closeMenu() }}
                  class="btn w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition
                    {$page === 'teams' ? 'text-white bg-white/8' : 'text-white/60 hover:text-white hover:bg-white/6'}">
                  {$page === 'teams' ? '← back' : 'Teams'}
                </button>
                <button on:click={() => { logout(); closeMenu() }}
                  class="btn w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-white/40 hover:text-red-400 hover:bg-red-500/8 transition">
                  Sign out
                </button>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <button on:click={() => page.set('auth')}
          class="btn text-xs font-bold px-4 py-1.5 rounded-lg border border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20 text-white/50 hover:text-white transition">
          sign in
        </button>
      {/if}
    </div>
  </header>

  {#if $page === 'auth'}
    <Auth />
  {:else if $page === 'history'}
    <History />
  {:else if $page === 'teams'}
    <Teams />
  {:else if !$room || $room.phase === 'lobby'}
    <Lobby />
  {:else if $room.phase === 'write'}
    <Write />
  {:else if $room.phase === 'reveal'}
    <Reveal />
  {:else if $room.phase === 'vote'}
    <Vote />
  {:else if $room.phase === 'bottle'}
    <Bottle />
  {:else if $room.phase === 'summary'}
    <Summary />
  {/if}
</div>

<style>
  .logo-brand {
    background: linear-gradient(
      90deg,
      #ffffff 0%,
      #a5b4fc 20%,
      #e879f9 38%,
      #ffffff 50%,
      #a5b4fc 65%,
      #e879f9 80%,
      #ffffff 100%
    );
    background-size: 250% auto;
    background-position: 0% center;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .logo-brand:hover {
    animation: shimmer 2.5s linear infinite;
  }

  @keyframes shimmer {
    0%   { background-position: 200% center; }
    100% { background-position: -200% center; }
  }
</style>
