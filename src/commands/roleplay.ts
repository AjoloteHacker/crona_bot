import { SlashCommandBuilder } from 'discord.js';
import { CronaCommand } from '../types/command';
import { fetchAnimeGif } from '../utils/animeGif';
import { COLORS, EMOJIS } from '../utils/constants';
import { createCronaEmbed } from '../utils/embeds';
import { incrementInteraction } from '../database/db';

interface RoleplayConfig {
  name: string;
  aliases: string[];
  description: string;
  categoryGif: string;
  requiresTarget: boolean;
  actionText: (author: string, target: string) => string;
  selfText: (author: string) => string;
  cronaTargetText: (author: string) => string;
  counterLabel: string;
}

const ROLEPLAY_ACTIONS: RoleplayConfig[] = [
  {
    name: 'hug',
    aliases: ['abrazar', 'abrazo'],
    description: 'Dale un cálido abrazo a alguien al estilo clásico de Chocolat',
    categoryGif: 'hug',
    requiresTarget: true,
    actionText: (a, t) => `💖 **${a}** le dio un abrazo muy cálido a **${t}**~`,
    selfText: (a) =>
      `🥺 **${a}** se está abrazando a sí mismo/a... ¡Ven aquí, hasta yo puedo darte un abrazo aunque no sepa cómo lidiar con esto!`,
    cronaTargetText: (a) =>
      `😳 **${a}** me está abrazando... ¡¿E-Eh?! ¡Ragnarok, no le muerdas, solo es un abrazo!`,
    counterLabel: 'abrazos compartidos',
  },
  {
    name: 'pat',
    aliases: ['acariciar', 'headpat', 'mimar'],
    description: 'Acaricia suavemente la cabeza de un usuario',
    categoryGif: 'pat',
    requiresTarget: true,
    actionText: (a, t) => `✨ **${a}** acarició suavemente a **${t}**~`,
    selfText: (a) => `🥺 **${a}** se dio palmaditas en la cabeza para animarse.`,
    cronaTargetText: (a) =>
      `🥺 **${a}** me acarició la cabeza... Normalmente Ragnarok solo me da golpes ahí, gracias...`,
    counterLabel: 'caricias dadas',
  },
  {
    name: 'kiss',
    aliases: ['besar', 'beso'],
    description: 'Dale un beso a esa persona especial',
    categoryGif: 'kiss',
    requiresTarget: true,
    actionText: (a, t) => `💋 **${a}** le dio un tierno beso a **${t}**~`,
    selfText: (a) => `😳 **${a}** intentó besarse frente al espejo...`,
    cronaTargetText: (a) =>
      `😱 ¡¿Q-QUÉ HACES, **${a}**?! ¡definitivamente NO SÉ CÓMO LIDIAR CON ESTO! *se esconde en su esquina*`,
    counterLabel: 'besos dados',
  },
  {
    name: 'slap',
    aliases: ['abofetear', 'cachetada', 'bofetada'],
    description: 'Dale una bofetada de anime bien merecida a alguien',
    categoryGif: 'slap',
    requiresTarget: true,
    actionText: (a, t) => `💢 **${a}** le dio una tremenda bofetada a **${t}**!`,
    selfText: (a) => `😵 **${a}** se dio una bofetada para despertar. ¡Ragnarok se está riendo!`,
    cronaTargetText: (a) =>
      `🩸 ¡Oye **${a}**! Mi Sangre Negra endureció el golpe, pero ¡Ragnarok quiere devolvértelo!`,
    counterLabel: 'bofetadas propinadas',
  },
  {
    name: 'cuddle',
    aliases: ['acurrucar', 'apapachar'],
    description: 'Acurrúcate junto a alguien especial',
    categoryGif: 'cuddle',
    requiresTarget: true,
    actionText: (a, t) => `🌸 **${a}** se acurrucó dulcemente con **${t}**~`,
    selfText: (a) => `🛌 **${a}** se hizo bolita entre las mantas en una esquina oscura.`,
    cronaTargetText: (a) =>
      `😳 **${a}** se acurrucó conmigo... Ragnarok dice que ocupas mucho espacio, pero a mí no me molesta.`,
    counterLabel: 'apapachos dados',
  },
  {
    name: 'poke',
    aliases: ['picar', 'molestar'],
    description: 'Pica la mejilla de alguien para llamar su atención',
    categoryGif: 'poke',
    requiresTarget: true,
    actionText: (a, t) => `👉 **${a}** está picando a **${t}** para llamar su atención~`,
    selfText: (a) => `👉 **${a}** se picó la mejilla pensando en qué hacer.`,
    cronaTargetText: (a) => `🥺 ¿S-Sí, **${a}**? ¿Necesitas algo o solo me estás molestando como Ragnarok?`,
    counterLabel: 'toques dados',
  },
  {
    name: 'bite',
    aliases: ['morder', 'mordisco'],
    description: 'Muérdele a alguien (al estilo de Ragnarok)',
    categoryGif: 'bite',
    requiresTarget: true,
    actionText: (a, t) => `🦷 **${a}** le dio un mordisco a **${t}**!`,
    selfText: (a) => `🦷 **${a}** se mordió la lengua por accidente...`,
    cronaTargetText: (a) => `💢 ¡Ragnarok dice que nadie muerde mejor que él, **${a}**!`,
    counterLabel: 'mordiscos dados',
  },
  {
    name: 'kill',
    aliases: ['atacar', 'cortar', 'slash'],
    description: 'Ataca dramáticamente a alguien con la espada demonio Ragnarok',
    categoryGif: 'kill',
    requiresTarget: true,
    actionText: (a, t) => `🗡️ **${a}** desató el *Bloody Needle* contra **${t}**!`,
    selfText: (a) => `🥀 **${a}** cayó rendido/a por su cuenta...`,
    cronaTargetText: (a) =>
      `🩸 **${a}** intentó atacarme, pero mi *Sangre Negra* detuvo el filo al instante.`,
    counterLabel: 'ataques dramáticos',
  },
  {
    name: 'cry',
    aliases: ['llorar', 'triste'],
    description: 'Llora en tu esquina oscura como Crona',
    categoryGif: 'cry',
    requiresTarget: false,
    actionText: (a, t) => `💧 **${t}** hizo llorar a **${a}**... ¡No sé cómo lidiar con tanta tristeza!`,
    selfText: (a) => `💧 **${a}** está llorando desconsoladamente en su esquina...`,
    cronaTargetText: (a) => `💧 **${a}** y yo estamos llorando juntos en la esquina...`,
    counterLabel: 'veces que han llorado juntos',
  },
  {
    name: 'blush',
    aliases: ['sonrojarse', 'sonrojo'],
    description: 'Sonrójate de vergüenza',
    categoryGif: 'blush',
    requiresTarget: false,
    actionText: (a, t) => `😳 **${a}** se puso totalmente rojo/a por culpa de **${t}**~`,
    selfText: (a) => `😳 **${a}** se sonrojó hasta las orejas~`,
    cronaTargetText: (a) => `😳 **${a}** me miró y ambos nos pusimos nerviosos...`,
    counterLabel: 'sonrojos provocados',
  },
  {
    name: 'dance',
    aliases: ['bailar', 'baile'],
    description: 'Ponte a bailar con alegría',
    categoryGif: 'dance',
    requiresTarget: false,
    actionText: (a, t) => `🎶 **${a}** sacó a bailar a **${t}** con mucho ritmo!`,
    selfText: (a) => `🎶 **${a}** está bailando felizmente!`,
    cronaTargetText: (a) =>
      `🎶 **${a}** me sacó a bailar... ¡Maka nunca me enseñó estos pasos, no sé cómo lidiar con esto!`,
    counterLabel: 'bailes compartidos',
  },
];

