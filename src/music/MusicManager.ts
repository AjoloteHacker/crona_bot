import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { ChildProcess, spawn } from 'child_process';
import { TextBasedChannel, VoiceBasedChannel } from 'discord.js';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import https from 'https';
import path from 'path';
import play from 'play-dl';
import { COLORS, EMOJIS } from '../utils/constants';
import { createCronaEmbed, createErrorEmbed } from '../utils/embeds';
import { parseSpotifyUrl, resolveSpotifyInput } from './SpotifyService';

if (ffmpegPath) {
  process.env.FFMPEG_PATH = ffmpegPath;
}

export interface Track {
  title: string;
  url: string;
  durationRaw: string;
  thumbnail?: string;
  requestedBy: string;
  searchQuery?: string;
}

export interface ResolvedTrackBatch {
  tracks: Track[];
  collectionTitle?: string;
  collectionUrl?: string;
  thumbnail?: string;
  isSpotify?: boolean;
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = (currentUrl: string) => {
      https
        .get(currentUrl, (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            request(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Fallo al descargar yt-dlp (HTTP ${res.statusCode})`));
            return;
          }
          const file = fs.createWriteStream(destPath);
          res.pipe(file);
          file.on('finish', () => {
            file.close(() => {
              if (process.platform !== 'win32') {
                fs.chmodSync(destPath, 0o755);
              }
              resolve();
            });
          });
          file.on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
          });
        })
        .on('error', reject);
    };
    request(url);
  });
}

let cachedYtDlpPath: string | null = null;

export async function ensureYtDlpBinary(): Promise<string> {
  if (cachedYtDlpPath && fs.existsSync(cachedYtDlpPath)) {
    return cachedYtDlpPath;
  }

  const exeName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const candidates = [
    path.resolve(process.cwd(), 'bin', exeName),
    path.resolve(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', exeName),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      cachedYtDlpPath = candidate;
      return candidate;
    }
  }

  const targetDir = path.resolve(process.cwd(), 'bin');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const targetPath = path.join(targetDir, exeName);
  const downloadUrl =
    process.platform === 'win32'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  console.log('[Música] Descargando binario de yt-dlp por primera vez...');
  await downloadFile(downloadUrl, targetPath);
  cachedYtDlpPath = targetPath;
  return targetPath;
}

function queryYtDlpJson(target: string): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      const ytdlpPath = await ensureYtDlpBinary();
      const proc = spawn(
        ytdlpPath,
        [
          target,
          '--dump-single-json',
          '--no-playlist',
          '--no-warnings',
          '--js-runtimes',
          'node',
        ],
        { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
      );

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code !== 0 || !stdout.trim()) {
          reject(new Error(stderr.trim() || `yt-dlp salió con código ${code}`));
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          const entry = Array.isArray(parsed.entries) ? parsed.entries[0] : parsed;
          resolve(entry);
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

export async function resolveTracks(
  query: string,
  requestedBy: string
): Promise<ResolvedTrackBatch | null> {
  const cleanQuery = query.trim().replace(/^<|>$/g, '');
  if (!cleanQuery) return null;

  // 1. Verificar si es enlace o URI de Spotify (canción, playlist o álbum)
  if (parseSpotifyUrl(cleanQuery)) {
    const spotifyResult = await resolveSpotifyInput(cleanQuery);
    if (!spotifyResult || spotifyResult.tracks.length === 0) return null;

    const tracks: Track[] = spotifyResult.tracks.map((t) => ({
      title: t.title,
      url: t.url,
      durationRaw: formatDuration(t.durationSec),
      thumbnail: t.thumbnail || spotifyResult.thumbnail,
      requestedBy,
      searchQuery: t.searchQuery,
    }));

    return {
      tracks,
      collectionTitle: spotifyResult.collectionTitle,
      collectionUrl: spotifyResult.collectionUrl,
      thumbnail: spotifyResult.thumbnail,
      isSpotify: true,
    };
  }

  // 2. Resolver pista única estándar (YouTube, SoundCloud, búsqueda de texto)
  const single = await resolveTrack(cleanQuery, requestedBy);
  if (!single) return null;

  return {
    tracks: [single],
    isSpotify: false,
  };
}

export async function resolveTrack(query: string, requestedBy: string): Promise<Track | null> {
  const cleanQuery = query.trim().replace(/^<|>$/g, '');
  if (!cleanQuery) return null;

  if (parseSpotifyUrl(cleanQuery)) {
    const spotifyResult = await resolveSpotifyInput(cleanQuery);
    const first = spotifyResult?.tracks?.[0];
    if (!first) return null;
    return {
      title: first.title,
      url: first.url,
      durationRaw: formatDuration(first.durationSec),
      thumbnail: first.thumbnail || spotifyResult?.thumbnail,
      requestedBy,
      searchQuery: first.searchQuery,
    };
  }

  const isUrl = /^https?:\/\//i.test(cleanQuery);

  if (isUrl) {
    // 1. Intentar obtener metadatos rápido con play-dl si es enlace de YouTube
    try {
      const info = await play.video_basic_info(cleanQuery);
      const details = info.video_details;
      if (details && details.url) {
        return {
          title: details.title || 'Canción sin título',
          url: details.url,
          durationRaw: details.durationRaw || formatDuration(details.durationInSec),
          thumbnail: details.thumbnails?.[0]?.url,
          requestedBy,
        };
      }
    } catch {
      // Si falla play-dl (ej. SoundCloud, Shorts, enlaces especiales), usar yt-dlp
    }

    // 2. Respaldo con yt-dlp para cualquier URL válida
    const data = await queryYtDlpJson(cleanQuery);
    if (!data) return null;

    return {
      title: data.title || 'Canción sin título',
      url: data.webpage_url || data.original_url || cleanQuery,
      durationRaw: data.duration_string || formatDuration(data.duration),
      thumbnail: data.thumbnail || data.thumbnails?.[0]?.url,
      requestedBy,
    };
  }

  // Búsqueda por nombre de canción
  try {
    const results = await play.search(cleanQuery, {
      limit: 1,
      source: { youtube: 'video' },
    });

    if (results && results.length > 0 && results[0].url) {
      const video = results[0];
      return {
        title: video.title || 'Canción sin título',
        url: video.url,
        durationRaw: video.durationRaw || formatDuration(video.durationInSec),
        thumbnail: video.thumbnails?.[0]?.url,
        requestedBy,
      };
    }
  } catch {
    // Respaldo con yt-dlp si play.search falla
  }

  const data = await queryYtDlpJson(`ytsearch1:${cleanQuery}`);
  if (!data) return null;

  return {
    title: data.title || 'Canción sin título',
    url: data.webpage_url || data.url || `https://www.youtube.com/watch?v=${data.id}`,
    durationRaw: data.duration_string || formatDuration(data.duration),
    thumbnail: data.thumbnail || data.thumbnails?.[0]?.url,
    requestedBy,
  };
}

async function resolveStreamTarget(track: Track): Promise<string> {
  if (!track.searchQuery && !parseSpotifyUrl(track.url)) {
    return track.url;
  }

  const searchTerm = track.searchQuery || `${track.title} audio`;
  try {
    const results = await play.search(searchTerm, {
      limit: 1,
      source: { youtube: 'video' },
    });
    if (results && results.length > 0 && results[0].url) {
      if (!track.durationRaw || track.durationRaw === '0:00') {
        track.durationRaw =
          results[0].durationRaw || formatDuration(results[0].durationInSec);
      }
      return results[0].url;
    }
  } catch {
    // Usar búsqueda directa en yt-dlp
  }

  return `ytsearch1:${searchTerm}`;
}

export class GuildMusicQueue {
  public readonly guildId: string;
  public connection: VoiceConnection | null = null;
  public player: AudioPlayer;
  public tracks: Track[] = [];
  public currentTrack: Track | null = null;
  public textChannel: TextBasedChannel | null = null;
  public volume = 80;
  private activeProcesses: ChildProcess[] = [];

  constructor(guildId: string) {
    this.guildId = guildId;
    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.killActiveProcesses();
      this.playNext();
    });

    this.player.on('error', (error) => {
      console.error(`[Música] Error en reproductor (${this.guildId}):`, error.message);
      this.killActiveProcesses();
      this.playNext();
    });
  }

  private killActiveProcesses(): void {
    while (this.activeProcesses.length > 0) {
      const proc = this.activeProcesses.pop();
      if (proc && !proc.killed) {
        try {
          proc.kill();
        } catch {
          // Ignorar errores al cerrar proceso
        }
      }
    }
  }

  public isConnected(): boolean {
    return (
      this.connection !== null &&
      this.connection.state.status !== VoiceConnectionStatus.Destroyed &&
      this.connection.state.status !== VoiceConnectionStatus.Disconnected
    );
  }

  public async connect(voiceChannel: VoiceBasedChannel): Promise<void> {
    if (this.connection) {
      try {
        this.connection.destroy();
      } catch {
        // Ignorar
      }
      this.connection = null;
    }

    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
      selfDeaf: true,
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (!this.connection) return;
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.stop();
      }
    });

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 15_000);
      this.connection.subscribe(this.player);
    } catch (err) {
      this.connection.destroy();
      this.connection = null;
      throw err;
    }
  }

  public async playNext(): Promise<void> {
    this.killActiveProcesses();

    const nextTrack = this.tracks.shift();
    if (!nextTrack) {
      this.currentTrack = null;
      if (this.textChannel && 'send' in this.textChannel) {
        const embed = createCronaEmbed(COLORS.SECONDARY).setDescription(
          `${EMOJIS.MUSIC} La cola de reproducción ha terminado. Me iré a mi esquina en silencio...`
        );
        await this.textChannel.send({ embeds: [embed] }).catch(() => null);
      }
      return;
    }

    this.currentTrack = nextTrack;
    try {
      const ytdlpPath = await ensureYtDlpBinary();
      const ffmpegBin = ffmpegPath || 'ffmpeg';
      const streamTarget = await resolveStreamTarget(nextTrack);

      const ytdlpProc = spawn(
        ytdlpPath,
        [
          streamTarget,
          '-o',
          '-',
          '-q',
          '--no-warnings',
          '-f',
          'bestaudio[acodec=opus]/bestaudio/best',
          '--no-playlist',
          '--js-runtimes',
          'node',
        ],
        { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
      );

      const ffmpegProc = spawn(
        ffmpegBin,
        [
          '-i',
          'pipe:0',
          '-analyzeduration',
          '0',
          '-loglevel',
          '0',
          '-f',
          's16le',
          '-ar',
          '48000',
          '-ac',
          '2',
          'pipe:1',
        ],
        { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true }
      );

      this.activeProcesses.push(ytdlpProc, ffmpegProc);

      // Evitar cierres inesperados de tubería (EPIPE / EOF) al saltar o detener canciones
      ytdlpProc.stdout.on('error', () => {});
      ffmpegProc.stdin.on('error', () => {});
      ffmpegProc.stdout.on('error', () => {});
      ytdlpProc.on('error', (err) => {
        console.error('[Música] Error en yt-dlp:', err.message);
      });
      ffmpegProc.on('error', (err) => {
        console.error('[Música] Error en ffmpeg:', err.message);
      });

      ytdlpProc.stdout.pipe(ffmpegProc.stdin);
      ytdlpProc.on('close', () => {
        if (!ffmpegProc.stdin.destroyed) {
          ffmpegProc.stdin.end();
        }
      });

      const resource = createAudioResource(ffmpegProc.stdout, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });
      resource.volume?.setVolume(this.volume / 100);
      this.player.play(resource);

      if (this.textChannel && 'send' in this.textChannel) {
        const embed = createCronaEmbed(COLORS.PRIMARY)
          .setTitle(`${EMOJIS.MUSIC} Reproduciendo ahora`)
          .setDescription(`**[${nextTrack.title}](${nextTrack.url})**`)
          .addFields(
            { name: '⏱️ Duración', value: `\`${nextTrack.durationRaw}\``, inline: true },
            { name: '🎧 Pedido por', value: nextTrack.requestedBy, inline: true }
          );
        if (nextTrack.thumbnail) {
          embed.setThumbnail(nextTrack.thumbnail);
        }
        await this.textChannel.send({ embeds: [embed] }).catch(() => null);
      }
    } catch (err) {
      console.error('[Música] Error al transmitir pista:', err);
      this.killActiveProcesses();
      if (this.textChannel && 'send' in this.textChannel) {
        await this.textChannel
          .send({
            embeds: [
              createErrorEmbed(
                `No pude reproducir **${nextTrack.title}**. Saltando a la siguiente pista...`
              ),
            ],
          })
          .catch(() => null);
      }
      this.playNext();
    }
  }

  public stop(): void {
    this.tracks = [];
    this.currentTrack = null;
    this.killActiveProcesses();
    this.player.stop(true);
    if (this.connection) {
      try {
        this.connection.destroy();
      } catch {
        // Ignorar
      }
      this.connection = null;
    }
  }
}

class MusicManager {
  private queues = new Map<string, GuildMusicQueue>();

  public getQueue(guildId: string): GuildMusicQueue {
    let q = this.queues.get(guildId);
    if (!q) {
      q = new GuildMusicQueue(guildId);
      this.queues.set(guildId, q);
    }
    return q;
  }

  public deleteQueue(guildId: string): void {
    const q = this.queues.get(guildId);
    if (q) {
      q.stop();
      this.queues.delete(guildId);
    }
  }
}

export const musicManager = new MusicManager();
