export type AnimeGifCategory =
  | 'hug'
  | 'pat'
  | 'slap'
  | 'kiss'
  | 'cry'
  | 'cuddle'
  | 'poke'
  | 'bite'
  | 'dance'
  | 'blush'
  | 'laugh'
  | 'highfive'
  | 'wave'
  | 'kill';

const FALLBACK_GIFS: Record<string, string[]> = {
  hug: [
    'https://nekos.best/api/v2/hug/001.gif',
    'https://media.tenor.com/kCZjTqCKiggAAAAC/hug.gif',
  ],
  pat: [
    'https://nekos.best/api/v2/pat/001.gif',
    'https://media.tenor.com/E6fMkQRZBdIAAAAC/kanna-kamui-pat.gif',
  ],
  slap: [
    'https://nekos.best/api/v2/slap/001.gif',
    'https://media.tenor.com/XiYuU9h44-AAAAAC/anime-slap-mad.gif',
  ],
  kiss: [
    'https://nekos.best/api/v2/kiss/001.gif',
    'https://media.tenor.com/F02Ep3b2jJgAAAAC/cute-kawai.gif',
  ],
  cry: [
    'https://nekos.best/api/v2/cry/001.gif',
    'https://media.tenor.com/2tF2_b2V4pUAAAAC/crona-soul-eater.gif',
  ],
  cuddle: [
    'https://nekos.best/api/v2/cuddle/001.gif',
    'https://media.tenor.com/ch177TOxlk8AAAAC/anime-cuddle.gif',
  ],
  poke: [
    'https://nekos.best/api/v2/poke/001.gif',
    'https://media.tenor.com/1Y8N2h3K1NAAAAAC/anime-poke.gif',
  ],
  bite: [
    'https://nekos.best/api/v2/bite/001.gif',
    'https://media.tenor.com/5mVQ3ffW8sEAAAAC/anime-bite.gif',
  ],
  dance: [
    'https://nekos.best/api/v2/dance/001.gif',
    'https://media.tenor.com/2v1aDCelTJgAAAAC/anime-dance.gif',
  ],
  blush: [
    'https://nekos.best/api/v2/blush/001.gif',
    'https://media.tenor.com/8fU6gH4u2z0AAAAC/anime-blush.gif',
  ],
  kill: [
    'https://media.tenor.com/1dtHuFICZF4AAAAC/kill-smack.gif',
    'https://nekos.best/api/v2/slap/002.gif',
  ],
};

export interface AnimeGifResult {
  url: string;
  animeName?: string;
}

/**
 * Obtiene un GIF de anime para comandos de interacción estilo Chocolat.
 * Consulta nekos.best primero (que incluye el nombre del anime) y waifu.pics como respaldo.
 */
export async function fetchAnimeGif(category: string): Promise<AnimeGifResult> {
  const nekosEndpoint = category === 'kill' ? 'punch' : category;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`https://nekos.best/api/v2/${nekosEndpoint}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as {
        results?: { url: string; anime_name?: string }[];
      };
      if (data.results && data.results.length > 0) {
        return {
          url: data.results[0].url,
          animeName: data.results[0].anime_name,
        };
      }
    }
  } catch {
    // Continúa al siguiente proveedor
  }

  try {
    const normalizedCategory = category.toLowerCase();
    const waifuCategory = normalizedCategory === 'laugh' ? 'smile' : normalizedCategory;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`https://api.waifu.pics/sfw/${waifuCategory}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        return { url: data.url };
      }
    }
  } catch {
    // Continúa al fallback local
  }

  const list = FALLBACK_GIFS[category] || FALLBACK_GIFS.hug;
  const url = list[Math.floor(Math.random() * list.length)];
  return { url, animeName: 'Soul Eater / Anime' };
}
