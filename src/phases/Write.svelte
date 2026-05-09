<script>
  import { send } from '../ws.js'
  import { room, myId, isFacilitator } from '../store.js'
  import { cardRotation, gridClass } from '../config.js'

  const PAPER = {
    'note-liked':   '#d1fae5',
    'note-learned': '#dbeafe',
    'note-lacked':  '#ffedd5',
    'note-longed':  '#ede9fe',
  }
  function paper(col) { return PAPER[col.note] ?? col.paper ?? '#f3f4f6' }

  $: columns = $room?.columns ?? []
  $: drafts = Object.fromEntries(columns.map(c => [c.id, drafts?.[c.id] ?? '']))
  let localCards = {}
  let focused = null
  let scores = {}
  let newCardId = null
  let confirmReveal = false
  let colFlash = {}

  function focusCol(colId) {
    const ta = document.querySelector(`[data-col="${colId}"]`)
    if (ta) ta.focus()
  }

  $: notSubmitted = $room?.players.filter(p => !p.submitted).length ?? 0

  function tryAdvance() {
    if (notSubmitted > 0) { confirmReveal = true } else { send({ type: 'advance' }) }
  }

  $: liveMode = $room?.liveMode ?? false
  $: me = $room?.players.find(p => p.id === $myId)
  $: submitted = me?.submitted ?? false
  $: submitCount = $room?.players.filter(p => p.submitted).length ?? 0
  $: total = $room?.players.length ?? 1
  $: pct = Math.round((submitCount / total) * 100)
  $: totalCards = liveMode
    ? ($room?.cards?.length ?? 0)
    : Object.values(localCards).flat().length
  // In live mode, display cards come from room state (everyone's cards visible)
  $: liveCardsByCol = liveMode
    ? Object.fromEntries(columns.map(c => [c.id, $room?.cards.filter(card => card.column === c.id) ?? []]))
    : {}

  const slowPhrases = [
    "still thinking…", "probably writing an essay…",
    "having an existential moment…", "pretending to be busy…",
  ]

  function autoResize(node) {
    const resize = () => { node.style.height = 'auto'; node.style.height = node.scrollHeight + 'px' }
    node.addEventListener('input', resize)
    return { destroy() { node.removeEventListener('input', resize) } }
  }

  function spawnScore(colId) {
    const id = Math.random().toString(36).slice(2)
    scores[colId] = [...(scores[colId] ?? []), { id }]
    scores = scores
    colFlash[colId] = true
    colFlash = colFlash
    setTimeout(() => {
      scores[colId] = (scores[colId] ?? []).filter(s => s.id !== id)
      scores = scores
    }, 700)
    setTimeout(() => {
      colFlash[colId] = false
      colFlash = colFlash
    }, 350)
  }

  // GIF state — flat, no nested objects
  let gifOpen      = {}
  let gifQuery     = {}
  let gifResults   = {}
  let gifLoading   = {}
  let gifUrl       = {}   // full gif URL (stored in card, fallback)
  let gifMp4Url    = {}   // mp4 URL (stored in card, smooth playback)
  let gifPreview   = {}   // tinygif URL (fast — used in input preview + board display)

  function addCard(colId) {
    const text   = (drafts[colId] ?? '').trim()
    const gif     = gifUrl[colId]     ?? null
    const gifMp4  = gifMp4Url[colId]  ?? null
    const gifTiny = gifPreview[colId] ?? null
    if (!text && !gif) return
    const tempId = Math.random().toString(36).slice(2)
    localCards[colId] = [...(localCards[colId] ?? []), { id: tempId, text, gif, gifMp4, gifTiny }]
    localCards = localCards
    newCardId = tempId
    spawnScore(colId)
    send({ type: 'card', column: colId, text, gif, gifMp4, gifTiny })
    drafts = { ...drafts, [colId]: '' }
    gifUrl[colId] = null;     gifUrl     = gifUrl
    gifMp4Url[colId] = null;  gifMp4Url  = gifMp4Url
    gifPreview[colId] = null; gifPreview  = gifPreview
    gifOpen[colId]   = false; gifOpen  = gifOpen
    gifResults[colId] = [];   gifResults = gifResults
    gifQuery[colId]   = '';   gifQuery   = gifQuery
    const ta = document.querySelector(`[data-col="${colId}"]`)
    if (ta) ta.style.height = 'auto'
  }

  function removeCard(colId, tempId) {
    localCards[colId] = (localCards[colId] ?? []).filter(c => c.id !== tempId)
    localCards = localCards
  }

  // Ctrl+Enter / Cmd+Enter = submit; Enter = newline
  function handleKey(e, colId) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addCard(colId) }
  }

  const gifDebounce = {}

  async function searchGifs(colId) {
    const q = (gifQuery[colId] ?? '').trim()
    if (!q) { gifResults[colId] = []; gifResults = gifResults; return }
    gifLoading[colId] = true; gifLoading = gifLoading
    try {
      const res = await fetch(`https://api.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=LIVDSRZULELA&limit=16&contentfilter=medium&media_filter=minimal`)
      const data = await res.json()
      gifResults[colId] = data.results ?? []
      gifResults = gifResults
    } catch { gifResults[colId] = [] }
    gifLoading[colId] = false; gifLoading = gifLoading
  }

  function onGifInput(colId) {
    clearTimeout(gifDebounce[colId])
    gifDebounce[colId] = setTimeout(() => searchGifs(colId), 400)
  }

  function selectGif(colId, gUrl, mp4, tiny) {
    gifUrl[colId]     = gUrl;           gifUrl     = gifUrl
    gifMp4Url[colId]  = mp4  ?? null;   gifMp4Url  = gifMp4Url
    gifPreview[colId] = tiny ?? gUrl;   gifPreview = gifPreview
    gifOpen[colId]    = false;          gifOpen    = gifOpen
  }

  function toggleGif(colId) {
    gifOpen[colId] = !gifOpen[colId]; gifOpen = gifOpen
    if (gifOpen[colId] && !gifResults[colId]?.length) {
      gifQuery[colId] = ''; gifQuery = gifQuery
    }
  }

  const placeholders = [
    "write something. or stare. your call.",
    "what's on your mind.",
    "be honest. this is a safe space. kind of.",
    "say it. nobody's judging. (they are)",
    "go on.",
  ]
