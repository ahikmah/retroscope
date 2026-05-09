<script>
  import { page, currentUser } from '../store.js'
  import { setToken } from '../ws.js'

  export let returnTo = 'home'

  let mode = 'login'   // 'login' | 'register'
  let email    = ''
  let password = ''
  let name     = ''
  let error    = ''
  let loading  = false
  let pendingVerify = false

  async function submit() {
    error = ''
    if (!email.trim() || !password.trim()) { error = 'fill in all the fields. please.'; return }
    if (mode === 'register' && !name.trim()) { error = 'we need something to call you.'; return }
    loading = true
    try {
      const body = mode === 'register'
        ? { email: email.trim(), password, name: name.trim() }
        : { email: email.trim(), password }
      const res  = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { error = data.error || 'something went wrong. shocking.'; loading = false; return }
      if (mode === 'register') { pendingVerify = true; loading = false; return }
      setToken(data.token)
      currentUser.set(data.user)
      page.set(returnTo)
    } catch {
      error = 'server said no. try again.'
      loading = false
    }
  }

  function handleKey(e) { if (e.key === 'Enter') submit() }
</script>

<div class="flex items-center justify-center min-h-[75vh] slide-up">
  <div class="w-full max-w-sm">

    <!-- Back -->
    <button on:click={() => page.set('home')}
      class="btn inline-flex items-center gap-1.5 text-white/30 hover:text-white/70 transition text-sm font-semibold mb-8 group">
      <svg class="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
      </svg>
      Back
    </button>

    {#if pendingVerify}
      <div class="text-center space-y-4 py-8">
        <div class="w-14 h-14 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mx-auto">
          <svg class="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
        </div>
        <h2 class="text-2xl font-black">check your email.</h2>
        <p class="text-white/30 text-sm">we sent a verification link to <span class="text-white/60 font-semibold">{email}</span>.</p>
        <p class="text-white/20 text-xs">click it, then come back and sign in.</p>
      </div>
    {:else}

    <h2 class="text-3xl font-black tracking-tight mb-1">
      {mode === 'login' ? 'welcome back.' : 'join the suffering.'}
    </h2>
    <p class="text-sm text-white/25 mb-8">
      {mode === 'login' ? 'your retros await. all of them.' : 'create an account to host retros.'}
    </p>

    <div class="space-y-3">
      {#if mode === 'register'}
        <input bind:value={name} on:keydown={handleKey}
          placeholder="a name. any name."
          class="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-3 outline-none font-semibold text-sm transition placeholder:text-white/20" />
      {/if}

      <input bind:value={email} on:keydown={handleKey}
        type="email" placeholder="your actual email. this one we check."
        class="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-3 outline-none font-semibold text-sm transition placeholder:text-white/20" />

      <input bind:value={password} on:keydown={handleKey}
        type="password" placeholder="password"
        class="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-3 outline-none font-semibold text-sm transition placeholder:text-white/20" />

      {#if error}
        <p class="text-xs text-red-400/80 font-semibold px-1">{error}</p>
      {/if}

      <button on:click={submit} disabled={loading}
        class="btn w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-black py-3 rounded-xl transition">
        {loading ? 'working on it…' : mode === 'login' ? 'sign in.' : 'create account.'}
      </button>
    </div>

    <p class="text-center text-xs text-white/25 mt-6">
      {mode === 'login' ? "don't have an account?" : 'already suffering?'}
      <button on:click={() => { mode = mode === 'login' ? 'register' : 'login'; error = '' }}
        class="btn text-indigo-400 hover:text-indigo-300 font-semibold ml-1 transition">
        {mode === 'login' ? 'register.' : 'sign in.'}
      </button>
    </p>

    {/if}
  </div>
</div>
