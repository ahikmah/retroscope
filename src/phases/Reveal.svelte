<script>
  import { onMount } from 'svelte'
  import { send } from '../ws.js'
  import { room, isFacilitator } from '../store.js'
  import { cardRotation, gridClass } from '../config.js'

  $: columns = $room?.columns ?? []

  let countdown = 3
  let revealing = false
  let confirmVote = false
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  onMount(async () => {
    for (let i = 3; i >= 1; i--) { countdown = i; await sleep(750) }
    countdown = null
    revealing = true
  })

  $: cardsByCol = Object.fromEntries(
    columns.map(c => [c.id, $room?.cards.filter(card => card.column === c.id) ?? []])
  )
</script>

{#if confirmVote}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="bg-[#111118] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl slide-up">
      <p class="font-black text-lg text-white mb-1">start voting?</p>
      <p class="text-white/40 text-sm mb-5">
        everyone's had a chance to read the cards?<br/>
        <span class="text-white/25 text-xs">this can't be undone.</span>
      </p>
      <div class="flex gap-2">
        <button on:click={() => confirmVote = false}
          class="btn flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white font-bold py-2.5 rounded-xl transition text-sm">
          not yet
        </button>
        <button on:click={() => { confirmVote = false; send({ type: 'advance' }) }}
          class="btn flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2.5 rounded-xl transition text-sm">
          let's vote
        </button>
      </div>
    </div>
  </div>
{/if}

{#if countdown !== null}
  <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
    {#key countdown}
      <span class="countdown-pop text-[10rem] font-black text-white/80 select-none">{countdown}</span>
    {/key}
  </div>
{/if}

<div class="-mx-5 px-5 py-5 board-bg min-h-screen rounded-2xl slide-up" style="margin-top:-20px">

  <!-- HUD -->
  <div class="flex items-center justify-between mb-6 px-1">
    <p class="text-sm text-white/30">
      {$room?.cards.length ?? 0} cards. read them. discuss. don't panic.
    </p>
    {#if $isFacilitator}
      <button on:click={() => confirmVote = true}
        class="btn bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-2 rounded-xl transition text-sm">
        start the democracy
      </button>
    {/if}
  </div>

  {#if revealing}
    <div class="grid grid-cols-1 {gridClass(columns.length)} gap-4 items-start">
      {#each columns as col, ci}
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
            {#each cardsByCol[col.id] as card, i}
              <div class="sticky flip-drop {col.note} rounded-xl overflow-hidden"
                style="--r:{cardRotation(card.id)}deg; animation-delay:{(ci * 4 + i) * 65}ms">
                {#if card.gif || card.gifTiny}
                  <img src={card.gifTiny || card.gif} alt="" class="w-full" loading="eager" />
                {/if}
                {#if card.text}
                  <p class="px-3.5 py-3 font-hand text-[22px] leading-snug whitespace-pre-wrap">{card.text}</p>
                {/if}
                <div class="px-3.5 pb-2.5 font-sans text-[10px] font-bold opacity-40">{card.authorName}</div>
              </div>
            {/each}

            {#if cardsByCol[col.id].length === 0}
              <p class="text-xs text-white/15 italic text-center py-6">either perfect or in denial</p>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="flex items-center justify-center h-64">
      <p class="text-white/20 text-sm font-semibold tracking-widest uppercase">brace yourself…</p>
    </div>
  {/if}

</div>
