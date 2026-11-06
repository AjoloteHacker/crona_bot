export interface SpotifyResolvedTrack {
  title: string;
  url: string;
  durationSec: number;
  thumbnail?: string;
  searchQuery: string;
}

export interface SpotifyResolvedResult {
  type: 'track' | 'playlist' | 'album';
  collectionTitle?: string;
  collectionUrl?: string;
  thumbnail?: string;
  tracks: SpotifyResolvedTrack[];
}

export interface ParsedSpotifyUrl {
  type: 'track' | 'playlist' | 'album';
  id: string;
  cleanUrl: string;
}

const SPOTIFY_URL_REGEX =
  /^(?:https?:\/\/open\.spotify\.com\/(?:intl-[a-zA-Z-]+\/)?(track|playlist|album)\/([a-zA-Z0-9]+)|spotify:(track|playlist|album):([a-zA-Z0-9]+))/i;

export function parseSpotifyUrl(input: string): ParsedSpotifyUrl | null {
  const trimmed = input.trim().replace(/^<|>$/g, '');
  const match = trimmed.match(SPOTIFY_URL_REGEX);
  if (!match) return null;

  const type = (match[1] || match[3]).toLowerCase() as 'track' | 'playlist' | 'album';
  const id = match[2] || match[4];

  return {
    type,
    id,
    cleanUrl: `https://open.spotify.com/${type}/${id}`,
  };
}

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

function hasSpotifyCredentials(): boolean {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  return Boolean(
    clientId &&
      clientSecret &&
      clientId !== 'tu_spotify_client_id' &&
      clientSecret !== 'tu_spotify_client_secret'
  );
}

async function getSpotifyAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!.trim();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Error al autenticar con Spotify API (HTTP ${response.status})`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + Math.max((data.expires_in - 60) * 1000, 60_000);
  return cachedAccessToken;
}

async function fetchSpotifyApi<T>(endpoint: string): Promise<T> {
  const token = await getSpotifyAccessToken();
  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify API respondió con HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

async function resolveViaOfficialApi(parsed: ParsedSpotifyUrl): Promise<SpotifyResolvedResult> {
  if (parsed.type === 'track') {
    const data = await fetchSpotifyApi<any>(`/tracks/${parsed.id}`);
    const artists = Array.isArray(data.artists)
      ? data.artists.map((a: any) => a.name).join(', ')
      : 'Artista desconocido';
    const trackName = data.name || 'Canción sin título';
    const fullTitle = `${artists} - ${trackName}`;
    const thumbnail = data.album?.images?.[0]?.url;
    const durationSec = Math.round((data.duration_ms || 0) / 1000);
    const url = data.external_urls?.spotify || parsed.cleanUrl;

    return {
      type: 'track',
      thumbnail,
      tracks: [
        {
          title: fullTitle,
          url,
          durationSec,
          thumbnail,
          searchQuery: `${fullTitle} audio`,
        },
      ],
    };
  }

  if (parsed.type === 'album') {
    const data = await fetchSpotifyApi<any>(`/albums/${parsed.id}`);
    const albumName = data.name || 'Álbum de Spotify';
    const thumbnail = data.images?.[0]?.url;
    const items: any[] = data.tracks?.items || [];

    const tracks: SpotifyResolvedTrack[] = items
      .filter((item) => item && item.name)
      .slice(0, 50)
      .map((item) => {
        const artists = Array.isArray(item.artists)
          ? item.artists.map((a: any) => a.name).join(', ')
          : 'Artista desconocido';
        const fullTitle = `${artists} - ${item.name}`;
        const url =
          item.external_urls?.spotify ||
          (item.id ? `https://open.spotify.com/track/${item.id}` : parsed.cleanUrl);
        return {
          title: fullTitle,
          url,
          durationSec: Math.round((item.duration_ms || 0) / 1000),
          thumbnail,
          searchQuery: `${fullTitle} audio`,
        };
      });

    return {
      type: 'album',
      collectionTitle: albumName,
      collectionUrl: data.external_urls?.spotify || parsed.cleanUrl,
      thumbnail,
      tracks,
    };
  }

  // Playlist
  const data = await fetchSpotifyApi<any>(`/playlists/${parsed.id}`);
  const playlistName = data.name || 'Playlist de Spotify';
  const thumbnail = data.images?.[0]?.url;
  const items: any[] = data.tracks?.items || [];

  const tracks: SpotifyResolvedTrack[] = items
    .map((entry) => entry?.track)
    .filter((track) => track && track.name && !track.is_local)
    .slice(0, 50)
    .map((track) => {
      const artists = Array.isArray(track.artists)
        ? track.artists.map((a: any) => a.name).join(', ')
        : 'Artista desconocido';
      const fullTitle = `${artists} - ${track.name}`;
      const trackThumb = track.album?.images?.[0]?.url || thumbnail;
      const url =
        track.external_urls?.spotify ||
        (track.id ? `https://open.spotify.com/track/${track.id}` : parsed.cleanUrl);
      return {
        title: fullTitle,
        url,
        durationSec: Math.round((track.duration_ms || 0) / 1000),
        thumbnail: trackThumb,
        searchQuery: `${fullTitle} audio`,
      };
    });

  return {
    type: 'playlist',
    collectionTitle: playlistName,
    collectionUrl: data.external_urls?.spotify || parsed.cleanUrl,
    thumbnail,
    tracks,
  };
}

