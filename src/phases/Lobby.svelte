<script>
    import { onMount } from "svelte";
    import { send, saveSession, getToken } from "../ws.js";
    import {
        room,
        myId,
        myName,
        isFacilitator,
        currentUser,
        page,
    } from "../store.js";
    import { TEMPLATES, DEFAULT_TEMPLATE, avatarIndex } from "../config.js";

    let mode = null;
    let step = "template";
    let name = "";
    let sessionName = "";
    let code = "";
    let codeCopied = false;
    let selectedTemplate = DEFAULT_TEMPLATE;
    let liveMode = false;

    // ── Team selector (for create mode) ──────────────────────────────────────
    let teams = [];
    let selectedTeamId = '';

    onMount(async () => {
        if ($currentUser) {
            try {
                const res = await fetch('/api/teams', {
                    headers: { Authorization: `Bearer ${getToken()}` },
                });
                if (res.ok) teams = await res.json();
            } catch {}
        }
    });

    // ── Music player ──────────────────────────────────────────────────────────
    const MUSIC_VIBES = [
        { label: 'lofi',      icon: '🎵', ytId: 'jfKfPfyJRdk' },
        { label: 'jazz',      icon: '🎷', ytId: 'Dx5qFachd3A' },
        { label: 'synthwave', icon: '🌆', ytId: '4xDzrJKXOOY' },
        { label: 'focus',     icon: '🧘', ytId: 'WPni755-Krg' },
    ]

    let customUrl = ''
    let customError = false

    function parseYouTubeId(input) {
        input = input.trim()
        if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input
        try {
            const url = new URL(input)
            if (url.hostname.includes('youtu.be')) return url.pathname.slice(1).split('?')[0]
            if (url.hostname.includes('youtube.com')) return url.searchParams.get('v') || url.pathname.split('/').pop()
        } catch {}
        return null
    }

    function pickMusic(track) {
        if ($room?.music?.ytId === track.ytId) {
            send({ type: 'music', ytId: null })
        } else {
            send({ type: 'music', ytId: track.ytId, label: track.label, icon: track.icon })
        }
    }

    function playCustom() {
        const ytId = parseYouTubeId(customUrl)
        if (!ytId) { customError = true; setTimeout(() => customError = false, 2000); return }
        send({ type: 'music', ytId, label: 'custom', icon: '🎧' })
        customUrl = ''
    }

    $: selectedMusic = $room?.music ?? null

    // ── Vibe board ────────────────────────────────────────────────────────────
    const VIBE_EMOJIS = ['😊','😐','😤','😴','😅','🤔','🙃','🫠','💪','🔥','☕','🎯','🤯','🫶','🚀','🌊','💀','👀','✨','🍕']
    const NOTE_CLASSES = ['note-liked','note-learned','note-lacked','note-longed']
    const ROTATIONS = [-3, 2, -1.5, 3, -2]

    let selectedEmoji = null
    let vibeText = ''
    let vibeDebounce = null

    function selectEmoji(emoji) {
        selectedEmoji = emoji
        send({ type: 'vibe', emoji, text: vibeText })
    }

    function onVibeTextInput() {
        if (!selectedEmoji) return
        clearTimeout(vibeDebounce)
        vibeDebounce = setTimeout(() => {
            send({ type: 'vibe', emoji: selectedEmoji, text: vibeText })
        }, 600)
    }

    // Self-heal: whenever room state arrives, re-send vibe if server doesn't have it yet
    // (handles WS reconnect race — send() silently drops if socket not open)
    $: {
        const me = $room?.players?.find(p => p.id === $myId)
        if (me && selectedEmoji && !me.emoji) {
            send({ type: 'vibe', emoji: selectedEmoji, text: vibeText })
        }
        // Restore local state after rejoin
        if (me?.emoji && !selectedEmoji) {
            selectedEmoji = me.emoji
            vibeText      = me.vibeText ?? ''
        }
    }

    // Optimistic vibe display: merge server-confirmed + own unconfirmed card
    $: vibers = (() => {
        const confirmed = ($room?.players ?? []).filter(p => p.emoji)
        const meConfirmed = confirmed.find(p => p.id === $myId)
        const myPlayerName = $room?.players?.find(p => p.id === $myId)?.name ?? ''
        const optimistic = (selectedEmoji && !meConfirmed && $myId)
            ? [{ id: $myId, emoji: selectedEmoji, vibeText, name: myPlayerName }]
            : []
        return [...optimistic, ...confirmed]
    })()

    function selectTemplate(t) {
        selectedTemplate = t;
        step = "details";
    }

    function create() {
        if (!name.trim() || !sessionName.trim()) return;
        myName.set(name.trim());
        sessionStorage.setItem("retro_name", name.trim());
        send({
            type: "create",
            name: name.trim(),
            sessionName: sessionName.trim(),
            templateId: selectedTemplate.id,
            columns: selectedTemplate.columns,
            liveMode,
            teamId: selectedTeamId || null,
        });
    }

    function join() {
        if (!name.trim() || !code.trim()) return;
        myName.set(name.trim());
        sessionStorage.setItem("retro_name", name.trim());
        send({
            type: "join",
            name: name.trim(),
            roomCode: code.trim().toUpperCase(),
        });
    }

    function start() {
        send({ type: "advance" });
    }

    function copyCode() {
        if (!$room?.code) return;
        navigator.clipboard.writeText($room.code);
        codeCopied = true;
        setTimeout(() => (codeCopied = false), 2000);
    }

    function resetCreate() {
        mode = null;
        step = "template";
        name = "";
        sessionName = "";
    }

    let titleRotate = 0;
    function onTitleMove(e) {
        const r = e.currentTarget.getBoundingClientRect();
        const offset = (e.clientX - (r.left + r.width / 2)) / r.width;
        titleRotate = offset * 12;
    }
    function onTitleLeave() {
        titleRotate = 0;
    }

    const illustrations = {
        "4ls": `<svg viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 22 C16 18 20 15 24 19 C28 15 32 18 32 22 C32 28.5 24 35 24 35 C24 35 16 28.5 16 22Z"/>
      <circle cx="72" cy="21" r="8"/>
      <path d="M68 29v4h8v-4"/><path d="M69.5 33h5"/>
      <path d="M72 13v-3"/><path d="M65 16l-2-2"/><path d="M79 16l2-2"/>
      <path d="M14 50h18M14 55h14M14 60h16" opacity="0.7"/>
      <path d="M72 45l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>
      <path d="M60 42l1 3 1-3-1-3z" opacity="0.5"/>
      <path d="M85 58l1 3 1-3-1-3z" opacity="0.4"/>
      <path d="M38 10l1 3 1-3-1-3z" opacity="0.35"/>
    </svg>`,

        ssc: `<svg viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 36 L12 24 L24 30 Z"/>
      <rect x="42" y="24" width="12" height="12" rx="2"/>
      <path d="M72 24 C72 24 80 24 80 30 C80 36 80 42 72 44"/>
      <path d="M68 40 L72 44 L76 40"/>
      <path d="M20 55 L76 55" stroke-width="1" opacity="0.3"/>
      <path d="M18 62 L24 56 M48 62 L48 56 M78 62 L72 56" stroke-width="1.2" opacity="0.4"/>
    </svg>`,

        msg: `<svg viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="18" cy="30" r="12"/>
      <path d="M13 35 C15 33 21 33 23 35"/>
      <path d="M14 25 L16 27 M22 25 L20 27"/>
      <circle cx="48" cy="30" r="12"/>
      <path d="M43 36 C45 34 51 34 53 36"/>
      <path d="M44 26 Q48 24 52 26" stroke-width="1.2"/>
      <circle cx="78" cy="30" r="12"/>
      <path d="M73 34 C75 37 81 37 83 34"/>
      <path d="M74 26 Q78 28 82 26" stroke-width="1.2"/>
      <path d="M12 55 Q18 50 24 55 Q30 60 36 55" stroke-width="1.2" opacity="0.35"/>
      <path d="M60 55 Q66 50 72 55 Q78 60 84 55" stroke-width="1.2" opacity="0.35"/>
    </svg>`,

        sailboat: `<svg viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M48 8 L48 48"/>
      <path d="M48 10 L22 44 L48 44 Z"/>
      <path d="M48 16 L70 38 L48 38"/>
      <path d="M18 52 L78 52"/>
      <path d="M22 52 L18 60 L78 60 L74 52"/>
      <path d="M10 64 Q18 60 26 64 Q34 68 42 64 Q50 60 58 64 Q66 68 74 64 Q82 60 88 64" stroke-width="1.3"/>
      <path d="M30 44 L28 52" stroke-width="1.2" opacity="0.5"/>
      <circle cx="82" cy="20" r="5"/>
      <path d="M82 25 L82 32"/><path d="M79 32 L85 32"/>
    </svg>`,

        www: `<svg viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 28 L18 36 L34 16"/>
      <circle cx="22" cy="28" r="14"/>
      <path d="M56 14 L58 20 L64 20 L60 24 L62 30 L56 26 L50 30 L52 24 L48 20 L54 20 Z"/>
      <path d="M56 34 L56 40 M53 37 L59 37" stroke-width="1.3" opacity="0.5"/>
      <path d="M76 20 Q86 20 86 30 Q86 42 76 44"/>
      <path d="M72 40 L76 44 L80 40"/>
      <path d="M76 28 h-6"/>
      <path d="M14 52 Q22 48 30 52 Q38 56 46 52" stroke-width="1.2" opacity="0.35"/>
      <path d="M64 52 Q72 48 80 52 Q88 56 94 52" stroke-width="1.2" opacity="0.35"/>
    </svg>`,

        kalm: `<svg viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M24 10 L36 14 L36 26 C36 32 24 38 24 38 C24 38 12 32 12 26 L12 14 Z"/>
      <path d="M18 26 L22 30 L30 20"/>
      <circle cx="72" cy="24" r="10"/>
      <path d="M72 18 L72 30 M66 24 L78 24"/>
      <path d="M14 50 L30 50 M14 56 L24 56" opacity="0.8"/>
      <path d="M11 53 L14 50 L17 53" opacity="0.6"/>
      <path d="M66 50 L82 50"/>
      <path d="M78 46 L82 50 L78 54"/>
      <path d="M66 56 L82 56"/>
      <path d="M70 52 L66 56 L70 60"/>
    </svg>`,
    };
