<script>
  import { onMount } from 'svelte'
  import { page, selectedSessionId, currentUser } from '../store.js'
  import { getToken } from '../ws.js'
  import { TEMPLATES } from '../config.js'

  let sessions = []
  let detail = null
  let loading = true

  onMount(async () => {
    const token = getToken()
    if (!token) { loading = false; return }
    const res = await fetch('/api/history', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) { loading = false; return }
    sessions = await res.json()
    loading = false
  })

  async function openSession(id) {
    detail = null
    selectedSessionId.set(id)
    const res = await fetch(`/api/session/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    detail = await res.json()
  }

  function back() { detail = null; selectedSessionId.set(null) }

  function formatDate(iso) {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  $: detailColumns = detail?.columns?.length
    ? detail.columns
    : (TEMPLATES.find(t => t.id === detail?.template_id) ?? TEMPLATES[0]).columns

  $: topByCol = detail ? Object.fromEntries(
    detailColumns.map(c => [
      c.id,
      detail.cards
        .filter(card => card.column === c.id)
        .sort((a, b) => b.votes.length - a.votes.length)
        .slice(0, 3)
    ])
  ) : {}

  function copyMarkdown() {
    if (!detail) return
    const md = [
      `# ${detail.session_name}`,
      `_${formatDate(detail.completed_at)} · ${detail.players.length} players_\n`,
      ...detailColumns.map(col => {
        const cards = topByCol[col.id]
        if (!cards.length) return ''
        return [`## ${col.label}`,
          ...cards.map((c, i) => `${i + 1}. **${c.text}** — ${c.votes.length} votes (${c.authorName})`)
        ].join('\n')
      }),
    ].filter(Boolean).join('\n\n')
    navigator.clipboard.writeText(md)
    copied = true; setTimeout(() => copied = false, 2000)
  }

  let copied = false
</script>

<div class="space-y-5">
  <div class="flex items-center gap-4">
    <button on:click={() => page.set('home')}
      class="text-white/25 hover:text-white/60 transition text-sm">← Back</button>
    <div>
      <h2 class="text-lg font-black">evidence of past efforts</h2>
      <p class="text-xs text-white/25">at least you showed up</p>
    </div>
  </div>

  {#if detail}
    <div class="space-y-6">
      <!-- Session header -->
      <div class="flex items-start justify-between">
        <div>
          <h2 class="text-2xl font-black text-white">{detail.session_name}</h2>
          <p class="text-xs text-white/30 mt-1">
            {formatDate(detail.completed_at)} · {detail.players.length} participants · {detail.cards.length} cards
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button on:click={copyMarkdown}
            class="btn text-xs font-bold bg-white/5 hover:bg-white/10 text-white/50 hover:text-white px-4 py-2 rounded-xl transition">
            {copied ? 'copied.' : 'copy md'}
          </button>
          <button on:click={back}
            class="btn text-xs font-bold bg-white/5 hover:bg-white/10 text-white/50 hover:text-white px-4 py-2 rounded-xl transition">
            ← back
          </button>
        </div>
      </div>

      <!-- Columns -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {#each detailColumns as col}
          {@const colCards = detail.cards.filter(c => c.column === col.id).sort((a,b) => b.votes.length - a.votes.length)}
          <div class="flex rounded-2xl overflow-hidden bg-white/[0.04]" style="box-shadow: 0 0 0 1px rgba(255,255,255,0.07)">

            <!-- Left accent stripe -->
            <div class="w-[3px] shrink-0" style="background:{col.accent}50"></div>

            <!-- Body -->
            <div class="flex-1 flex flex-col min-w-0 p-4 gap-3">
              <!-- Header -->
              <div class="flex items-center justify-between">
                <span class="font-black text-sm text-white/90">{col.label}</span>
                <span class="text-xs font-mono tabular-nums" style="color:{col.accent}80">{colCards.length}</span>
              </div>

              <!-- Cards -->
              {#each colCards as card, i}
                <div class="{col.note} rounded-xl overflow-hidden font-hand text-[22px] leading-snug relative
                  {i === 0 && card.votes.length > 0 ? 'ring-2 ring-yellow-400/60' : ''}">
                  {#if i === 0 && card.votes.length > 0}
                    <span class="absolute top-2 right-2 text-xs bg-yellow-400 text-yellow-900 font-black px-2.5 py-1 rounded-full shadow-md z-10">top</span>
                  {/if}
                  {#if card.gif}
                    <img src={card.gifTiny ?? card.gif} alt="" class="w-full rounded-t-xl" />
                  {/if}
                  <div class="px-4 pt-3 pb-3">
                    {#if card.text}
                      <p class="mb-3 whitespace-pre-wrap">{card.text}</p>
                    {/if}
                    <div class="flex justify-between font-sans text-xs" style="opacity:0.45">
                      <span class="font-semibold">{card.authorName}</span>
                      {#if card.votes.length > 0}
                        <span class="font-black">↑ {card.votes.length}</span>
                      {:else}
                        <span>—</span>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}

              {#if colCards.length === 0}
                <p class="text-xs text-white/15 italic py-6 text-center">silence speaks volumes</p>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>

  {:else}
    {#if loading}
      <p class="text-white/20 text-sm">digging through the archives…</p>
    {:else if !$currentUser}
      <div class="text-center py-24 space-y-3">
        <p class="font-black text-white/20 text-lg">who are you, exactly?</p>
        <p class="text-white/10 text-sm">sign in to see your retro history.</p>
        <button on:click={() => page.set('auth')}
          class="btn mt-2 text-xs text-indigo-400/60 hover:text-indigo-300 transition font-semibold">
          sign in →
        </button>
      </div>
    {:else if sessions.length === 0}
      <div class="text-center py-24 space-y-2">
        <p class="font-black text-white/20 text-lg">nothing here yet.</p>
        <p class="text-white/10 text-sm">go do a retro. i'll wait.</p>
      </div>
    {:else}
      <div class="space-y-2">
        {#each sessions as s, i}
          <button on:click={() => openSession(s.id)}
            class="btn w-full text-left rounded-2xl transition-all duration-200 group
              bg-white/[0.04] hover:bg-white/[0.07]">
            <div class="flex items-stretch">
              <!-- Accent stripe -->
              <div class="w-1 shrink-0 rounded-l-2xl"
                style="background: {TEMPLATES.find(t => t.id === s.template_id)?.columns?.[0]?.accent ?? '#6366f1'}"></div>

              <div class="flex-1 flex items-center justify-between px-5 py-4">
                <div class="space-y-1">
                  <p class="font-black text-base group-hover:text-white transition text-white/80">{s.session_name}</p>
                  <p class="text-xs text-white/25">{formatDate(s.completed_at)}</p>
                </div>
                <div class="flex items-center gap-2 text-xs">
                  {#if s.template_id}
                    <span class="font-semibold px-2.5 py-1 rounded-lg bg-white/6 text-white/40">
                      {TEMPLATES.find(t => t.id === s.template_id)?.name ?? s.template_id}
                    </span>
                  {/if}
                  <span class="px-2.5 py-1 rounded-lg bg-white/4 text-white/30">{s.player_count}p</span>
                  <span class="px-2.5 py-1 rounded-lg bg-white/4 text-white/30">{s.card_count} cards</span>
                  <span class="text-white/20 group-hover:text-white/60 transition ml-1">→</span>
                </div>
              </div>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>
