import {
  ActionRowBuilder,
  ComponentType,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  version as djsVersion,
} from 'discord.js';
import { CommandCategory, CronaCommand } from '../types/command';
import { COLORS, EMOJIS } from '../utils/constants';
import { createCronaEmbed, createErrorEmbed } from '../utils/embeds';

const CATEGORY_META: Record<CommandCategory, { emoji: string; desc: string }> = {
  Roleplay: {
    emoji: '💖',
    desc: 'Abrazos, caricias, besos, bofetadas y reacciones anime con contador.',
  },
  Economía: {
    emoji: '🟣',
    desc: 'Almas, banco de Sangre Negra, misiones, caza de Kishin y tienda.',
  },
  'Perfil y Niveles': {
    emoji: '⭐',
    desc: 'Tarjeta de perfil clásica, niveles, experiencia, +rep, bio y títulos.',
  },
  'Social y Matrimonio': {
    emoji: '💍',
    desc: 'Propuestas de matrimonio interactivas, divorcios y medidor de amor (ship).',
  },
  'Diversión y Minijuegos': {
    emoji: '🎲',
    desc: 'Oráculo 8ball, dados, piedra papel o tijera, trivia anime y frases.',
  },
  Moderación: {
    emoji: '🛡️',
    desc: 'Kick, ban, timeout, limpieza de mensajes, advertencias y prefijo.',
  },
  Música: {
    emoji: '🎵',
    desc: 'Reproductor de voz con cola para cantar en canales de voz.',
  },
  Utilidad: {
    emoji: '🔮',
    desc: 'Avatar, información de usuario/servidor, latencia y ayuda interactiva.',
  },
};

