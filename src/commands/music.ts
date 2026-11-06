import { SlashCommandBuilder } from 'discord.js';
import { CronaCommand } from '../types/command';
import { musicManager, resolveTracks } from '../music/MusicManager';
import { COLORS, EMOJIS } from '../utils/constants';
import { createCronaEmbed, createErrorEmbed, createSuccessEmbed } from '../utils/embeds';

export const musicCommands: CronaCommand[] = [
  {
    name: 'play',
    aliases: ['p', 'reproducir', 'musica'],
    description: 'Reproduce música en tu canal de voz por nombre o enlace (YouTube, Spotify, SoundCloud)',
    category: 'Música',
    usage: 'play <canción o URL de Spotify/YouTube>',
    slashData: new SlashCommandBuilder()
      .setName('play')
      .setDescription('Reproduce música por nombre o enlace (YouTube, Spotify, SoundCloud)')
      .addStringOption((opt) =>
        opt
          .setName('busqueda')
          .setDescription('Nombre de la canción o URL de Spotify / YouTube / SoundCloud')
          .setRequired(true)
      ),
    execute: async (ctx) => {
      if (!ctx.guild || !ctx.member) {
        await ctx.reply({ embeds: [createErrorEmbed('Este comando solo funciona en servidores.')] });
        return;
      }

      const voiceChannel = ctx.member.voice.channel;
      if (!voiceChannel) {
        await ctx.reply({
          embeds: [
            createErrorEmbed('Debes unirte a un canal de voz primero para que pueda cantar...'),
          ],
        });
        return;
      }

      const query = ctx.getString('busqueda', 0, true);
      if (!query) {
        await ctx.reply({
          embeds: [createErrorEmbed(`Indica el nombre o URL de una canción: \`${ctx.prefix}play <canción>\``)],
        });
        return;
      }

      if (ctx.isSlash && ctx.interaction && !ctx.interaction.deferred) {
        await ctx.interaction.deferReply();
      }

      try {
        const requestedBy = ctx.author.displayName || ctx.author.username;
        const batch = await resolveTracks(query, requestedBy);

        if (!batch || batch.tracks.length === 0) {
          await ctx.reply({
            embeds: [createErrorEmbed(`No encontré ningún resultado para **${query}**...`)],
          });
          return;
        }

        const queue = musicManager.getQueue(ctx.guild.id);
        queue.textChannel = ctx.channel;

        if (!queue.isConnected()) {
          await queue.connect(voiceChannel);
        }

        const wasIdle = !queue.currentTrack;
        queue.tracks.push(...batch.tracks);

        if (batch.tracks.length > 1) {
          const embed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
            .setTitle(`${EMOJIS.MUSIC} Colección de Spotify Añadida`)
            .setDescription(
              `Se añadieron **${batch.tracks.length} canciones** de **[${batch.collectionTitle || 'Spotify'}](${batch.collectionUrl || query})** a la cola.`
            )
            .addFields(
              { name: '🎵 Primera pista', value: batch.tracks[0].title, inline: true },
              { name: '📋 Total en cola', value: `\`${queue.tracks.length}\` pistas`, inline: true }
            );
          if (batch.thumbnail) embed.setThumbnail(batch.thumbnail);
          await ctx.reply({ embeds: [embed] });

          if (wasIdle) {
            await queue.playNext();
          }
          return;
        }

        const track = batch.tracks[0];
        if (wasIdle) {
          await ctx.reply({
            embeds: [
              createSuccessEmbed(
                'Conectado al Canal de Voz',
                `🎶 Preparando **${track.title}** en **${voiceChannel.name}**...`
              ),
            ],
          });
          await queue.playNext();
        } else {
          const embed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
            .setTitle(`${EMOJIS.MUSIC} Añadido a la Cola`)
            .setDescription(`**[${track.title}](${track.url})**`)
            .addFields(
              { name: '⏱️ Duración', value: `\`${track.durationRaw}\``, inline: true },
              { name: '📋 Posición', value: `\`#${queue.tracks.length}\``, inline: true }
            );
          if (track.thumbnail) embed.setThumbnail(track.thumbnail);

          await ctx.reply({ embeds: [embed] });
        }
      } catch (err: any) {
        console.error('[Play Command] Error:', err);
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              `Ocurrió un error al buscar o reproducir la pista: \`${err?.message || 'Error desconocido'}\``
            ),
          ],
        });
      }
    },
  },
  {
    name: 'skip',
    aliases: ['s', 'saltar', 'next'],
    description: 'Salta a la siguiente canción de la cola',
    category: 'Música',
    usage: 'skip',
    slashData: new SlashCommandBuilder()
      .setName('skip')
      .setDescription('Salta la canción actual'),
    execute: async (ctx) => {
      if (!ctx.guild) return;
      const queue = musicManager.getQueue(ctx.guild.id);

      if (!queue.currentTrack) {
        await ctx.reply({
          embeds: [createErrorEmbed('No hay ninguna canción reproduciéndose ahora mismo.')],
        });
        return;
      }

      const skippedTitle = queue.currentTrack.title;
      queue.player.stop();
      await ctx.reply({
        embeds: [
          createSuccessEmbed('Canción Saltada', `⏭️ Se saltó **${skippedTitle}**.`),
        ],
      });
    },
  },
  {
    name: 'stop',
    aliases: ['leave', 'disconnect', 'detener'],
    description: 'Detiene la música, limpia la cola y desconecta a Crona del canal de voz',
    category: 'Música',
    usage: 'stop',
    slashData: new SlashCommandBuilder()
      .setName('stop')
      .setDescription('Detiene la reproducción y desconecta a Crona'),
    execute: async (ctx) => {
      if (!ctx.guild) return;
      musicManager.deleteQueue(ctx.guild.id);
      await ctx.reply({
        embeds: [
          createSuccessEmbed(
            'Reproducción Detenida',
            '⏹️ Limpié la cola de música y volví a mi esquina oscura.'
          ),
        ],
      });
    },
  },
  {
    name: 'pause',
    aliases: ['pausar'],
    description: 'Pausa temporalmente la canción actual',
    category: 'Música',
    usage: 'pause',
    slashData: new SlashCommandBuilder()
      .setName('pause')
      .setDescription('Pausa la reproducción actual'),
    execute: async (ctx) => {
      if (!ctx.guild) return;
      const queue = musicManager.getQueue(ctx.guild.id);
      if (!queue.currentTrack) {
        await ctx.reply({ embeds: [createErrorEmbed('No hay música sonando.')] });
        return;
      }
      queue.player.pause();
      await ctx.reply({
        embeds: [createSuccessEmbed('Música en Pausa', `⏸️ Pausé **${queue.currentTrack.title}**.`)],
      });
    },
  },
  {
    name: 'resume',
    aliases: ['continuar', 'unpause'],
    description: 'Reanuda la canción en pausa',
    category: 'Música',
    usage: 'resume',
    slashData: new SlashCommandBuilder()
      .setName('resume')
      .setDescription('Continúa reproduciendo la canción en pausa'),
    execute: async (ctx) => {
      if (!ctx.guild) return;
      const queue = musicManager.getQueue(ctx.guild.id);
      if (!queue.currentTrack) {
        await ctx.reply({ embeds: [createErrorEmbed('No hay música en pausa.')] });
        return;
      }
      queue.player.unpause();
      await ctx.reply({
        embeds: [createSuccessEmbed('Música Reanudada', `▶️ Continuando **${queue.currentTrack.title}**.`)],
      });
    },
  },
  {
    name: 'queue',
    aliases: ['q', 'cola', 'lista'],
    description: 'Muestra la lista de canciones en espera',
    category: 'Música',
    usage: 'queue',
    slashData: new SlashCommandBuilder()
      .setName('queue')
      .setDescription('Muestra la cola de reproducción del servidor'),
    execute: async (ctx) => {
      if (!ctx.guild) return;
      const queue = musicManager.getQueue(ctx.guild.id);

      if (!queue.currentTrack && queue.tracks.length === 0) {
        await ctx.reply({
          embeds: [createErrorEmbed('La cola de reproducción está vacía.')],
        });
        return;
      }

      const upcoming = queue.tracks
        .slice(0, 10)
        .map(
          (t, i) => `**${i + 1}.** [${t.title}](${t.url}) \`[${t.durationRaw}]\` — *${t.requestedBy}*`
        )
        .join('\n');

      const embed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
        .setTitle(`${EMOJIS.MUSIC} Cola de Música — ${ctx.guild.name}`)
        .setDescription(
          `▶️ **Sonando ahora:**\n` +
            (queue.currentTrack
              ? `[${queue.currentTrack.title}](${queue.currentTrack.url}) \`[${queue.currentTrack.durationRaw}]\`\n\n`
              : 'Nada\n\n') +
            `📋 **Siguientes en cola (${queue.tracks.length}):**\n` +
            (upcoming || '*No hay más canciones en espera.*')
        );

      await ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'nowplaying',
    aliases: ['np', 'sonando'],
    description: 'Muestra detalles de la canción que está sonando ahora mismo',
    category: 'Música',
    usage: 'nowplaying',
    slashData: new SlashCommandBuilder()
      .setName('nowplaying')
      .setDescription('Muestra la canción actual'),
    execute: async (ctx) => {
      if (!ctx.guild) return;
      const queue = musicManager.getQueue(ctx.guild.id);
      if (!queue.currentTrack) {
        await ctx.reply({ embeds: [createErrorEmbed('No hay ninguna canción sonando ahora.')] });
        return;
      }

      const t = queue.currentTrack;
      const embed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
        .setTitle(`${EMOJIS.MUSIC} Sonando Ahora`)
        .setDescription(`**[${t.title}](${t.url})**`)
        .addFields(
          { name: '⏱️ Duración', value: `\`${t.durationRaw}\``, inline: true },
          { name: '🎧 Pedido por', value: t.requestedBy, inline: true }
        );
      if (t.thumbnail) embed.setThumbnail(t.thumbnail);

      await ctx.reply({ embeds: [embed] });
    },
  },
];