async function resolveViaPublicEmbed(parsed: ParsedSpotifyUrl): Promise<SpotifyResolvedResult> {
  const embedUrl = `https://open.spotify.com/embed/${parsed.type}/${parsed.id}`;
  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });

  if (response.ok) {
    const html = await response.text();
    const nextDataMatch = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
    );

    if (nextDataMatch && nextDataMatch[1]) {
      const json = JSON.parse(nextDataMatch[1]);
      const entity = json?.props?.pageProps?.state?.data?.entity;

      if (entity) {
        const images =
          entity.visualIdentity?.image ||
          entity.coverArt?.sources ||
          [];
        const thumbnail = Array.isArray(images) && images.length > 0
          ? images[images.length - 1]?.url || images[0]?.url
          : undefined;

        if (parsed.type === 'track') {
          const title = entity.title || entity.name || 'Canción de Spotify';
          const artists = Array.isArray(entity.artists)
            ? entity.artists.map((a: any) => a.name).join(', ')
            : entity.subtitle || '';
          const fullTitle = artists ? `${artists} - ${title}` : title;
          const durationSec = Math.round((entity.duration || 0) / 1000);

          return {
            type: 'track',
            thumbnail,
            tracks: [
              {
                title: fullTitle,
                url: parsed.cleanUrl,
                durationSec,
                thumbnail,
                searchQuery: `${fullTitle} audio`,
              },
            ],
          };
        }

        // Playlist o Álbum desde Embed
        const collectionTitle = entity.name || entity.title || 'Colección de Spotify';
        const trackList: any[] = entity.trackList || [];
        const tracks: SpotifyResolvedTrack[] = trackList.slice(0, 50).map((item) => {
          const tName = item.title || 'Canción';
          const tArtist = (item.subtitle || '').replace(/\u00a0/g, ' ').trim();
          const fullTitle = tArtist ? `${tArtist} - ${tName}` : tName;
          const trackIdMatch = typeof item.uri === 'string' ? item.uri.split(':').pop() : null;
          const trackUrl = trackIdMatch
            ? `https://open.spotify.com/track/${trackIdMatch}`
            : parsed.cleanUrl;

          return {
            title: fullTitle,
            url: trackUrl,
            durationSec: Math.round((item.duration || 0) / 1000),
            thumbnail,
            searchQuery: `${fullTitle} audio`,
          };
        });

        if (tracks.length > 0) {
          return {
            type: parsed.type,
            collectionTitle,
            collectionUrl: parsed.cleanUrl,
            thumbnail,
            tracks,
          };
        }
      }
    }
  }

  // Último respaldo con oEmbed oficial de Spotify
  const oembedRes = await fetch(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(parsed.cleanUrl)}`
  );
  if (!oembedRes.ok) {
    throw new Error('No se pudo obtener información del enlace de Spotify.');
  }
  const oembed = (await oembedRes.json()) as { title?: string; thumbnail_url?: string };
  const title = oembed.title || 'Canción de Spotify';

  return {
    type: parsed.type,
    collectionTitle: parsed.type !== 'track' ? title : undefined,
    collectionUrl: parsed.cleanUrl,
    thumbnail: oembed.thumbnail_url,
    tracks: [
      {
        title,
        url: parsed.cleanUrl,
        durationSec: 0,
        thumbnail: oembed.thumbnail_url,
        searchQuery: `${title} audio`,
      },
    ],
  };
}

export async function resolveSpotifyInput(
  input: string
): Promise<SpotifyResolvedResult | null> {
  const parsed = parseSpotifyUrl(input);
  if (!parsed) return null;

  if (hasSpotifyCredentials()) {
    try {
      return await resolveViaOfficialApi(parsed);
    } catch (err) {
      console.warn(
        '[Spotify] Falló la consulta con credenciales de API, usando extractor alternativo:',
        (err as Error).message
      );
    }
  }

  return resolveViaPublicEmbed(parsed);
}
