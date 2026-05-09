<script>
  import { onMount } from 'svelte'
  import { room, myId, page } from '../store.js'
  import { cardRotation, gridClass } from '../config.js'
  import { clearSession } from '../ws.js'

  function goHome() {
    clearSession()
    room.set(null)
    myId.set(null)
    page.set('home')
  }

  function goHistory() {
    clearSession()
    room.set(null)
    myId.set(null)
    page.set('history')
  }

  $: columns = $room?.columns ?? []
  $: topByCol = Object.fromEntries(
    columns.map(c => [
      c.id,
      ($room?.cards.filter(card => card.column === c.id) ?? [])
        .sort((a, b) => b.votes.length - a.votes.length)
        .slice(0, 3)
    ])
  )

  $: markdown = [
    `# ${$room?.sessionName ?? 'Retro'}\n`,
    ...columns.map(col => {
      const cards = topByCol[col.id]
      if (!cards.length) return ''
      return [
        `## ${col.label}`,
        ...cards.map((c, i) => `${i + 1}. **${c.text}** — ${c.votes.length} votes (${c.authorName})`),
      ].join('\n')
    }),
  ].filter(Boolean).join('\n\n')

  let copied = false
  function copy() {
    navigator.clipboard.writeText(markdown)
    copied = true
    setTimeout(() => copied = false, 2500)
  }

  // rank badge classes — top card gets gold ring
  const rankRing = ['ring-2 ring-yellow-400/60', 'ring-1 ring-white/20', 'ring-1 ring-white/10']

  let pieces = []
  onMount(() => {
    pieces = Array.from({ length: 28 }, (_, i) => ({
      id: i, left: Math.random() * 100,
      dur: 2.5 + Math.random() * 1.5, delay: Math.random() * 1.2,
      color: ['#6366f1','#8b5cf6','#a78bfa','#c084fc','#818cf8'][i % 5],
      size: 5 + Math.floor(Math.random() * 6),
    }))
  })
</script>

<div class="fixed inset-0 pointer-events-none overflow-hidden">
  {#each pieces as p (p.id)}
    <div class="confetti-piece absolute rounded-sm opacity-80"
      style="left:{p.left}%;top:-12px;width:{p.size}px;height:{p.size}px;background:{p.color};--dur:{p.dur}s;--delay:{p.delay}s">
    </div>
  {/each}
</div>

<div class="relative z-10 slide-up">

  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-xl font-black">{$room?.sessionName}</h2>
      <p class="text-sm text-white/25 mt-0.5">and nothing will change. probably. but good effort.</p>
    </div>
    <button on:click={copy}
      class="btn bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-bold px-5 py-2 rounded-xl transition">
      {copied ? 'copied. now paste it somewhere important.' : 'copy for the doc nobody opens'}
    </button>
  </div>

  <!-- Board -->
  <div class="-mx-5 px-5 py-5 board-bg rounded-2xl mb-6" style="margin-top:-4px">
    <div class="grid grid-cols-1 {gridClass(columns.length)} gap-4 items-start">
      {#each columns as col}
        <div class="flex rounded-2xl overflow-hidden bg-white/[0.04]"
          style="box-shadow: 0 0 0 1px rgba(255,255,255,0.07)">

          <!-- Left accent stripe -->
          <div class="w-[3px] shrink-0" style="background:{col.accent}50"></div>

          <!-- Body -->
          <div class="flex-1 flex flex-col min-w-0 p-4 gap-3">
            <!-- Header -->
            <div class="flex items-center justify-between">
              <span class="font-black text-sm text-white/90">{col.label}</span>
              <span class="text-xs font-mono tabular-nums" style="color:{col.accent}80">{topByCol[col.id].length}</span>
            </div>

            <!-- Top cards -->
            {#each topByCol[col.id] as card, i}
              <div class="sticky pop-in {col.note} rounded-xl overflow-hidden relative {rankRing[i]}"
                style="--r:{cardRotation(card.id)}deg; transform: rotate({cardRotation(card.id)}deg); animation-delay:{i * 100}ms">
                {#if i === 0 && card.votes.length > 0}
                  <span class="absolute top-2 right-2 text-xs bg-yellow-400 text-yellow-900 font-black px-2.5 py-1 rounded-full shadow-md z-10">top</span>
                {/if}
                {#if card.gif || card.gifTiny}
                  <img src={card.gifTiny || card.gif} alt="" class="w-full" loading="eager" />
                {/if}
                {#if card.text}
                  <p class="px-3.5 py-3 font-hand text-[22px] leading-snug whitespace-pre-wrap">{card.text}</p>
                {/if}
                <div class="px-3.5 pb-3 flex items-center justify-between font-sans text-[10px]">
                  <span class="font-bold opacity-40">{card.authorName}</span>
                  {#if card.votes.length > 0}
                    <span class="font-black opacity-50">↑ {card.votes.length}</span>
                  {:else}
                    <span class="opacity-20">—</span>
                  {/if}
                </div>
              </div>
            {/each}

            {#if topByCol[col.id].length === 0}
              <p class="text-xs text-white/15 italic text-center py-6">collective silence. bold choice.</p>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Markdown export -->
  <details class="group rounded-2xl overflow-hidden bg-white/[0.04] mb-6"
    style="box-shadow: 0 0 0 1px rgba(255,255,255,0.07)">
    <summary class="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none list-none
      text-white/30 hover:text-white/60 hover:bg-white/[0.03] transition-all">
      <div class="flex items-center gap-2">
        <svg class="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <span class="text-xs font-semibold">markdown export</span>
        <span class="text-[10px] text-white/15">for the meeting notes nobody reads</span>
      </div>
      <svg class="w-3.5 h-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
      </svg>
    </summary>
    <div class="border-t border-white/5 px-5 py-4">
      <pre class="text-xs text-white/35 whitespace-pre-wrap font-mono leading-relaxed">{markdown}</pre>
    </div>
  </details>

  <!-- Exit -->
  <div class="flex items-center justify-center gap-3 pt-4 border-t border-white/5">
    <button on:click={goHistory}
      class="btn bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white font-bold px-6 py-2.5 rounded-xl transition text-sm">
      view history
    </button>
    <button on:click={goHome}
      class="btn bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 py-2.5 rounded-xl transition text-sm">
      start a new one →
    </button>
  </div>

</div>
