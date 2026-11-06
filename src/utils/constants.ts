export const COLORS = {
  PRIMARY: 0x8b004b, // Carmesí Sangre Negra (Crona)
  SECONDARY: 0x2b0938, // Púrpura oscuro Shibusen
  RAGNAROK: 0xd90429, // Rojo intenso Ragnarok
  SUCCESS: 0x38b000, // Verde alma pura
  WARNING: 0xffbe0b, // Dorado
  ERROR: 0xe63946, // Rojo error
  LOVE: 0xff6b9d, // Rosa estilo Chocolat para roleplay/matrimonio
  ECONOMY: 0x9d4edd, // Violeta de Almas
} as const;

export const EMOJIS = {
  SOUL: '🟣',
  BLACK_BLOOD: '🩸',
  SWORD: '🗡️',
  CRONA_SHY: '🥺',
  RAGNAROK: '💢',
  SPARKLES: '✨',
  HEART: '💖',
  RING: '💍',
  LEVEL: '⭐',
  REP: '🎖️',
  MUSIC: '🎵',
  SHIELD: '🛡️',
} as const;

export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  description: string;
  titleReward?: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'anillo_alma',
    name: 'Anillo de Resonancia de Alma',
    emoji: '💍',
    price: 1500,
    description: 'Necesario para proponer matrimonio a tu persona especial al estilo clásico.',
  },
  {
    id: 'dulces_ragnarok',
    name: 'Bolsa de Dulces para Ragnarok',
    emoji: '🍬',
    price: 300,
    description: 'Calma a Ragnarok por un rato para que deje de golpear a Crona en la cabeza.',
  },
  {
    id: 'pocion_sangre_negra',
    name: 'Vial de Sangre Negra',
    emoji: '🩸',
    price: 2500,
    description: 'Otorga el título exclusivo «Portador de Sangre Negra» para tu perfil.',
    titleReward: '🩸 Portador de Sangre Negra',
  },
  {
    id: 'insignia_shibusen',
    name: 'Insignia de Técnico del Shibusen',
    emoji: '🎓',
    price: 5000,
    description: 'Otorga el título «Técnico Maestro de Shibusen» para tu perfil.',
    titleReward: '🎓 Técnico Maestro de Shibusen',
  },
  {
    id: 'corona_death_scythe',
    name: 'Emblema de Death Scythe',
    emoji: '⚔️',
    price: 12000,
    description: 'El rango más alto de arma en Death City. Desbloquea el título «Death Scythe».',
    titleReward: '⚔️ Death Scythe Legendaria',
  },
  {
    id: 'poema_crona',
    name: 'Poema Depresivo de Crona',
    emoji: '📜',
    price: 800,
    description: 'Un poema escrito en una esquina oscura. Otorga el título «Poeta de la Esquina».',
    titleReward: '📜 Poeta de la Esquina',
  },
];

export const CRONA_QUOTES = [
  '«No sé cómo lidiar con esto...»',
  '«La sangre es negra... ¿verdad? No sé cómo lidiar con la gente nueva...»',
  '«¡Ragnarok, deja de comer mis dulces y deja de pegarme en la cabeza!»',
  '«Maka dijo que podíamos ser amigos... aún no sé muy bien cómo funciona eso.»',
  '«Si me quedo en esta esquina nadie me notará... espero.»',
  '«¿E-Estás seguro de que quieres hablar conmigo? No sé cómo lidiar con tanta atención...»',
];

export const EIGHT_BALL_ANSWERS = [
  { text: 'S-Sí, creo que sí... Maka me dijo que confíe en eso.', type: 'positive' },
  { text: '¡Ragnarok dice que definitivamente SÍ! (Y me pegó por dudar).', type: 'positive' },
  { text: 'Las almas resuenan a tu favor... todo saldrá bien. ✨', type: 'positive' },
  { text: 'Sin ninguna duda... incluso alguien como yo puede verlo.', type: 'positive' },
  { text: 'N-No sé cómo lidiar con esa pregunta... pregunta de nuevo más tarde.', type: 'neutral' },
  { text: 'Ragnarok está comiendo dulces y no quiere responder ahora mismo...', type: 'neutral' },
  { text: 'El futuro está nublado por la locura del Kishin... intenta otra vez.', type: 'neutral' },
  { text: 'Mejor me voy a mi esquina antes de responder eso...', type: 'neutral' },
  { text: 'N-No... definitivamente no. No sé cómo lidiar con lo mal que pinta eso.', type: 'negative' },
  { text: '¡Ragnarok dice que NO y que dejes de soñar! 💢', type: 'negative' },
  { text: 'Mi Sangre Negra tiembla... es una muy mala idea.', type: 'negative' },
  { text: 'Ni siquiera Lord Death aprobaría eso. La respuesta es no.', type: 'negative' },
];

export interface TriviaQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  category: string;
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    question: '¿Cómo se llama el arma demonio que está fusionada con la sangre de Crona en Soul Eater?',
    options: ['Soul Evans', 'Ragnarok', 'Excalibur', 'Tsubaki'],
    answerIndex: 1,
    category: 'Soul Eater',
  },
  {
    question: '¿Cuántas almas malignas y cuántas de bruja necesita un arma para convertirse en Death Scythe?',
    options: [
      '99 almas malignas y 1 alma de bruja',
      '100 almas de bruja',
      '50 almas malignas y 50 de bruja',
      '999 almas de Kishin',
    ],
    answerIndex: 0,
    category: 'Soul Eater',
  },
  {
    question: '¿Cuál es la frase más famosa de Crona cuando se siente abrumado/a?',
    options: [
      '«¡Tonto!» (Baka!)',
      '«No sé cómo lidiar con esto...»',
      '«¡La simetría es todo!»',
      '«¡Superaré mis límites!»',
    ],
    answerIndex: 1,
    category: 'Soul Eater',
  },
  {
    question: '¿Quién es la primera persona que logra hacerse amiga de Crona en Soul Eater?',
    options: ['Blair', 'Medusa Gorgon', 'Maka Albarn', 'Patty Thompson'],
    answerIndex: 2,
    category: 'Soul Eater',
  },
  {
    question: 'En Fullmetal Alchemist, ¿cuál es la ley fundamental de la Alquimia?',
    options: [
      'La Ley de la Resonancia de Almas',
      'El Intercambio Equivalente',
      'La Regla de los Tres Días',
      'El Contrato de Sangre',
    ],
    answerIndex: 1,
    category: 'Anime Clásico',
  },
  {
    question: '¿Cómo se llama la academia fundada por Shinigami-sama (Lord Death) en Soul Eater?',
    options: ['Academia U.A.', 'Shibusen (DWMA)', 'Jujutsu Tech', 'Academia Honnouji'],
    answerIndex: 1,
    category: 'Soul Eater',
  },
  {
    question: '¿Qué obsesión caracteriza a Death the Kid en Soul Eater?',
    options: ['La comida picante', 'La simetría perfecta', 'Dormir todo el día', 'Coleccionar espadas'],
    answerIndex: 1,
    category: 'Soul Eater',
  },
  {
    question: '¿Quién es la madre y creadora de los experimentos con Sangre Negra en Crona?',
    options: ['Arachne', 'Medusa Gorgon', 'Eruka Frog', 'Marie Mjolnir'],
    answerIndex: 1,
    category: 'Soul Eater',
  },
];
