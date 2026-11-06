import 'dotenv/config';
import {
  ActivityType,
  ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  GuildMember,
  Message,
  Partials,
  User,
} from 'discord.js';
import { allCommands, resolveCommand } from './commands';
import { addXp, getGuildPrefix } from './database/db';
import { ReplyPayload, UnifiedContext } from './types/command';
import { COLORS, EMOJIS } from './utils/constants';
import { createCronaEmbed, createErrorEmbed } from './utils/embeds';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Control de enfriamiento (cooldowns) de comandos y XP por mensaje
const commandCooldowns = new Map<string, number>();
const xpCooldowns = new Map<string, number>();

function createSlashContext(
  interaction: ChatInputCommandInteraction,
  prefix: string
): UnifiedContext {
  return {
    client,
    isSlash: true,
    interaction,
    author: interaction.user,
    member: (interaction.member as GuildMember) || null,
    guild: interaction.guild,
    channel: interaction.channel,
    args: [],
    prefix,
    reply: async (payload: ReplyPayload | string) => {
      const normalized: ReplyPayload =
        typeof payload === 'string' ? { content: payload } : payload;

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: normalized.content,
          embeds: normalized.embeds,
          components: normalized.components,
        });
      }
      const response = await interaction.reply({
        content: normalized.content,
        embeds: normalized.embeds,
        components: normalized.components,
        ephemeral: normalized.ephemeral,
        fetchReply: true,
      });
      return response;
    },
    getTargetUser: async (optionName = 'usuario') => {
      return interaction.options.getUser(optionName) || null;
    },
    getString: (optionName: string) => {
      return interaction.options.getString(optionName);
    },
    getNumber: (optionName: string) => {
      return (
        interaction.options.getInteger(optionName) ??
        interaction.options.getNumber(optionName)
      );
    },
  };
}

function createMessageContext(
  message: Message,
  args: string[],
  prefix: string
): UnifiedContext {
  return {
    client,
    isSlash: false,
    message,
    author: message.author,
    member: message.member,
    guild: message.guild,
    channel: message.channel,
    args,
    prefix,
    reply: async (payload: ReplyPayload | string) => {
      const normalized: ReplyPayload =
        typeof payload === 'string' ? { content: payload } : payload;

      return message.reply({
        content: normalized.content,
        embeds: normalized.embeds,
        components: normalized.components,
        allowedMentions: { repliedUser: false },
      });
    },
    getTargetUser: async (_optionName?: string, argIndex = 0): Promise<User | null> => {
      const raw = args[argIndex];
      if (!raw) return null;

      const match = raw.match(/^<@!?(\d+)>$/) || raw.match(/^(\d{17,20})$/);
      if (match) {
        return client.users.fetch(match[1]).catch(() => null);
      }
      return null;
    },
    getString: (_optionName: string, argIndex = 0, joinRest = false): string | null => {
      if (argIndex >= args.length) return null;
      return joinRest ? args.slice(argIndex).join(' ') : args[argIndex];
    },
    getNumber: (_optionName: string, argIndex = 0): number | null => {
      const raw = args[argIndex];
      if (!raw) return null;
      const parsed = Number(raw);
      return isNaN(parsed) ? null : parsed;
    },
  };
}

client.once(Events.ClientReady, (readyClient) => {
  const defaultPrefix = process.env.DEFAULT_PREFIX || 'c!';
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`🩸 ¡Crona & Ragnarok están en línea como ${readyClient.user.tag}!`);
  console.log(`🗡️ Comandos cargados: ${allCommands.length} | Prefijo base: ${defaultPrefix}`);
  console.log('═══════════════════════════════════════════════════════════');

  const activities = [
    { name: `${defaultPrefix}help | /help • No sé cómo lidiar con esto...`, type: ActivityType.Playing },
    { name: 'Poemas en una esquina oscura 📜', type: ActivityType.Listening },
    { name: 'Resonancia de Almas en Shibusen 🟣', type: ActivityType.Watching },
    { name: 'a Ragnarok comer dulces 🍬', type: ActivityType.Watching },
  ];

  let idx = 0;
  const updatePresence = () => {
    const act = activities[idx % activities.length];
    readyClient.user.setPresence({
      status: 'online',
      activities: [{ name: act.name, type: act.type }],
    });
    idx++;
  };

  updatePresence();
  setInterval(updatePresence, 60_000);
});

