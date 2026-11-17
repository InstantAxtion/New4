// Realm talents: five branches of three, taken in order.
// Pure data: no game state or logic lives here, so new content can be added by editing tables.
// ---------------- realm talents ----------------
// A point each time the realm grows a tier, and more as its prestige spreads.
export const TALENTS = [
  { branch: 'Steward', icon: '🌾', nodes: [['bounty', 'Bountiful Harvests', '+15% food.'], ['feast', 'Full Tables', 'Towns grow 20% faster while the stores hold plenty of food.'], ['granary', 'Great Granaries', 'Fields keep giving a little in winter (+25% winter harvest).']] },
  { branch: 'Builder', icon: '🔨', nodes: [['quick', 'Quick Hands', 'Build 20% faster.'], ['crews', 'Extra Crews', '+1 builder crew in every town.'], ['grand', 'Grand Designs', 'Wonders go up 40% faster.']] },
  { branch: 'Merchant', icon: '💰', nodes: [['coin', 'Sharp Ledgers', '+10% gold.'], ['friends', 'Warm Welcome', 'Gifts make 50% more friendship.'], ['roads', 'Busy Roads', 'Caravans earn twice as much.']] },
  { branch: 'Patron', icon: '🎓', nodes: [['teach', 'Patron of Learning', 'Skills and knowledge grow 15% faster.'], ['joy', 'Bustling Towns', 'Families settle 20% faster.'], ['fame', 'Far-famed', '+25% prestige.']] },
  { branch: 'Explorer', icon: '🧭', nodes: [['scout', 'Pathfinders', 'Explorers travel 30% faster.'], ['border', 'Wide Lands', 'Every border reaches 2 tiles further.'], ['settler', 'Eager Settlers', 'New settlements cost half as much.']] },
];
