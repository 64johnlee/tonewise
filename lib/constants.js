export const TOPICS = [
  { id: "restaurant", label: "Restaurant", desc: "ordering food and drinks at a Chinese restaurant" },
  { id: "shopping", label: "Shopping", desc: "buying clothes or items at a market or shop" },
  { id: "travel", label: "Travel", desc: "asking for directions, buying tickets, checking into a hotel" },
  { id: "work", label: "Work", desc: "a work meeting introduction or discussing a project" },
  { id: "friends", label: "Making Friends", desc: "meeting someone new and making small talk" },
  { id: "doctor", label: "Doctor", desc: "describing symptoms to a doctor at a clinic" },
];
export const HSK_LEVELS = {
  HSK1: "absolute beginner (150 words). Use very simple sentences only.",
  HSK2: "beginner (300 words). Simple sentences, common daily topics.",
  HSK3: "elementary (600 words). Can handle most daily situations.",
  HSK4: "intermediate (1200 words). Can discuss abstract topics.",
  HSK5: "upper-intermediate (2500 words). Newspapers and films.",
  HSK6: "advanced (5000+ words). Near-native fluency.",
};
export const FREE_LIMIT = 3;
export const DEFAULT_LEVEL = "HSK2";
export const MAX_REVIEW_WORDS_PER_TURN = 5;
export function topicDesc(id) {
  const t = TOPICS.find((x) => x.id === id);
  return (t || TOPICS[0]).desc;
}
export function levelDesc(level) {
  return HSK_LEVELS[level] || HSK_LEVELS[DEFAULT_LEVEL];
}
