<script>
  import { onMount } from 'svelte'
  import { getToken } from '../ws.js'
  import { page } from '../store.js'

  let teams = []
  let expanded = null
  let detail = {}
  let newTeamName = ''
  let showCreate = false
  let memberName = ''
  let memberEmail = ''
  let adding = null
  let creating = false
  let loadError = null

  const authHeaders = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' })

  onMount(fetchTeams)

  async function fetchTeams() {
    loadError = null
    try {
      const res = await fetch('/api/teams', { headers: authHeaders() })
      if (!res.ok) throw new Error()
      teams = await res.json()
    } catch {
      loadError = 'could not load teams.'
    }
  }

  async function createTeam() {
    if (!newTeamName.trim()) return
    creating = true
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: newTeamName.trim() }),
      })
      const data = await res.json()
      teams = [data, ...teams]
      newTeamName = ''
      showCreate = false
    } finally {
      creating = false
    }
  }

  async function deleteTeam(id) {
    if (!confirm('delete this team and all its members?')) return
    await fetch(`/api/teams/${id}`, { method: 'DELETE', headers: authHeaders() })
    teams = teams.filter(t => t.id !== id)
    if (expanded === id) expanded = null
    delete detail[id]
  }

  async function expand(id) {
    if (expanded === id) { expanded = null; return }
    expanded = id
    const res = await fetch(`/api/teams/${id}`, { headers: authHeaders() })
    detail[id] = await res.json()
    detail = detail
  }

  async function addMember(teamId) {
    if (!memberName.trim() || !memberEmail.trim()) return
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: memberName.trim(), email: memberEmail.trim() }),
    })
    const member = await res.json()
    detail[teamId].members = [...(detail[teamId].members ?? []), member]
    detail = detail
    memberName = ''
    memberEmail = ''
    adding = null
  }

  async function removeMember(teamId, memberId) {
    await fetch(`/api/teams/${teamId}/members/${memberId}`, { method: 'DELETE', headers: authHeaders() })
    detail[teamId].members = detail[teamId].members.filter(m => m.id !== memberId)
    detail = detail
  }
</script>

<div class="max-w-2xl mx-auto slide-up">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-2xl font-black">your teams</h2>
      <p class="text-xs text-white/25 mt-0.5">managed separately from rooms</p>
    </div>
    <div class="flex gap-2">
      <button on:click={() => page.set('home')}
        class="btn text-xs font-semibold text-white/30 hover:text-white/70 transition px-3 py-1.5">
        ← back
      </button>
      <button on:click={() => showCreate = !showCreate}
        class="btn bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm px-4 py-2 rounded-xl transition">
        new team
      </button>
    </div>
  </div>

  {#if showCreate}
    <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-5 mb-5 slide-up" style="box-shadow: 0 0 0 1px rgba(255,255,255,0.07)">
      <p class="text-sm font-black mb-3">create a team</p>
      <form on:submit|preventDefault={createTeam} class="flex gap-2">
        <input
          bind:value={newTeamName}
          placeholder="team name"
          class="flex-1 bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-2.5 outline-none text-sm font-semibold transition placeholder:text-white/20"
        />
        <button type="submit" disabled={creating}
          class="btn bg-indigo-600 hover:bg-indigo-500 text-white font-black px-5 py-2.5 rounded-xl transition text-sm disabled:opacity-50">
          create
        </button>
      </form>
    </div>
  {/if}

  {#if loadError}
    <p class="text-sm text-red-400/70 text-center py-8">{loadError}</p>
  {:else if teams.length === 0}
    <div class="text-center py-16 text-white/20">
      <p class="text-4xl mb-3">🧑‍🤝‍🧑</p>
      <p class="font-semibold text-sm">no teams yet. create one to get started.</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each teams as team (team.id)}
        <div class="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden"
          style="box-shadow: 0 0 0 1px rgba(255,255,255,0.07)">
          <!-- Team header -->
          <div class="flex items-center gap-3 px-5 py-4">
            <button on:click={() => expand(team.id)} class="btn flex-1 text-left flex items-center gap-3 group">
              <span class="font-black text-white/90 group-hover:text-white transition">{team.name}</span>
              {#if detail[team.id]}
                <span class="text-xs text-white/25">{detail[team.id].members?.length ?? 0} members</span>
              {/if}
              <svg class="w-3.5 h-3.5 text-white/25 ml-auto transition-transform {expanded === team.id ? 'rotate-180' : ''}"
                fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            <button on:click={() => deleteTeam(team.id)}
              class="btn text-white/20 hover:text-red-400 transition p-1.5 rounded-lg hover:bg-red-500/8"
              title="delete team">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>

          {#if expanded === team.id && detail[team.id]}
            <div class="border-t border-white/8 px-5 py-4 space-y-3">
              <!-- Member list -->
              {#if detail[team.id].members?.length > 0}
                <div class="space-y-2">
                  {#each detail[team.id].members as m (m.id)}
                    <div class="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-white/80 truncate">{m.name}</p>
                        <p class="text-xs text-white/30 truncate">{m.email}</p>
                      </div>
                      <button on:click={() => removeMember(team.id, m.id)}
                        class="btn text-white/20 hover:text-red-400 transition text-lg leading-none px-1"
                        title="remove member">×</button>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-xs text-white/20 italic">no members yet.</p>
              {/if}

              <!-- Add member form -->
              {#if adding === team.id}
                <form on:submit|preventDefault={() => addMember(team.id)} class="space-y-2 pt-1">
                  <div class="flex gap-2">
                    <input
                      bind:value={memberName}
                      placeholder="name"
                      class="flex-1 bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2 outline-none text-sm font-semibold transition placeholder:text-white/20"
                    />
                    <input
                      bind:value={memberEmail}
                      placeholder="email"
                      type="email"
                      class="flex-1 bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2 outline-none text-sm font-semibold transition placeholder:text-white/20"
                    />
                  </div>
                  <div class="flex gap-2">
                    <button type="submit"
                      class="btn bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-4 py-2 rounded-xl transition">
                      add
                    </button>
                    <button type="button" on:click={() => { adding = null; memberName = ''; memberEmail = '' }}
                      class="btn bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 font-semibold text-xs px-4 py-2 rounded-xl transition">
                      cancel
                    </button>
                  </div>
                </form>
              {:else}
                <button on:click={() => { adding = team.id; memberName = ''; memberEmail = '' }}
                  class="btn bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white font-semibold text-xs px-4 py-2 rounded-xl transition">
                  + add member
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
