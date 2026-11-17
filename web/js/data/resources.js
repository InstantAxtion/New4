// Resources and goods.
// Pure data: no game state or logic lives here, so new content can be added by editing tables.
export const RES = ['food', 'wood', 'stone', 'gold', 'iron'];
export const RES_NAMES = { food: 'Food', wood: 'Wood', stone: 'Stone', gold: 'Gold', iron: 'Iron', bread: 'Bread', tools: 'Tools', cloth: 'Cloth', ale: 'Ale & wine', pottery: 'Pottery', glass: 'Glass', spices: 'Spices', books: 'Books', flour: 'Flour', wool: 'Wool' };
// Goods are made from basic resources in simple one-step workshops.
export const GOODS = ['bread', 'tools', 'cloth', 'ale', 'pottery', 'glass', 'spices', 'books', 'flour', 'wool'];
export const ALL_RES = [...RES, ...GOODS];
