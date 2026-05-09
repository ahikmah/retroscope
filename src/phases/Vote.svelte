<script>
  import { flip } from 'svelte/animate'
  import { send } from '../ws.js'
  import { room, myId, myVoteCount, isFacilitator } from '../store.js'
  import { cardRotation, gridClass } from '../config.js'

  $: columns = $room?.columns ?? []
  $: cardsByCol = Object.fromEntries(
    columns.map(c => [
      c.id,
      ($room?.cards.filter(card => card.column === c.id) ?? [])
        .sort((a, b) => b.votes.length - a.votes.length)
    ])
  )
  $: remaining = 3 - $myVoteCount

  let flashing = new Set()
  let shaking = false

  function vote(card) {
    if (card.authorId === $myId) return
    if (!hasVoted(card) && remaining === 0) {
      shaking = true; setTimeout(() => shaking = false, 400); return
    }
    send({ type: 'vote', cardId: card.id })
    flashing = new Set([...flashing, card.id])
    setTimeout(() => { flashing.delete(card.id); flashing = flashing }, 550)
  }

  function hasVoted(card) { return card.votes.includes($myId) }
  function isOwn(card)    { return card.authorId === $myId }
</script>

<div class="-mx-5 px-5 py-5 board-bg min-h-screen rounded-2xl slide-up" style="margin-top:-20px">

  <!-- Vote HUD -->
  <div class="flex items-center justify-between mb-6 px-1 py-3 bg-white/[0.04] rounded-2xl px-4"
    class:shake={shaking}
    style="box-shadow: 0 0 0 1px rgba(255,255,255,0.07)">
    <div class="flex items-center gap-3">
      <span class="text-sm text-white/50 font-semibold">your votes</span>
      <div class="flex gap-1.5">
        {#each Array(3) as _, i}
          <span class="w-2.5 h-2.5 rounded-full transition-all duration-300
            {i < remaining ? 'bg-indigo-400 scale-100' : 'bg-white/10 scale-75'}"></span>
        {/each}
      </div>
      <span class="text-sm font-black tabular-nums text-white/60">
        {#key remaining}
          <span class="num-up">
            {remaining > 0 ? `${remaining} left` : 'all spent'}
          </span>
        {/key}
      </span>
    </div>
    {#if $isFacilitator}
      <button on:click={() => send({ type: 'advance' })}
        class="btn bg-indigo-600 hover:bg-indigo-500 text-white font-black px-5 py-1.5 rounded-lg transition text-sm">
        that's enough democracy
      </button>
    {/if}
  </div>

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
            <span class="text-xs font-mono tabular-nums" style="color:{col.accent}80">{cardsByCol[col.id].length}</span>
          </div>

          <!-- Cards -->
          {#each cardsByCol[col.id] as card (card.id)}
            <div
              animate:flip={{ duration: 320, easing: t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t }}
              role="button" tabindex="0"
              class="sticky {col.note} rounded-xl overflow-hidden select-none transition-all duration-150
                {flashing.has(card.id) ? 'voted-flash' : ''}
                {isOwn(card) ? 'opacity-60 cursor-default' : 'cursor-pointer hover:-translate-y-1 hover:scale-[1.02] hover:rotate-0 hover:shadow-xl hover:z-10'}"
              style="--r:{cardRotation(card.id)}deg; transform: rotate({cardRotation(card.id)}deg)"
              on:click={() => vote(card)}
              on:keydown={(e) => e.key === 'Enter' && vote(card)}
            >
              {#if card.gif || card.gifTiny}
                <img src={card.gifTiny || card.gif} alt="" class="w-full" loading="eager" />
              {/if}
              {#if card.text}
                <p class="px-3.5 py-3 font-hand text-[22px] leading-snug whitespace-pre-wrap">{card.text}</p>
              {/if}
              <div class="px-3.5 pb-3 flex items-center justify-between font-sans">
                <span class="text-[10px] font-bold opacity-40">{card.authorName}</span>
                <span class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all duration-200
                  {hasVoted(card) ? 'bg-indigo-600 text-white scale-110' : 'bg-black/15 text-current'}
                  {isOwn(card) ? 'opacity-25' : 'hover:bg-black/25'}">
                  ↑ {#key card.votes.length}<span class="num-up">{card.votes.length}</span>{/key}
                </span>
              </div>
            </div>
          {/each}

          {#if cardsByCol[col.id].length === 0}
            <p class="text-xs text-white/15 italic text-center py-6">nobody cared enough</p>
          {/if}
        </div>
      </div>
    {/each}
  </div>

</div>