</script>

{#if $room}
    <div class="max-w-4xl mx-auto slide-up mt-6">

        <!-- Room code -->
        <div class="text-center mb-8">
            <p class="text-xs text-white/25 uppercase tracking-widest mb-3">share this. or don't.</p>
            <button on:click={copyCode} class="btn inline-flex gap-2 group" title="click to copy">
                {#each $room.code.split("") as char}
                    <span class="w-12 h-14 flex items-center justify-center text-2xl font-black rounded-xl
                        bg-white/5 border border-white/10 font-mono text-indigo-300
                        group-hover:bg-white/10 group-hover:border-indigo-500/50 transition-all">{char}</span>
                {/each}
            </button>
            <p class="text-[11px] text-white/20 mt-2">{codeCopied ? "copied. impressive." : "click to copy"}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-[1fr_1.6fr] gap-6 items-start">

            <!-- Left: Players + start -->
            <div class="space-y-4">
                {#if $room.templateId}
                    {@const tpl = TEMPLATES.find(t => t.id === $room.templateId)}
                    {#if tpl}
                        <p class="text-xs text-white/25 font-semibold">{tpl.name}</p>
                    {/if}
                {/if}

                <div class="space-y-2">
                    <p class="text-xs text-white/25 uppercase tracking-widest">
                        {$room.players.length} {$room.players.length === 1 ? 'brave soul' : 'people with nothing better to do'}
                    </p>
                    {#each $room.players as player, i}
                        <div class="slide-in flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3"
                            style="animation-delay:{i * 60}ms">
                            <div class="av-{avatarIndex(player.id)} w-8 h-8 rounded-full flex items-center justify-center font-black text-gray-900 text-xs flex-shrink-0">
                                {player.name[0]?.toUpperCase()}
                            </div>
                            <span class="font-semibold text-sm flex-1">{player.name}</span>
                            {#if player.emoji}
                                <span class="text-lg">{player.emoji}</span>
                            {:else}
                                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            {/if}
                            {#if player.id === $room.facilitatorId}
                                <span class="text-[10px] bg-white/8 text-white/40 px-2 py-0.5 rounded-full">host</span>
                            {/if}
                        </div>
                    {/each}
                </div>

                {#if $isFacilitator}
                    <button on:click={start}
                        class="btn w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3.5 rounded-xl transition shadow-lg shadow-indigo-950">
                        fine. let's begin.
                    </button>
                {:else}
                    <p class="text-sm text-white/20 animate-pulse text-center">
                        waiting for the host to stop overthinking and click the button…
                    </p>
                {/if}
            </div>

            <!-- Right: Vibe board (always shown) -->
            <div class="board-bg rounded-2xl p-5 space-y-5" style="box-shadow: 0 0 0 1px rgba(255,255,255,0.07)">

                <!-- Question -->
                <div>
                    <p class="text-[10px] text-white/25 uppercase tracking-widest mb-1.5">while you wait</p>
                    <p class="font-black text-white/80 text-sm leading-snug">
                        "{$room.icebreaker?.question ?? 'what\'s your vibe right now?'}"
                    </p>
                </div>

                <!-- Emoji picker -->
                <div>
                    <p class="text-[10px] text-white/25 mb-2">pick your vibe</p>
                    <div class="flex flex-wrap gap-1">
                        {#each VIBE_EMOJIS as emoji}
                            <button on:click={() => selectEmoji(emoji)}
                                class="btn text-xl w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150
                                    {selectedEmoji === emoji ? 'bg-white/20 scale-125 shadow-lg' : 'hover:bg-white/10 opacity-70 hover:opacity-100'}">
                                {emoji}
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- Text input (appears after emoji picked) -->
                {#if selectedEmoji}
                    <div class="flex gap-2 items-center">
                        <span class="text-2xl">{selectedEmoji}</span>
                        <input
                            bind:value={vibeText}
                            on:input={onVibeTextInput}
                            placeholder="add a word or two…"
                            maxlength="60"
                            class="flex-1 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                            style="background:rgba(255,255,255,0.08); color:white"
                        />
                    </div>
                {/if}

                <!-- Live vibe cards — optimistic for own card, server-confirmed for others -->
                {#if vibers.length > 0}
                    <div class="flex flex-wrap gap-2.5 pt-1">
                        {#each vibers as vibe, i (vibe.id)}
                            <div class="sticky {NOTE_CLASSES[i % 4]} note-slap rounded-xl px-3 py-2.5 text-center"
                                style="--r:{ROTATIONS[i % 5]}deg; transform: rotate({ROTATIONS[i % 5]}deg); min-width: 76px; max-width: 140px">
                                <div class="text-2xl mb-1">{vibe.emoji}</div>
                                {#if vibe.vibeText}
                                    <p class="font-hand text-sm leading-tight break-words">{vibe.vibeText}</p>
                                {/if}
                                <p class="font-sans text-[10px] font-bold opacity-40 mt-1.5">{vibe.name}</p>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <p class="text-xs text-white/15 italic text-center py-2">no vibes yet. be first.</p>
                {/if}

            </div>

        </div>

        <!-- Music player — full width, shared jukebox -->
        <div class="board-bg rounded-2xl px-5 py-4 mt-6" style="box-shadow: 0 0 0 1px rgba(255,255,255,0.07)">
            <div class="flex items-center gap-4 flex-wrap">
                <p class="text-[10px] text-white/25 uppercase tracking-widest shrink-0">room music</p>
                <div class="flex gap-1.5 flex-wrap flex-1">
                    {#each MUSIC_VIBES as track}
                        <button on:click={() => pickMusic(track)}
                            class="btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150
                                {selectedMusic?.ytId === track.ytId
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white/8 text-white/50 hover:bg-white/15 hover:text-white'}">
                            <span>{track.icon}</span>
                            <span>{track.label}</span>
                            {#if selectedMusic?.ytId === track.ytId}
                                <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                            {/if}
                        </button>
                    {/each}

                    <!-- Custom YouTube URL -->
                    <form on:submit|preventDefault={playCustom} class="flex gap-1.5 flex-1 min-w-[180px]">
                        <input
                            bind:value={customUrl}
                            placeholder="paste youtube link…"
                            class="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none transition border
                                {customError ? 'border-red-500/60' : 'border-white/10'}"
                            style="background:rgba(255,255,255,0.07); color:white"
                        />
                        <button type="submit"
                            class="btn px-3 py-1.5 rounded-lg text-xs font-bold bg-white/8 text-white/50 hover:bg-white/15 hover:text-white transition">
                            🎧 play
                        </button>
                    </form>
                </div>
                {#if selectedMusic}
                    <p class="text-[10px] text-white/20 shrink-0">
                        {selectedMusic.icon} {selectedMusic.label} · playing for everyone
                    </p>
                {/if}
            </div>
            {#if selectedMusic}
                <div class="mt-3 rounded-xl overflow-hidden" style="height:90px">
                    {#key selectedMusic.ytId}
                        <iframe
                            src="https://www.youtube-nocookie.com/embed/{selectedMusic.ytId}?autoplay=1&controls=1&modestbranding=1&rel=0"
                            class="w-full h-full"
                            frameborder="0"
                            allow="autoplay; encrypted-media"
                            title="{selectedMusic.label} music"
                        ></iframe>
                    {/key}
                </div>
            {/if}
        </div>

    </div>
{:else if mode === "create"}
    {#if step === "template"}
        <div class="slide-up">
            <!-- Back + heading -->
            <div class="mb-8">
                <button
                    on:click={resetCreate}
                    class="btn inline-flex items-center gap-1.5 text-white/30 hover:text-white/70 transition text-sm font-semibold mb-5 group"
                >
                    <svg
                        class="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M15 19l-7-7 7-7"
                        />
                    </svg>
                    Back
                </button>
                <h2 class="text-3xl font-black tracking-tight">
                    pick your poison
                </h2>
                <p class="text-sm text-white/25 mt-1">
                    they're all the same, honestly
                </p>
            </div>

            <!-- Template grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {#each TEMPLATES as t}
                    <button
                        on:click={() => selectTemplate(t)}
                        class="btn text-left bg-white/3 hover:bg-white/6 border border-white/8 hover:border-indigo-500/40 rounded-2xl p-6 transition group relative overflow-hidden"
                    >
                        <!-- Illustration -->
                        <div
                            class="text-white/15 group-hover:text-indigo-300/30 transition-colors duration-300 mb-4 w-24 h-[4.5rem]"
                        >
                            {@html illustrations[t.id]}
                        </div>

                        <!-- Content -->
                        <p
                            class="font-black text-lg group-hover:text-indigo-300 transition leading-tight"
                        >
                            {t.name}
                        </p>
                        <p class="text-xs text-white/30 mt-1.5 leading-relaxed">
                            {t.desc}
                        </p>
                        <div class="flex flex-wrap gap-1.5 mt-4">
                            {#each t.columns as col}
                                <span title={col.hint ?? ''}
                                    class="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/6 text-white/35 group-hover:bg-indigo-500/10 group-hover:text-indigo-300/60 transition cursor-help"
                                    >{col.label}</span
                                >
                            {/each}
                        </div>

                        <!-- Hover glow -->
                        <div
                            class="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                            style="background: radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.06) 0%, transparent 70%)"
                        ></div>
                    </button>
                {/each}
            </div>
        </div>
    {:else}
        <div class="flex items-center justify-center min-h-[70vh]">
            <div class="w-full max-w-sm space-y-3 slide-up">
                <button
                    on:click={() => (step = "template")}
                    class="btn inline-flex items-center gap-1.5 text-white/30 hover:text-white/70 transition text-sm font-semibold mb-5 group"
                >
                    <svg
                        class="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M15 19l-7-7 7-7"
                        />
                    </svg>
                    Back
                </button>
                <div class="mb-6">
                    <h2 class="text-2xl font-black">{selectedTemplate.name}</h2>
                    <p class="text-xs text-white/25 mt-0.5">
                        {selectedTemplate.desc}
                    </p>
                </div>
                <input
                    bind:value={sessionName}
                    placeholder="name this inevitable chaos"
                    class="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-3 outline-none font-semibold text-sm transition placeholder:text-white/20"
                />
                <input
                    bind:value={name}
                    placeholder="a name. yours or not."
                    class="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-3 outline-none font-semibold text-sm transition placeholder:text-white/20"
                />

                <!-- Mode toggle -->
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div class="flex items-center justify-between px-1 py-1">
                  <div>
                    <p class="text-sm font-bold text-white/70">{liveMode ? '👁 live board' : '🔒 private write'}</p>
                    <p class="text-xs text-white/25 mt-0.5">
                      {liveMode ? 'cards visible instantly to everyone' : 'cards hidden until reveal'}
                    </p>
                  </div>
                  <div on:click={() => liveMode = !liveMode}
                    class="w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer relative {liveMode ? 'bg-indigo-600' : 'bg-white/10'}">
                    <div class="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 {liveMode ? 'left-6' : 'left-1'}"></div>
                  </div>
                </div>

                <!-- Team selector -->
                {#if teams.length > 0}
                  <div>
                    <p class="text-xs text-white/30 mb-2 px-1">attach a team <span class="text-white/15">(enables message in a bottle)</span></p>
                    <select bind:value={selectedTeamId}
                      class="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-3 outline-none font-semibold text-sm transition text-white/70">
                      <option value=''>no team</option>
                      {#each teams as t}
                        <option value={t.id}>{t.name}</option>
                      {/each}
                    </select>
                  </div>
                {/if}

                <button
                    on:click={create}
                    class="btn w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl transition"
                >
                    fine. create it.
                </button>
            </div>
        </div>
    {/if}
{:else if mode === "join"}
    <div class="flex items-center justify-center min-h-[70vh]">
        <div class="w-full max-w-sm space-y-3 slide-up">
            <button
                on:click={() => (mode = null)}
                class="btn inline-flex items-center gap-1.5 text-white/30 hover:text-white/70 transition text-sm font-semibold mb-5 group"
            >
                <svg
                    class="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 19l-7-7 7-7"
                    />
                </svg>
                Back
            </button>
            <div class="mb-6">
                <h2 class="text-2xl font-black">oh, you were invited?</h2>
                <p class="text-xs text-white/25 mt-0.5">impressive</p>
            </div>
            <input
                bind:value={code}
                placeholder="XXXX"
                maxlength="4"
                class="w-full bg-white/5 border border-white/10 focus:border-indigo-400 rounded-xl px-4 py-3 outline-none font-black font-mono text-2xl text-center tracking-widest uppercase transition placeholder:text-white/15"
            />
            <input
                bind:value={name}
                placeholder="your name. or your cat's. whatever. doesn't matter"
                class="w-full bg-white/5 border border-white/10 focus:border-indigo-400 rounded-xl px-4 py-3 outline-none font-semibold text-sm transition placeholder:text-white/20"
            />
            <button
                on:click={join}
                class="btn w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl transition"
            >
                let me in.
            </button>
        </div>
    </div>
{:else}
    <div
        class="flex flex-col items-center justify-center min-h-[75vh] space-y-8 slide-up"
    >
        <div class="text-center space-y-2">
            <h2
                on:mousemove={onTitleMove}
                on:mouseleave={onTitleLeave}
                style="transform: rotate({titleRotate}deg); transition: transform 0.12s ease"
                class="shimmer-title text-4xl font-black tracking-tight inline-block cursor-default select-none"
            >
                Retroscope
            </h2>
            <p class="text-white/40 text-sm tracking-wide">
                your feedback has been
                <span
                    class="underline decoration-wavy decoration-indigo-400/70 decoration-2 underline-offset-[3px] text-white/70"
                    >received</span
                >
                and
                <span
                    class="underline decoration-wavy decoration-red-400/70 decoration-2 underline-offset-[3px] text-white/70"
                    >ignored</span
                >.
            </p>
        </div>
        <div class="flex gap-3">
            <button
                on:click={() =>
                    $currentUser ? (mode = "create") : page.set("auth")}
                class="btn bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 py-3 rounded-xl transition shadow-lg shadow-indigo-950"
            >
                Start the Suffering
            </button>
            <button
                on:click={() => (mode = "join")}
                class="btn bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black px-8 py-3 rounded-xl transition"
            >
                I Was Invited
            </button>
        </div>
        {#if !$currentUser}
            <p class="text-xs text-white/20">
                creating a room requires an account. <button
                    on:click={() => page.set("auth")}
                    class="btn text-indigo-400/60 hover:text-indigo-300 transition"
                    >sign in</button
                >
            </p>
        {:else}
            <button on:click={() => page.set('teams')}
                class="btn text-xs text-white/20 hover:text-white/50 transition font-semibold">
                manage teams →
            </button>
        {/if}
    </div>
{/if}

<style>
    .shimmer-title {
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
        transition: background-position 0.3s ease;
    }

    .shimmer-title:hover {
        animation: shimmer 2.5s linear infinite;
    }

    @keyframes shimmer {
        0% {
            background-position: 200% center;
        }
        100% {
            background-position: -200% center;
        }
    }
</style>