// Interacciones de Slash Commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = resolveCommand(interaction.commandName);
  if (!cmd) return;

  const prefix = getGuildPrefix(interaction.guildId);

  // Control de enfriamiento (cooldown) en Slash Commands
  const cooldownSec = cmd.cooldown || 2;
  const key = `${interaction.user.id}:${cmd.name}`;
  const now = Date.now();
  const expiresAt = commandCooldowns.get(key) || 0;

  if (now < expiresAt) {
    const waitSec = ((expiresAt - now) / 1000).toFixed(1);
    await interaction
      .reply({
        embeds: [
          createErrorEmbed(
            `Vas demasiado rápido... Espera **${waitSec}s** antes de volver a usar \`/${cmd.name}\`.`
          ),
        ],
        ephemeral: true,
      })
      .catch(() => null);
    return;
  }

  commandCooldowns.set(key, now + cooldownSec * 1000);
  const ctx = createSlashContext(interaction, prefix);

  try {
    await cmd.execute(ctx);
  } catch (err) {
    console.error(`[Error en /${cmd.name}]:`, err);
    await ctx
      .reply({
        embeds: [
          createErrorEmbed(
            'Ocurrió un fallo inesperado al ejecutar ese comando... me iré a mi esquina.'
          ),
        ],
        ephemeral: true,
      })
      .catch(() => null);
  }
});

// Comandos por Prefijo Clásico (c!) + Sistema de Niveles / XP estilo Chocolat
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = getGuildPrefix(message.guild.id);

  // Si mencionan al bot directamente, mostrar prefijo y ayuda
  if (
    message.content.trim() === `<@${client.user?.id}>` ||
    message.content.trim() === `<@!${client.user?.id}>`
  ) {
    const embed = createCronaEmbed(COLORS.PRIMARY, message.author).setDescription(
      `${EMOJIS.CRONA_SHY} ¡H-Hola **${message.author.displayName}**! No sé cómo lidiar con las menciones repentinas...\n` +
        `Mi prefijo en este servidor es \`${prefix}\` (o usa \`/help\`).\n` +
        `Escribe \`${prefix}help\` para ver todos mis comandos.`
    );
    await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(() => null);
    return;
  }

  // Verificar si es comando con prefijo
  if (message.content.toLowerCase().startsWith(prefix.toLowerCase())) {
    const withoutPrefix = message.content.slice(prefix.length).trim();
    if (!withoutPrefix) return;

    const parts = withoutPrefix.split(/\s+/);
    const commandName = parts.shift()!.toLowerCase();
    const cmd = resolveCommand(commandName);

    if (!cmd) return;

    // Cooldown
    const cooldownSec = cmd.cooldown || 2;
    const key = `${message.author.id}:${cmd.name}`;
    const now = Date.now();
    const expiresAt = commandCooldowns.get(key) || 0;

    if (now < expiresAt) {
      const waitSec = ((expiresAt - now) / 1000).toFixed(1);
      const warnMsg = await message
        .reply({
          embeds: [
            createErrorEmbed(
              `Vas demasiado rápido... Espera **${waitSec}s** antes de volver a usar \`${prefix}${cmd.name}\`.`
            ),
          ],
          allowedMentions: { repliedUser: false },
        })
        .catch(() => null);
      if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => null), 3500);
      return;
    }

    commandCooldowns.set(key, now + cooldownSec * 1000);
    const ctx = createMessageContext(message, parts, prefix);

    try {
      await cmd.execute(ctx);
    } catch (err) {
      console.error(`[Error en ${prefix}${cmd.name}]:`, err);
      await ctx
        .reply({
          embeds: [
            createErrorEmbed(
              'Ocurrió un fallo inesperado al ejecutar ese comando... me iré a mi esquina.'
            ),
          ],
        })
        .catch(() => null);
    }
    return;
  }

  // Ganancia pasiva de XP y Almas por conversar (cada 45s por usuario)
  const lastXp = xpCooldowns.get(message.author.id) || 0;
  if (Date.now() - lastXp >= 45_000 && message.content.length >= 4) {
    xpCooldowns.set(message.author.id, Date.now());
    const gainedXp = Math.floor(Math.random() * 14) + 12; // 12 a 25 XP
    const result = addXp(message.author.id, gainedXp);

    if (result.leveledUp && 'send' in message.channel) {
      const bonus = result.newLevel * 75;
      const lvlEmbed = createCronaEmbed(COLORS.PRIMARY, message.author)
        .setTitle(`${EMOJIS.LEVEL} ¡Resonancia de Alma Aumentada!`)
        .setDescription(
          `🎉 ¡Felicidades <@${message.author.id}>! Subiste al **Nivel ${result.newLevel}**.\n` +
            `${EMOJIS.SOUL} Recompensa de Shibusen: **+${bonus} Almas**`
        );
      await message.channel.send({ embeds: [lvlEmbed] }).catch(() => null);
    }
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token || token === 'tu_token_aqui') {
  console.warn(
    '⚠️ [Aviso] No se ha configurado un DISCORD_TOKEN válido en .env.\n' +
      'Copia el archivo .env.example a .env y coloca el token de tu bot de Discord para iniciar a Crona.'
  );
} else {
  client.login(token).catch((err) => {
    console.error('❌ Error al iniciar sesión en Discord:', err);
  });
}
