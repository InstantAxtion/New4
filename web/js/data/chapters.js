// Goal chapters: the goals (by id, see QUESTS in game.js) and the reward for finishing each chapter.
// Pure data: no game state or logic lives here, so new content can be added by editing tables.
// Goals come in chapters, each with its own reward at the end.
export const CHAPTERS = [
  { id: 'c1', icon: '🌱', name: 'A Humble Start', goals: ['farm1', 'house1', 'lumber', 'pop15', 'quarry', 'well', 'granary'], reward: { gold: 40, wood: 40 } },
  { id: 'c2', icon: '🏘️', name: 'Village Life', goals: ['trade', 'village', 'research1', 'yard', 'wedding', 'specialty'], reward: { gold: 80, food: 80 } },
  { id: 'c3', icon: '🌳', name: 'Growing Roots', goals: ['spec', 'bread', 'stable', 'tower', 'found', 'mine', 'gift', 'talent1'], reward: { gold: 120, stone: 80 } },
  { id: 'c4', icon: '🏪', name: 'A Market Town', goals: ['town', 'workshop3', 'market', 'tools', 'flour', 'level2', 'contract1', 'fame1'], reward: { gold: 200, iron: 40 } },
  { id: 'c5', icon: '⭐', name: 'Masters and Harbours', goals: ['master', 'join', 'harbour', 'charm1', 'research10'], reward: { gold: 300 } },
  { id: 'c6', icon: '🏛️', name: 'City of Wonders', goals: ['wonder1', 'city', 'newwonder', 'route1', 'cont3', 'research25'], reward: { gold: 500, iron: 80 } },
  { id: 'c7', icon: '👑', name: 'Kingdom and Beyond', goals: ['kingdom', 'charm5', 'routes5', 'wonders', 'cont6', 'empire'], reward: { gold: 1500 } },
];