</script>

<!-- Confirm dialog -->
{#if confirmReveal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="bg-[#111118] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl slide-up">
      <p class="font-black text-lg text-white mb-1">hold on.</p>
      <p class="text-white/40 text-sm mb-5">
        <span class="text-orange-400 font-bold">{notSubmitted} {notSubmitted === 1 ? 'person hasn\'t' : 'people haven\'t'}</span>
        submitted yet. reveal anyway?
      </p>
      <div class="flex gap-2">
        <button on:click={() => confirmReveal = false}
          class="btn flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white font-bold py-2.5 rounded-xl transition text-sm">
          wait for them
        </button>
        <button on:click={() => { confirmReveal = false; send({ type: 'advance' }) }}
          class="btn flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2.5 rounded-xl transition text-sm">
          reveal anyway
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Board wrapper -->
<div class="slide-up -mx-5 px-5 py-5 board-bg min-h-screen rounded-2xl" style="margin-top:-20px">

  <!-- HUD bar -->
  <div class="flex items-center gap-4 mb-6 px-1">
    <!-- notes counter — big and game-like -->
    <div class="flex items-baseline gap-1.5">
      {#key totalCards}
        <span class="num-up text-3xl font-black text-white tabular-nums leading-none">{totalCards}</span>
      {/key}
      <span class="text-xs text-white/30 font-semibold">notes</span>
    </div>

    <!-- Divider -->
    <div class="w-px h-6 bg-white/10 shrink-0"></div>

    {#if liveMode}
      <span class="text-xs font-bold text-emerald-400/70 flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        live
      </span>
      <span class="text-xs text-white/20">{total} in room</span>
    {:else}
      <!-- Submit progress -->
      <div class="flex-1 flex items-center gap-3">
        <div class="flex-1 h-1 bg-white/6 rounded-full overflow-hidden">
          <div class="h-full bg-indigo-500 rounded-full transition-all duration-700" style="width:{pct}%"></div>
        </div>
        <span class="text-xs text-white/30 tabular-nums shrink-0 font-mono">
          {#key submitCount}<span class="num-up">{submitCount}</span>{/key}/{total}
        </span>
      </div>
      <span class="text-[10px] text-white/15 hidden sm:block">private until reveal</span>
    {/if}

    {#if $isFacilitator}
      <button on:click={liveMode ? () => send({ type: 'advance' }) : tryAdvance}
        class="btn text-xs font-bold text-white/25 hover:text-white/60 transition ml-auto">
        {liveMode ? 'start voting →' : 'reveal →'}
      </button>
    {/if}
  </div>

  {#if submitted && !liveMode}
    <div class="flex flex-col items-center justify-center py-32 space-y-4">
      <div class="pop-in text-6xl">🎯</div>
      <p class="font-black text-white text-2xl">notes submitted.</p>
      <p class="text-sm text-white/30">you placed <span class="text-white font-black">{totalCards}</span> notes. respectable.</p>
      <p class="text-xs text-white/20 mt-1">
        {total - submitCount} {total - submitCount === 1 ? 'person is' : 'people are'} {slowPhrases[Math.floor(Math.random() * slowPhrases.length)]}
      </p>
      {#if $isFacilitator}
        <button on:click={tryAdvance}
          class="btn mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black px-12 py-4 rounded-2xl transition shadow-xl shadow-indigo-950 text-base">
          reveal everything →
        </button>
      {/if}
    </div>

  {:else}
    <!-- Column board -->
    <div class="grid grid-cols-1 {gridClass(columns.length)} gap-4 items-start mb-6">
      {#each columns as col, ci}
        {@const cards = liveMode ? (liveCardsByCol[col.id] ?? []) : (localCards[col.id] ?? [])}
        {@const draft = drafts[col.id] ?? ''}
        {@const isFoc = focused === col.id}

        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div class="relative flex rounded-2xl overflow-hidden transition-all duration-200 cursor-text bg-white/[0.04]"
          on:click={() => focusCol(col.id)}
          style="box-shadow: {isFoc ? `0 0 0 1.5px ${col.accent}70` : colFlash[col.id] ? `0 0 0 1.5px ${col.accent}50` : '0 0 0 1px rgba(255,255,255,0.07)'}">

          <!-- Left accent stripe -->
          <div class="w-[3px] shrink-0 transition-all duration-200"
            style="background: {isFoc ? col.accent : colFlash[col.id] ? col.accent+'cc' : col.accent+'50'}"></div>

          <!-- Column body -->
          <div class="flex-1 flex flex-col min-w-0">

            <!-- Header -->
            <div class="px-4 pt-4 pb-2 relative">
              <div class="flex items-center justify-between mb-1">
                <span class="font-black text-base text-white/90">{col.label}</span>
                {#key cards.length}
                  <span class="num-up text-xs tabular-nums font-mono" style="color:{col.accent}aa">{cards.length}</span>
                {/key}
              </div>
              {#if col.hint}
                <p class="text-xs text-white/30 leading-relaxed">{col.hint}</p>
              {/if}
              <!-- Score popups -->
              {#each (scores[col.id] ?? []) as s (s.id)}
                <span class="score-pop absolute top-1 left-1/2 -translate-x-1/2 font-black pointer-events-none"
                  style="color:{col.accent}">+1</span>
              {/each}
            </div>

            <!-- Notes pile -->
            <div class="px-3 pt-1 pb-1 flex flex-col gap-2.5 flex-1 min-h-[60px]">
              {#each cards as card (card.id)}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div class="group relative {col.note} note-slap rounded-xl overflow-hidden cursor-default
                  transition-all duration-150 hover:-translate-y-1 hover:scale-[1.02] hover:rotate-0 hover:shadow-xl hover:z-10"
                  style="--r:{cardRotation(card.id)}deg; transform: rotate({cardRotation(card.id)}deg)"
                  on:click|stopPropagation>
                  {#if card.gif}
                    <img src={card.gifTiny ?? card.gif} alt="" class="w-full rounded-t-xl" />
                  {/if}
                  {#if card.text}
                    <p class="px-3.5 py-3 font-hand text-[22px] leading-snug whitespace-pre-wrap">{card.text}</p>
                  {/if}
                  {#if liveMode}
                    <div class="px-3.5 pb-2.5">
                      <span class="font-sans text-[10px] font-bold opacity-40">{card.authorName ?? ''}</span>
                    </div>
                  {:else}
                    <button on:click|stopPropagation={() => removeCard(col.id, card.id)}
                      class="btn absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/40 border border-black/10
                        text-black/50 text-[11px] font-black flex items-center justify-center
                        opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500">×</button>
                  {/if}
                </div>
              {/each}

              {#if cards.length === 0}
                <p class="text-xs italic text-white/15 text-center py-4">nothing here yet</p>
              {/if}
            </div>

            <!-- Input -->
            <div class="px-3 pb-3 pt-1" on:click|stopPropagation>

              <!-- Sticky note input — GIF preview + textarea in one card -->
              <div class="{col.note} rounded-xl overflow-hidden relative transition-all duration-200"
                style="box-shadow:{isFoc ? `0 0 0 2px ${col.accent}60, 0 6px 20px rgba(0,0,0,0.4)` : '0 4px 14px rgba(0,0,0,0.25)'}">

                {#if gifUrl[col.id]}
                  <!-- GIF preview inside the note — uses tinygif for fast display -->
                  <div class="relative">
                    <img src={gifPreview[col.id]} alt="" class="w-full" />
                    <button on:click={() => { gifUrl[col.id] = null; gifUrl = gifUrl; gifMp4Url[col.id] = null; gifMp4Url = gifMp4Url; gifPreview[col.id] = null; gifPreview = gifPreview }}
                      class="btn absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 text-white text-[11px] font-black flex items-center justify-center hover:bg-black/80">×</button>
                  </div>
                {/if}

                <textarea
                  use:autoResize
                  data-col={col.id}
                  value={draft}
                  on:input={(e) => drafts = { ...drafts, [col.id]: e.target.value }}
                  on:keydown={(e) => handleKey(e, col.id)}
                  on:focus={() => focused = col.id}
                  on:blur={() => focused = null}
                  placeholder={gifUrl[col.id] ? 'add a caption… (optional)' : placeholders[ci % placeholders.length]}
                  rows="2"
                  class="w-full px-3.5 pt-3 pb-9 font-hand text-[22px] resize-none outline-none bg-transparent
                    placeholder:text-current placeholder:opacity-40 leading-snug"
                ></textarea>

                <!-- Toolbar -->
                <div class="absolute bottom-2.5 left-3 right-2.5 flex items-center justify-between">
                  <button on:click={() => toggleGif(col.id)}
                    class="btn text-[10px] font-black px-1.5 py-0.5 rounded transition-all duration-150
                      {gifOpen[col.id] ? 'text-indigo-500' : gifUrl[col.id] ? 'text-indigo-400' : 'text-black/30 hover:text-black/60'}">
                    {gifUrl[col.id] ? '✓ GIF' : 'GIF'}
                  </button>
                  <div class="flex items-center gap-2">
                    {#if draft.trim() || gifUrl[col.id]}
                      <span class="text-[10px] font-sans text-black/30">⌘↵ or</span>
                    {/if}
                    <button on:click={() => addCard(col.id)}
                      class="btn font-black text-sm flex items-center justify-center px-3 py-1 rounded-lg transition-all duration-150
                        {(draft.trim() || gifUrl[col.id]) ? 'bg-black/20 hover:bg-black/35 text-black/70 opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}">
                      add +
                    </button>
                  </div>
                </div>
              </div>

              <!-- GIF picker panel — below the note -->
              {#if gifOpen[col.id]}
                <div class="mt-2 rounded-xl overflow-hidden bg-black/60 backdrop-blur border border-white/10">
                  <div class="flex items-center gap-2 p-2">
                    <input
                      type="text"
                      bind:value={gifQuery[col.id]}
                      on:input={() => onGifInput(col.id)}
                      placeholder="type to search gifs…"
                      class="flex-1 bg-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/15"
                    />
                    {#if gifLoading[col.id]}
                      <span class="text-white/40 text-xs animate-pulse">searching…</span>
                    {/if}
                  </div>
                  {#if gifResults[col.id]?.length}
                    {#key gifResults[col.id]}
                      <div class="grid grid-cols-4 gap-1 px-2 pb-2 max-h-44 overflow-y-auto">
                        {#each gifResults[col.id] as gif (gif.id)}
                          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                          <div on:click={() => selectGif(col.id, gif.media[0].gif.url, gif.media[0].mp4?.url, gif.media[0].tinygif?.url)}
                            class="cursor-pointer rounded overflow-hidden hover:opacity-80 transition-opacity aspect-square bg-white/5">
                            <img src={gif.media[0].nanogif?.url ?? gif.media[0].tinygif?.url} alt=""
                              class="w-full h-full object-cover" />
                          </div>
                        {/each}
                      </div>
                    {/key}
                  {/if}
                </div>
              {/if}
            </div>

          </div><!-- /column body -->
        </div><!-- /column outer -->
      {/each}
    </div>

    <!-- Submit (hidden in live mode — facilitator controls flow) -->
    {#if !liveMode}
      <div class="flex justify-center">
        <button on:click={() => send({ type: 'submit' })}
          class="btn bg-indigo-600 hover:bg-indigo-500 text-white font-black px-16 py-4 rounded-2xl transition shadow-xl shadow-indigo-950 text-base">
          i'm done. (finally)
        </button>
      </div>
    {/if}
  {/if}

</div>