export function createUtilityCommands(getAllCommands: () => CronaCommand[]): CronaCommand[] {
  return [
    {
      name: 'help',
      aliases: ['ayuda', 'h', 'comandos', 'commands'],
      description: 'Muestra el menú interactivo de comandos de Crona al estilo clásico',
      category: 'Utilidad',
      usage: 'help [comando]',
      slashData: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Abre el manual interactivo de comandos de Crona')
        .addStringOption((opt) =>
          opt
            .setName('comando')
            .setDescription('Nombre de un comando específico para ver sus detalles')
            .setRequired(false)
        ),
      execute: async (ctx) => {
        const allCommands = getAllCommands();
        const specific = ctx.getString('comando', 0)?.toLowerCase();

        if (specific) {
          const cmd = allCommands.find(
            (c) => c.name === specific || c.aliases?.includes(specific)
          );
          if (!cmd) {
            await ctx.reply({
              embeds: [
                createErrorEmbed(
                  `No encontré ningún comando llamado \`${specific}\`. Usa \`${ctx.prefix}help\` para ver la lista completa.`
                ),
              ],
            });
            return;
          }

          const detailEmbed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
            .setTitle(`📖 Comando: ${ctx.prefix}${cmd.name}`)
            .setDescription(cmd.description)
            .addFields(
              { name: '📂 Categoría', value: cmd.category, inline: true },
              {
                name: '🏷️ Alias',
                value:
                  cmd.aliases && cmd.aliases.length > 0
                    ? cmd.aliases.map((a) => `\`${a}\``).join(', ')
                    : 'Ninguno',
                inline: true,
              },
              {
                name: '⌨️ Uso',
                value: `\`${ctx.prefix}${cmd.usage || cmd.name}\` o \`/${cmd.name}\``,
                inline: false,
              }
            );

          await ctx.reply({ embeds: [detailEmbed] });
          return;
        }

        const categories = Object.keys(CATEGORY_META) as CommandCategory[];

        const mainEmbed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
          .setTitle(`${EMOJIS.BLACK_BLOOD} Manual de Resonancia de Crona`)
          .setDescription(
            `¡H-Hola **${ctx.author.displayName}**! Soy **Crona** *(y Ragnarok está aquí conmigo)*.\n` +
              `Fui creado/a en honor a la época dorada de Discord (**Chocolat**).\n\n` +
              `🔹 **Prefijo clásico en este servidor:** \`${ctx.prefix}\`\n` +
              `🔹 **Slash Commands:** También puedes usar \`/\` para todos mis comandos.\n\n` +
              `👇 *Selecciona una categoría en el menú desplegable para explorar mis **${allCommands.length}** comandos:*`
          )
          .setThumbnail(ctx.client.user?.displayAvatarURL({ size: 256 }) || null);

        for (const cat of categories) {
          const meta = CATEGORY_META[cat];
          const count = allCommands.filter((c) => c.category === cat).length;
          mainEmbed.addFields({
            name: `${meta.emoji} ${cat} (${count})`,
            value: meta.desc,
            inline: true,
          });
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('help_category_select')
          .setPlaceholder('🌸 Elige una categoría de comandos...')
          .addOptions([
            {
              label: 'Vista General',
              value: 'home',
              description: 'Volver a la portada principal de ayuda',
              emoji: '🏠',
            },
            ...categories.map((cat) => ({
              label: cat,
              value: cat,
              description: CATEGORY_META[cat].desc.slice(0, 95),
              emoji: CATEGORY_META[cat].emoji,
            })),
          ]);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const sent = await ctx.reply({ embeds: [mainEmbed], components: [row] });

        if (!sent || typeof sent.createMessageComponentCollector !== 'function') return;

        const collector = sent.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 120_000,
        });

        collector.on('collect', async (selectInt: any) => {
          if (selectInt.user.id !== ctx.author.id) {
            await selectInt.reply({
              content: `${EMOJIS.CRONA_SHY} Usa \`${ctx.prefix}help\` para abrir tu propio menú interactivo.`,
              ephemeral: true,
            });
            return;
          }

          const selected = selectInt.values[0];
          if (selected === 'home') {
            await selectInt.update({ embeds: [mainEmbed], components: [row] });
            return;
          }

          const cat = selected as CommandCategory;
          const meta = CATEGORY_META[cat];
          const cmds = allCommands.filter((c) => c.category === cat);

          const catEmbed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
            .setTitle(`${meta.emoji} Categoría: ${cat}`)
            .setDescription(
              `${meta.desc}\n\n` +
                cmds
                  .map(
                    (c) =>
                      `• **\`${ctx.prefix}${c.name}\`** ${
                        c.aliases?.length ? `*(${c.aliases.slice(0, 2).join(', ')})*` : ''
                      } — ${c.description}`
                  )
                  .join('\n')
            );

          await selectInt.update({ embeds: [catEmbed], components: [row] });
        });
      },
    },
    {
      name: 'avatar',
      aliases: ['av', 'pfp', 'foto'],
      description: 'Muestra el avatar en alta resolución de un usuario (clásico de Chocolat)',
      category: 'Utilidad',
      usage: 'avatar [@usuario]',
      slashData: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Muestra la foto de perfil de un usuario en tamaño grande')
        .addUserOption((opt) =>
          opt.setName('usuario').setDescription('Usuario a consultar').setRequired(false)
        ),
      execute: async (ctx) => {
        const target = (await ctx.getTargetUser('usuario', 0)) || ctx.author;
        const avatarUrl = target.displayAvatarURL({ size: 1024 });

        const embed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
          .setTitle(`🖼️ Avatar de ${target.displayName || target.username}`)
          .setDescription(`[🔗 Abrir imagen en el navegador](${avatarUrl})`)
          .setImage(avatarUrl);

        await ctx.reply({ embeds: [embed] });
      },
    },
    {
      name: 'userinfo',
      aliases: ['whois', 'ui', 'usuario'],
      description: 'Muestra información detallada de una cuenta de Discord en el servidor',
      category: 'Utilidad',
      usage: 'userinfo [@usuario]',
      slashData: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Muestra información sobre un miembro del servidor')
        .addUserOption((opt) =>
          opt.setName('usuario').setDescription('Usuario a consultar').setRequired(false)
        ),
      execute: async (ctx) => {
        const target = (await ctx.getTargetUser('usuario', 0)) || ctx.author;
        const member = ctx.guild
          ? await ctx.guild.members.fetch(target.id).catch(() => null)
          : null;

        const embed = createCronaEmbed(COLORS.PRIMARY, target)
          .setTitle(`🔍 Información de ${target.tag}`)
          .setThumbnail(target.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: '🆔 ID', value: `\`${target.id}\``, inline: true },
            {
              name: '📅 Cuenta Creada',
              value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`,
              inline: true,
            }
          );

        if (member) {
          const roles = member.roles.cache
            .filter((r) => r.id !== ctx.guild?.id)
            .sort((a, b) => b.position - a.position)
            .map((r) => `<@&${r.id}>`)
            .slice(0, 10);

          embed.addFields(
            {
              name: '📥 Unido al Servidor',
              value: member.joinedTimestamp
                ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
                : 'Desconocido',
              inline: true,
            },
            {
              name: `🎭 Roles (${member.roles.cache.size - 1})`,
              value: roles.length > 0 ? roles.join(' ') : 'Sin roles',
              inline: false,
            }
          );
        }

        await ctx.reply({ embeds: [embed] });
      },
    },
    {
      name: 'serverinfo',
      aliases: ['si', 'guildinfo', 'servidor'],
      description: 'Muestra las estadísticas e información del servidor actual',
      category: 'Utilidad',
      usage: 'serverinfo',
      slashData: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Muestra información detallada de este servidor'),
      execute: async (ctx) => {
        if (!ctx.guild) {
          await ctx.reply({ embeds: [createErrorEmbed('Este comando solo funciona en servidores.')] });
          return;
        }

        const g = ctx.guild;
        const owner = await g.fetchOwner().catch(() => null);

        const embed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
          .setTitle(`🏰 Información de ${g.name}`)
          .setThumbnail(g.iconURL({ size: 256 }))
          .addFields(
            { name: '👑 Propietario', value: owner ? `${owner.user.tag}` : 'Desconocido', inline: true },
            { name: '🆔 ID del Servidor', value: `\`${g.id}\``, inline: true },
            { name: '👥 Miembros', value: `**${g.memberCount}** almas`, inline: true },
            { name: '💬 Canales', value: `**${g.channels.cache.size}**`, inline: true },
            { name: '🎭 Roles', value: `**${g.roles.cache.size}**`, inline: true },
            {
              name: '📅 Creación',
              value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`,
              inline: true,
            }
          );

        if (g.bannerURL()) {
          embed.setImage(g.bannerURL({ size: 1024 }));
        }

        await ctx.reply({ embeds: [embed] });
      },
    },
    {
      name: 'botinfo',
      aliases: ['stats', 'about', 'cronainfo'],
      description: 'Muestra las estadísticas técnicas e historia de Crona',
      category: 'Utilidad',
      usage: 'botinfo',
      slashData: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Muestra información técnica sobre Crona'),
      execute: async (ctx) => {
        const uptimeSeconds = Math.floor(process.uptime());
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        const memMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

        const embed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
          .setTitle(`${EMOJIS.BLACK_BLOOD} Crona & Ragnarok — Bot Multifunción`)
          .setThumbnail(ctx.client.user?.displayAvatarURL({ size: 256 }) || null)
          .setDescription(
            `*«No sé cómo lidiar con esto... pero haré mi mejor esfuerzo por tu servidor.»*\n` +
              `Inspirado en el legendario bot **Chocolat** de la época dorada de Discord.`
          )
          .addFields(
            { name: '📡 Servidores', value: `\`${ctx.client.guilds.cache.size}\``, inline: true },
            { name: '⚡ Latencia WS', value: `\`${ctx.client.ws.ping}ms\``, inline: true },
            { name: '⏱️ Tiempo Activo', value: `\`${hours}h ${minutes}m ${seconds}s\``, inline: true },
            { name: '🧠 Memoria RAM', value: `\`${memMb} MB\``, inline: true },
            { name: '📦 discord.js', value: `\`v${djsVersion}\``, inline: true },
            { name: '🟢 Node.js', value: `\`${process.version}\``, inline: true }
          );

        await ctx.reply({ embeds: [embed] });
      },
    },
    {
      name: 'ping',
      aliases: ['latencia', 'pong'],
      description: 'Comprueba la velocidad de respuesta de la resonancia de alma de Crona',
      category: 'Utilidad',
      usage: 'ping',
      slashData: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Muestra la latencia actual del bot'),
      execute: async (ctx) => {
        const wsPing = ctx.client.ws.ping;
        const embed = createCronaEmbed(COLORS.PRIMARY, ctx.author)
          .setTitle('🏓 ¡Pong! Resonancia Estable')
          .setDescription(
            `${EMOJIS.SOUL} **Latencia de Discord API:** \`${wsPing}ms\`\n` +
              `-# *Ragnarok respondió antes de que me escondiera en la esquina.*`
          );

        await ctx.reply({ embeds: [embed] });
      },
    },
  ];
}
