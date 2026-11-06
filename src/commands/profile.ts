import { SlashCommandBuilder } from 'discord.js';
import { CronaCommand } from '../types/command';
import {
  addRep,
  getUser,
  getUserRank,
  setBio,
  setCooldownTimestamp,
  setTitle,
  xpNeededForLevel,
} from '../database/db';
import { COLORS, EMOJIS } from '../utils/constants';
import {
  buildProgressBar,
  createCronaEmbed,
  createErrorEmbed,
  createSuccessEmbed,
} from '../utils/embeds';

export const profileCommands: CronaCommand[] = [
  {
    name: 'profile',
    aliases: ['perfil', 'card', 'ficha'],
    description: 'Muestra tu tarjeta de perfil clásica al estilo Chocolat',
    category: 'Perfil y Niveles',
    usage: 'profile [@usuario]',
    slashData: new SlashCommandBuilder()
      .setName('profile')
      .setDescription('Muestra tu perfil personalizado o el de otro usuario')
      .addUserOption((opt) =>
        opt.setName('usuario').setDescription('Usuario a consultar').setRequired(false)
      ),
    execute: async (ctx) => {
      const target = (await ctx.getTargetUser('usuario', 0)) || ctx.author;
      const data = getUser(target.id);
      const rank = getUserRank(target.id);
      const neededXp = xpNeededForLevel(data.level);

      let partnerText = 'Soltero/a en su esquina oscura';
      if (data.married_to) {
        const partnerUser = await ctx.client.users.fetch(data.married_to).catch(() => null);
        const partnerName = partnerUser ? partnerUser.username : `<@${data.married_to}>`;
        const dateStr = data.married_at
          ? ` (<t:${Math.floor(data.married_at / 1000)}:R>)`
          : '';
        partnerText = `${EMOJIS.RING} Casado/a con **${partnerName}**${dateStr}`;
      }

      const embed = createCronaEmbed(COLORS.PRIMARY, target)
        .setTitle(`🪪 Ficha de Shibusen — ${target.displayName || target.username}`)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .setDescription(`*${data.bio}*`)
        .addFields(
          { name: '🏅 Título', value: data.title, inline: true },
          { name: `${EMOJIS.REP} Reputación`, value: `**+${data.rep}** puntos`, inline: true },
          { name: '🏆 Rango Global', value: `**#${rank}**`, inline: true },
          {
            name: `${EMOJIS.LEVEL} Nivel ${data.level}`,
            value: `${buildProgressBar(data.xp, neededXp)}\n\`${data.xp} / ${neededXp} XP\``,
            inline: false,
          },
          {
            name: `${EMOJIS.SOUL} Almas Totales`,
            value: `Cartera: **${data.souls.toLocaleString()}** | Banco: **${data.bank.toLocaleString()}**`,
            inline: true,
          },
          {
            name: `${EMOJIS.HEART} Estado Civil`,
            value: partnerText,
            inline: true,
          }
        );

      await ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'rank',
    aliases: ['level', 'nivel', 'xp'],
    description: 'Consulta tu nivel actual y progreso de experiencia',
    category: 'Perfil y Niveles',
    usage: 'rank [@usuario]',
    slashData: new SlashCommandBuilder()
      .setName('rank')
      .setDescription('Consulta tu nivel y barra de experiencia')
      .addUserOption((opt) =>
        opt.setName('usuario').setDescription('Usuario a consultar').setRequired(false)
      ),
    execute: async (ctx) => {
      const target = (await ctx.getTargetUser('usuario', 0)) || ctx.author;
      const data = getUser(target.id);
      const needed = xpNeededForLevel(data.level);
      const rank = getUserRank(target.id);

      const embed = createCronaEmbed(COLORS.PRIMARY, target)
        .setTitle(`${EMOJIS.LEVEL} Nivel de Resonancia — ${target.displayName || target.username}`)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .setDescription(
          `🏆 **Posición:** \`#${rank}\`  •  ⭐ **Nivel:** \`${data.level}\`\n\n` +
            `${buildProgressBar(data.xp, needed, 14)}\n` +
            `Experiencia: **${data.xp} / ${needed} XP**`
        );

      await ctx.reply({ embeds: [embed] });
    },
  },
  {
    name: 'rep',
    aliases: ['reputacion', '+rep'],
    description: 'Otorga un punto de reputación (+rep) a alguien que te haya ayudado o caído bien',
    category: 'Perfil y Niveles',
    usage: 'rep <@usuario>',
    slashData: new SlashCommandBuilder()
      .setName('rep')
      .setDescription('Dale +1 de reputación a otro usuario (cada 12 horas)')
      .addUserOption((opt) =>
        opt.setName('usuario').setDescription('Usuario que recibirá tu +rep').setRequired(true)
      ),
    execute: async (ctx) => {
      const target = await ctx.getTargetUser('usuario', 0);
      if (!target || target.bot || target.id === ctx.author.id) {
        await ctx.reply({
          embeds: [createErrorEmbed('Menciona a otro usuario válido para darle un punto de reputación.')],
        });
        return;
      }

      const sender = getUser(ctx.author.id);
      const cooldownMs = 12 * 60 * 60 * 1000;
      const elapsed = Date.now() - sender.last_rep;

      if (elapsed < cooldownMs) {
        const hoursLeft = Math.ceil((cooldownMs - elapsed) / (60 * 60 * 1000));
        await ctx.reply({
          embeds: [
            createErrorEmbed(
              `Ya diste reputación recientemente. Podrás dar otro **+rep** en aproximadamente **${hoursLeft}h**.`
            ),
          ],
        });
        return;
      }

      setCooldownTimestamp(ctx.author.id, 'last_rep', Date.now());
      const newRep = addRep(target.id);

      await ctx.reply({
        embeds: [
          createSuccessEmbed(
            '¡Reputación Entregada!',
            `${EMOJIS.REP} **${ctx.author.displayName}** le dio **+1 de reputación** a **${target.displayName}**!\n` +
              `Ahora tiene **${newRep}** puntos de reputación en Shibusen.`
          ),
        ],
      });
    },
  },
  {
    name: 'setbio',
    aliases: ['bio', 'biografia'],
    description: 'Cambia la frase o biografía que aparece en tu perfil de Crona',
    category: 'Perfil y Niveles',
    usage: 'setbio <tu nueva biografía>',
    slashData: new SlashCommandBuilder()
      .setName('setbio')
      .setDescription('Personaliza la biografía de tu perfil')
      .addStringOption((opt) =>
        opt
          .setName('texto')
          .setDescription('Nueva biografía (máx. 160 caracteres)')
          .setMaxLength(160)
          .setRequired(true)
      ),
    execute: async (ctx) => {
      const text = ctx.getString('texto', 0, true);
      if (!text || text.trim().length === 0) {
        await ctx.reply({
          embeds: [createErrorEmbed(`Escribe tu nueva biografía: \`${ctx.prefix}setbio <texto>\``)],
        });
        return;
      }

      const clean = text.trim().slice(0, 160);
      setBio(ctx.author.id, clean);

      await ctx.reply({
        embeds: [
          createSuccessEmbed(
            'Biografía Actualizada',
            `Tu biografía de perfil ahora es:\n> *${clean}*`
          ),
        ],
      });
    },
  },
  {
    name: 'settitle',
    aliases: ['titulo', 'title'],
    description: 'Personaliza el título de tu ficha de perfil',
    category: 'Perfil y Niveles',
    usage: 'settitle <nuevo título>',
    slashData: new SlashCommandBuilder()
      .setName('settitle')
      .setDescription('Cambia el título visible en tu perfil')
      .addStringOption((opt) =>
        opt
          .setName('titulo')
          .setDescription('Tu nuevo título (máx. 40 caracteres)')
          .setMaxLength(40)
          .setRequired(true)
      ),
    execute: async (ctx) => {
      const title = ctx.getString('titulo', 0, true);
      if (!title || title.trim().length === 0) {
        await ctx.reply({
          embeds: [createErrorEmbed(`Escribe tu nuevo título: \`${ctx.prefix}settitle <título>\``)],
        });
        return;
      }

      const clean = title.trim().slice(0, 40);
      setTitle(ctx.author.id, clean);

      await ctx.reply({
        embeds: [
          createSuccessEmbed(
            'Título Actualizado',
            `Tu título en Shibusen ahora es: **${clean}**`
          ),
        ],
      });
    },
  },
];
