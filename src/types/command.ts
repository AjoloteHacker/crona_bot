import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  MessageActionRowComponentBuilder,
  User,
  GuildMember,
  Guild,
  TextBasedChannel,
  Client,
} from 'discord.js';

export type CommandCategory =
  | 'Roleplay'
  | 'Economía'
  | 'Perfil y Niveles'
  | 'Social y Matrimonio'
  | 'Diversión y Minijuegos'
  | 'Moderación'
  | 'Música'
  | 'Utilidad';

export interface ReplyPayload {
  content?: string;
  embeds?: EmbedBuilder[];
  components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
  ephemeral?: boolean;
}

/**
 * Contexto unificado para ejecutar comandos tanto por Slash (/) como por Prefijo clásico (c!)
 */
export interface UnifiedContext {
  client: Client;
  isSlash: boolean;
  interaction?: ChatInputCommandInteraction;
  message?: Message;
  author: User;
  member: GuildMember | null;
  guild: Guild | null;
  channel: TextBasedChannel | null;
  args: string[];
  prefix: string;
  reply: (payload: ReplyPayload | string) => Promise<Message | any>;
  getTargetUser: (optionName?: string, argIndex?: number) => Promise<User | null>;
  getString: (optionName: string, argIndex?: number, joinRest?: boolean) => string | null;
  getNumber: (optionName: string, argIndex?: number) => number | null;
}

export interface CronaCommand {
  name: string;
  aliases?: string[];
  description: string;
  category: CommandCategory;
  usage?: string;
  cooldown?: number; // en segundos
  slashData:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (ctx: UnifiedContext) => Promise<void>;
}
