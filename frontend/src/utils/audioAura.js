const GENRE_KEYWORDS = [
  { name: 'Ambient & Drone', keywords: ['ambient', 'drone', 'chill', 'floating', 'eno', 'burial'] },
  { name: 'Electronic / Club', keywords: ['electronic', 'techno', 'house', 'electro', 'garage', 'dance', 'synth', 'kavinsky', 'aphex', 'daft punk'] },
  { name: 'Hip Hop & Beats', keywords: ['hip hop', 'rap', 'trap', 'nas', 'kendrick', 'drake', 'beat', 'lo-fi'] },
  { name: 'Indie & R&B', keywords: ['r&b', 'soul', 'indie', 'frank ocean', 'joji', 'weeknd', 'neo-soul'] },
  { name: 'Alternative Cuts', keywords: ['rock', 'alternative', 'shoegaze', 'post-rock', 'cocteau'] },
];

export function deriveAudioAura(history, likedSongs, followedArtists) {
  const counts = {};
  let total = 0;

  for (const a of followedArtists || []) {
    if (a.genre) {
      counts[a.genre] = (counts[a.genre] || 0) + 3;
      total += 3;
    }
  }

  const allTracks = [...(history || []), ...(likedSongs || [])];
  for (const t of allTracks) {
    const text = `${t.artist || ''} ${t.title || ''} ${t.album || ''}`.toLowerCase();
    let matched = false;
    for (const g of GENRE_KEYWORDS) {
      if (g.keywords.some((k) => text.includes(k))) {
        counts[g.name] = (counts[g.name] || 0) + 1;
        total += 1;
        matched = true;
        break;
      }
    }
    if (!matched && t.artist && t.artist !== 'Unknown Artist') {
      const cat = `${t.artist} Radio`;
      counts[cat] = (counts[cat] || 0) + 1;
      total += 1;
    }
  }

  if (total === 0) return [];

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count], index) => ({
      rank: index + 1,
      name,
      percent: `${Math.round((count / total) * 100)}%`,
    }));
}

