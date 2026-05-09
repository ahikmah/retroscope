<script>
    import { send } from "../ws.js";
    import { room, myId, isFacilitator } from "../store.js";
    import OceanBottle from "../components/OceanBottle.svelte";

    $: members = $room?.team?.members ?? [];

    let selectedRecipient = null;
    let bottleMessage = "";
    let bottleSender = "";
    let bottleSent = new Set();
    let bottleSending = false;
    let bottleError = null;
    let oceanState = "idle";
    let justSentName = "";

    async function sendBottle() {
        if (!selectedRecipient || !bottleMessage.trim() || bottleSending)
            return;
        bottleSending = true;
        bottleError = null;
        try {
            const res = await fetch("/api/bottle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roomCode: $room.code,
                    recipientId: selectedRecipient.id,
                    message: bottleMessage.trim(),
                    senderName: bottleSender.trim(),
                }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "failed");
            }
            justSentName = selectedRecipient.name;
            oceanState = "launching";
        } catch (e) {
            bottleError = e.message;
            bottleSending = false;
        }
    }

    function onBottleSent() {
        bottleSent = new Set([...bottleSent, selectedRecipient.id]);
        bottleMessage = "";
        bottleSender = "";
        selectedRecipient = null;
        bottleSending = false;
        // Faster reset so user can send more bottles
        setTimeout(() => {
            oceanState = "idle";
        }, 1500);
    }

    function advance() {
        send({ type: "advance" });
    }
</script>

<!-- Fullscreen ocean stage -->
<div class="fixed inset-0 z-0">
    <OceanBottle state={oceanState} on:sent={onBottleSent} />
</div>

<!-- UI layer -->
<div class="fixed inset-0 z-10 flex flex-col pointer-events-none">
    <!-- Top bar -->
    <div class="flex items-start justify-between p-6 pointer-events-auto">
        <div>
            <h2 class="text-xl font-black text-white drop-shadow-lg">
                🍶 messages in a bottle
            </h2>
            <p class="text-sm text-white/50 mt-0.5 drop-shadow">
                {#if members.length === 0}
                    no team linked to this session
                {:else}
                    pick someone. say something real.
                {/if}
            </p>
        </div>
        <button
            on:click={advance}
            class="btn bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white font-black px-6 py-2.5 rounded-xl transition text-sm"
        >
            done →
        </button>
    </div>

    <!-- Sent success overlay -->
    {#if oceanState === "launching" || oceanState === "done"}
        <div
            class="flex-1 flex items-center justify-center pointer-events-none"
        >
            <div class="text-center slide-up">
                <p class="text-5xl mb-3">🌊</p>
                <p class="font-black text-white text-2xl drop-shadow-lg">
                    on its way to {justSentName}
                </p>
                <p class="text-white/40 text-sm mt-2">
                    somewhere out there, a bottle drifts…
                </p>
            </div>
        </div>
    {/if}

    <!-- Bottom compose panel -->
    {#if members.length > 0 && oceanState === "idle"}
        <div
            class="mt-auto pointer-events-auto"
            style="background: linear-gradient(to top, rgba(4,4,16,0.95) 55%, rgba(4,4,16,0.6) 80%, transparent)"
        >
            <div class="max-w-2xl mx-auto px-6 pb-8 pt-12 space-y-4">
                <!-- Recipient pills -->
                <div>
                    <p
                        class="text-[11px] text-white/30 uppercase tracking-widest mb-2.5"
                    >
                        who's it for?
                    </p>
                    <div class="flex flex-wrap gap-2">
                        {#each members as member (member.id)}
                            <button
                                on:click={() =>
                                    (selectedRecipient =
                                        selectedRecipient?.id === member.id
                                            ? null
                                            : member)}
                                class="btn px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2
                                    {selectedRecipient?.id === member.id
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/60'
                                    : bottleSent.has(member.id)
                                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400/80 border border-emerald-500/20'
                                      : 'bg-white/10 hover:bg-white/20 backdrop-blur text-white/70 hover:text-white border border-white/10'}"
                            >
                                {member.name}
                                {#if bottleSent.has(member.id)}
                                    <span class="text-[10px]">🍶</span>
                                {/if}
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- Compose (slides in when recipient selected) -->
                {#if selectedRecipient}
                    <div class="space-y-3 slide-up">
                        <textarea
                            bind:value={bottleMessage}
                            placeholder="say something real. it's okay if it's awkward."
                            rows="3"
                            class="w-full rounded-xl px-4 py-3 outline-none text-sm font-semibold resize-none transition border border-white/15 focus:border-indigo-500/70"
                            style="background:rgba(255,255,255,0.07); color:white; backdrop-filter:blur(8px)"
                        ></textarea>
                        <div class="flex gap-3 items-center">
                            <input
                                bind:value={bottleSender}
                                placeholder="your name (leave blank to stay anonymous)"
                                class="flex-1 rounded-xl px-4 py-2.5 outline-none text-sm font-semibold transition border border-white/15 focus:border-indigo-500/70"
                                style="background:rgba(255,255,255,0.07); color:white; backdrop-filter:blur(8px)"
                            />
                            {#if bottleError}
                                <p class="text-xs text-red-400/80 shrink-0">
                                    {bottleError}
                                </p>
                            {/if}
                            <button
                                on:click={sendBottle}
                                disabled={bottleSending ||
                                    !bottleMessage.trim()}
                                class="btn bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-2.5 rounded-xl transition text-sm disabled:opacity-40 shrink-0 shadow-lg shadow-indigo-900/50"
                            >
                                {bottleSending ? "…" : "🍶 send"}
                            </button>
                        </div>
                    </div>
                {/if}

            </div>
        </div>
    {:else if members.length === 0}
        <div
            class="mt-auto pointer-events-auto pb-8 text-center"
            style="background: linear-gradient(to top, rgba(4,4,16,0.9) 40%, transparent)"
        >
            <p class="text-white/30 text-sm py-8">
                no team was linked to this session.
            </p>
        </div>
    {/if}
</div>