export const roleplayCommands: CronaCommand[] = ROLEPLAY_ACTIONS.map((cfg) => {
  const builder = new SlashCommandBuilder()
    .setName(cfg.name)
    .setDescription(cfg.description)
    .addUserOption((opt) =>
      opt
        .setName('usuario')
        .setDescription('El usuario con el que quieres interactuar')
        .setRequired(cfg.requiresTarget)
    );

  return {
    name: cfg.name,
    aliases: cfg.aliases,
    description: cfg.description,
    category: 'Roleplay',
    usage: cfg.requiresTarget ? `${cfg.name} <@usuario>` : `${cfg.name} [@usuario]`,
    cooldown: 3,
    slashData: builder,
    execute: async (ctx) => {
      const target = await ctx.getTargetUser('usuario', 0);
      const authorName = ctx.author.displayName || ctx.author.username;

      if (cfg.requiresTarget && !target) {
        await ctx.reply({
          embeds: [
            createCronaEmbed(COLORS.LOVE).setDescription(
              `${EMOJIS.CRONA_SHY} M-Menciona a alguien para usar \`${ctx.prefix}${cfg.name} @usuario\`...`
            ),
          ],
        });
        return;
      }

      const gif = await fetchAnimeGif(cfg.categoryGif);
      const embed = createCronaEmbed(COLORS.LOVE, ctx.author).setImage(gif.url);

      if (!target || target.id === ctx.author.id) {
        embed.setDescription(cfg.selfText(authorName));
      } else if (target.id === ctx.client.user?.id) {
        const count = incrementInteraction(ctx.author.id, target.id, cfg.name);
        embed.setDescription(
          `${cfg.cronaTargetText(authorName)}\n-# ✨ *Llevan **${count}** ${cfg.counterLabel}*`
        );
      } else {
        const targetName = target.displayName || target.username;
        const count = incrementInteraction(ctx.author.id, target.id, cfg.name);
        embed.setDescription(
          `${cfg.actionText(authorName, targetName)}\n-# ✨ *Llevan **${count}** ${cfg.counterLabel}*`
        );
      }

      if (gif.animeName) {
        embed.setFooter({
          text: `Anime: ${gif.animeName} • Crona Roleplay`,
        });
      }

      await ctx.reply({ embeds: [embed] });
    },
  };
});
