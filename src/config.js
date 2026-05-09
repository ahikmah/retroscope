export const TEMPLATES = [
  {
    id: '4ls',
    name: '4Ls',
    desc: 'Liked · Learned · Lacked · Longed For',
    columns: [
      { id: 'liked',   label: 'Liked',      hint: 'what went well? what made you happy?',           note: 'note-liked',   col: 'col-liked',   accent: '#4ade80', paper: '#d1fae5' },
      { id: 'learned', label: 'Learned',    hint: 'what new things did you learn or discover?',     note: 'note-learned', col: 'col-learned', accent: '#60a5fa', paper: '#dbeafe' },
      { id: 'lacked',  label: 'Lacked',     hint: 'what was missing? what slowed you down?',        note: 'note-lacked',  col: 'col-lacked',  accent: '#fb923c', paper: '#ffedd5' },
      { id: 'longed',  label: 'Longed For', hint: 'what do you wish you had? what would help?',     note: 'note-longed',  col: 'col-longed',  accent: '#c084fc', paper: '#ede9fe' },
    ],
  },
  {
    id: 'ssc',
    name: 'Start · Stop · Continue',
    desc: 'What should we start, stop, and keep doing?',
    columns: [
      { id: 'start',    label: 'Start',    hint: 'what should we begin doing that we are not?',     note: 'note-liked',   col: 'col-liked',   accent: '#4ade80', paper: '#d1fae5' },
      { id: 'stop',     label: 'Stop',     hint: 'what is hurting us? what should we drop?',        note: 'note-lacked',  col: 'col-lacked',  accent: '#fb923c', paper: '#ffedd5' },
      { id: 'continue', label: 'Continue', hint: 'what is working well that we should keep up?',    note: 'note-learned', col: 'col-learned', accent: '#60a5fa', paper: '#dbeafe' },
    ],
  },
  {
    id: 'msg',
    name: 'Mad · Sad · Glad',
    desc: 'Feelings-first retrospective',
    columns: [
      { id: 'mad',  label: 'Mad',  hint: 'what frustrated or annoyed you this sprint?',             note: 'note-lacked',  col: 'col-lacked',  accent: '#fb923c', paper: '#ffedd5' },
      { id: 'sad',  label: 'Sad',  hint: 'what disappointed you? what felt like a loss?',           note: 'note-longed',  col: 'col-longed',  accent: '#c084fc', paper: '#ede9fe' },
      { id: 'glad', label: 'Glad', hint: 'what made you happy or proud this sprint?',               note: 'note-liked',   col: 'col-liked',   accent: '#4ade80', paper: '#d1fae5' },
    ],
  },
  {
    id: 'sailboat',
    name: 'Sailboat',
    desc: 'Wind · Anchor · Rocks · Island',
    columns: [
      { id: 'wind',   label: 'Wind',   hint: 'what pushed us forward? what gave us momentum?',      note: 'note-liked',   col: 'col-liked',   accent: '#4ade80', paper: '#d1fae5' },
      { id: 'anchor', label: 'Anchor', hint: 'what slowed us down or held us back?',                note: 'note-lacked',  col: 'col-lacked',  accent: '#fb923c', paper: '#ffedd5' },
      { id: 'rocks',  label: 'Rocks',  hint: 'what risks or obstacles are ahead?',                  note: 'note-longed',  col: 'col-longed',  accent: '#c084fc', paper: '#ede9fe' },
      { id: 'island', label: 'Island', hint: 'what is our goal? what are we sailing towards?',      note: 'note-learned', col: 'col-learned', accent: '#60a5fa', paper: '#dbeafe' },
    ],
  },
  {
    id: 'www',
    name: 'WWW',
    desc: 'Worked Well · Wished · What If',
    columns: [
      { id: 'worked', label: 'Worked Well', hint: 'what actually went well this time around?',      note: 'note-liked',   col: 'col-liked',   accent: '#4ade80', paper: '#d1fae5' },
      { id: 'wished', label: 'Wished',      hint: 'what do you wish had gone differently?',         note: 'note-lacked',  col: 'col-lacked',  accent: '#fb923c', paper: '#ffedd5' },
      { id: 'whatif', label: 'What If',     hint: 'crazy ideas welcome. what if we tried…?',        note: 'note-longed',  col: 'col-longed',  accent: '#c084fc', paper: '#ede9fe' },
    ],
  },
  {
    id: 'kalm',
    name: 'KALM',
    desc: 'Keep · Add · Less · More',
    columns: [
      { id: 'keep', label: 'Keep', hint: 'what is working well that we should protect?',            note: 'note-liked',   col: 'col-liked',   accent: '#4ade80', paper: '#d1fae5' },
      { id: 'add',  label: 'Add',  hint: 'what new practice or tool should we introduce?',          note: 'note-learned', col: 'col-learned', accent: '#60a5fa', paper: '#dbeafe' },
      { id: 'less', label: 'Less', hint: 'what should we do less of? what is draining us?',         note: 'note-lacked',  col: 'col-lacked',  accent: '#fb923c', paper: '#ffedd5' },
      { id: 'more', label: 'More', hint: 'what is good but needs more attention or effort?',        note: 'note-longed',  col: 'col-longed',  accent: '#c084fc', paper: '#ede9fe' },
    ],
  },
]

export const DEFAULT_TEMPLATE = TEMPLATES[0]

export const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`

export function cardRotation(id) {
  const n = parseInt((id || '0').slice(-2), 16)
  return ['-2.5','-1.5','-0.8','0','0.8','1.5','2.5'][n % 7]
}

export function avatarIndex(id) {
  return parseInt((id || '0').slice(-1), 16) % 8
}

// Dynamic grid class based on column count
export function gridClass(n) {
  if (n <= 2) return 'md:grid-cols-2'
  if (n === 3) return 'md:grid-cols-3'
  return 'md:grid-cols-2 xl:grid-cols-4'
}
