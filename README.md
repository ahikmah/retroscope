# Retroscope

a retro tool for teams that actually want to talk.
not just tick a box. not just go through the motions.

built because most retro tools are either overkill or soulless.
this one tries to be neither.

---

## what it does

runs your team through a structured retrospective — from silent writing to live voting to a summary nobody will act on but at least you said it out loud.

**phases:**

1. **lobby** — facilitator sets the session name, picks a template, shares a 4-char code. everyone joins.
2. **write** — cards written privately. no peeking. 5 minutes of honest thoughts.
3. **reveal** — all cards flip at once. now you see what everyone actually thinks.
4. **vote** — 3 votes per person. not on your own cards. democracy, sort of.
5. **bottle** — optional. send an anonymous (or signed) message to a teammate. say the thing you never say.
6. **summary** — top cards per column. markdown export for the doc nobody opens.

---

## templates

- **4Ls** — Liked, Learned, Lacked, Longed For
- **SSC** — Start, Stop, Continue
- **Mad / Sad / Glad**
- **Sailboat** — Wind, Anchor, Rocks, Island
- **WWW** — Worked Well, Wished, What If
- **KALM** — Keep, Add, Less, More

---

## stack

| | |
|---|---|
| frontend | Svelte 4 + Vite + Tailwind |
| backend | Node.js + WebSockets |
| db | SQLite (session history) |
| ocean | Three.js (it's a whole thing) |

---

## run it

```bash
make install
make dev
```

backend on `:3000`. frontend on `:5274`.

---

## project structure

```
retroscope/
├── server.js              # ws + rest api. the whole backend.
├── src/
│   ├── App.svelte         # phase router
│   ├── store.js           # shared state
│   ├── ws.js              # websocket client
│   ├── config.js          # templates & column definitions
│   ├── phases/            # one component per phase
│   └── components/
│       └── OceanBottle.svelte   # the ocean. yes it's a real ocean.
```

---

## contributing

PRs welcome. no formal process. just don't break the ocean.

if you've got an idea — new template, better animations, a phase we haven't thought of — open an issue and let's talk. or just send a PR. we'll figure it out.

the only real rule: keep the vibe. this tool should feel human, not corporate.

---

*and nothing will change. probably. but good effort.*
