import { EmbedBuilder, User } from 'discord.js';
import { COLORS, EMOJIS } from './constants';

export function createCronaEmbed(
  color: number = COLORS.PRIMARY,
  authorUser?: User
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTimestamp()
    .setFooter({
      text: 'Crona & Ragnarok • Shibusen Soul System',
    });

  if (authorUser) {
    embed.setAuthor({
      name: authorUser.displayName || authorUser.username,
      iconURL: authorUser.displayAvatarURL({ size: 128 }),
    });
  }

  return embed;
}

export function createErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setDescription(
      `${EMOJIS.CRONA_SHY} **N-No sé cómo lidiar con este problema...**\n> ${message}`
    );
}

export function createSuccessEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`${EMOJIS.SPARKLES} ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function buildProgressBar(current: number, max: number, length = 12): string {
  const ratio = Math.min(Math.max(current / max, 0), 1);
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  return `\`[${'█'.repeat(filled)}${'░'.repeat(empty)}]\` **${Math.floor(ratio * 100)}%**`;
}
