import type { InterviewPrompt, PreferredLanguage } from '@kinlore/core';

interface BankPrompt extends InterviewPrompt {
  requires?: string;
}

function prompt(
  language: PreferredLanguage,
  topic: string,
  text: string,
  requires?: string,
): BankPrompt {
  const id = `${language}-${topic}`;
  const row: BankPrompt = { id, language, topic, text };
  if (requires !== undefined) {
    row.requires = requires;
  }
  return row;
}

/** Fixed questions. Kinlore asks these; it does not invent an elder's answer. */
export const QUESTION_BANK: readonly BankPrompt[] = [
  prompt('en', 'childhood', 'What was your home like when you were a child?'),
  prompt('en', 'place', 'What do you remember about the place before it changed?'),
  prompt('en', 'food', 'How do you cook the dish you make best? Start from the beginning.'),
  prompt('en', 'festival', 'How did your family celebrate Sankranti?'),
  prompt('en', 'family', 'Who told you stories when you were young?'),
  prompt('en', 'work', 'What work did you do, and what was a normal day like?'),
  prompt('en', 'saying', 'What saying do you repeat, and where did you hear it?'),
  prompt('en', 'migration', 'What was the journey like when the family moved?'),
  prompt(
    'en',
    'food-follow',
    'Who taught you that dish, and what did they do differently?',
    'food',
  ),
  prompt('en', 'place-follow', 'Who lived next door, and what did you do together?', 'place'),

  prompt('te', 'childhood', 'చిన్నప్పుడు మీ ఇల్లు ఎలా ఉండేది?'),
  prompt('te', 'place', 'కాలువ రాకముందు ఊరు ఎలా ఉండేది?'),
  prompt('te', 'food', 'మీకు బాగా వచ్చే వంటకం ఎలా చేస్తారు? మొదటి నుంచి చెప్పండి.'),
  prompt('te', 'festival', 'మీ ఇంట్లో సంక్రాంతి ఎలా జరుపుకునేవారు?'),
  prompt('te', 'family', 'చిన్నప్పుడు మీకు కథలు ఎవరు చెప్పేవారు?'),
  prompt('te', 'work', 'మీరు చేసిన పని ఏమిటి? ఒక సాధారణ రోజు ఎలా ఉండేది?'),
  prompt('te', 'saying', 'మీరు తరచుగా చెప్పే మాట ఏమిటి? అది ఎక్కడ విన్నారు?'),
  prompt('te', 'migration', 'కుటుంబం ఊరు మారినప్పుడు ప్రయాణం ఎలా ఉండేది?'),
  prompt('te', 'food-follow', 'ఆ వంటకం మీకు ఎవరు నేర్పారు? వాళ్లు ఏం మార్చేవారు?', 'food'),
  prompt('te', 'place-follow', 'పక్కింట్లో ఎవరు ఉండేవారు? మీరు కలిసి ఏం చేసేవారు?', 'place'),

  prompt('hi', 'childhood', 'जब आप छोटे थे तब घर कैसा था?'),
  prompt('hi', 'place', 'नहर आने से पहले गाँव कैसा था?'),
  prompt('hi', 'food', 'जो पकवान आपको सबसे अच्छा आता है, वह कैसे बनाते हैं? शुरू से बताइए.'),
  prompt('hi', 'festival', 'आपके घर में संक्रांति कैसे मनाते थे?'),
  prompt('hi', 'family', 'बचपन में आपको कहानियाँ कौन सुनाता था?'),
  prompt('hi', 'work', 'आपने क्या काम किया, और एक आम दिन कैसा होता था?'),
  prompt('hi', 'saying', 'आप कौन-सी कहावत अक्सर कहते हैं, और वह कहाँ से सुनी?'),
  prompt('hi', 'migration', 'जब परिवार जगह बदला, यात्रा कैसी थी?'),
  prompt('hi', 'food-follow', 'वह पकवान आपको किसने सिखाया, और वे क्या अलग करते थे?', 'food'),
  prompt('hi', 'place-follow', 'बगल में कौन रहता था, और साथ में क्या करते थे?', 'place'),

  prompt('ta', 'childhood', 'சின்ன வயதில் உங்கள் வீடு எப்படி இருந்தது?'),
  prompt('ta', 'place', 'கால்வாய் வருவதற்கு முன் ஊர் எப்படி இருந்தது?'),
  prompt(
    'ta',
    'food',
    'உங்களுக்கு நன்றாக வரும் உணவை எப்படி சமைப்பீர்கள்? ஆரம்பத்திலிருந்து சொல்லுங்கள்.',
  ),
  prompt('ta', 'festival', 'உங்கள் வீட்டில் பொங்கல் எப்படி கொண்டாடினீர்கள்?'),
  prompt('ta', 'family', 'சிறுவயதில் கதை சொன்னது யார்?'),
  prompt('ta', 'work', 'நீங்கள் செய்த வேலை என்ன? ஒரு சாதாரண நாள் எப்படி இருந்தது?'),
  prompt('ta', 'saying', 'நீங்கள் அடிக்கடி சொல்லும் பழமொழி என்ன? அதை எங்கே கேட்டீர்கள்?'),
  prompt('ta', 'migration', 'குடும்பம் ஊர் மாறியபோது பயணம் எப்படி இருந்தது?'),
  prompt(
    'ta',
    'food-follow',
    'அந்த உணவை யார் கற்றுத் தந்தார்கள்? அவர்கள் என்ன வித்தியாசம் செய்தார்கள்?',
    'food',
  ),
  prompt(
    'ta',
    'place-follow',
    'பக்கத்து வீட்டில் யார் இருந்தார்கள்? சேர்ந்து என்ன செய்தீர்கள்?',
    'place',
  ),
];

const KEYWORDS: Record<string, readonly string[]> = {
  childhood: ['child', 'home', 'house', 'ఇల్లు', 'చిన్న', 'घर', 'छोट', 'வீடு', 'வயது'],
  place: ['village', 'canal', 'street', 'ఊరు', 'కాలువ', 'गाँव', 'नहर', 'ஊர்', 'கால்வாய்'],
  food: ['cook', 'recipe', 'dish', 'pongal', 'వంట', 'పొంగలి', 'पकवान', 'रसोई', 'சமை', 'பொங்கல்'],
  festival: ['sankranti', 'festival', 'సంక్రాంతి', 'संक्रांति', 'பொங்கல்'],
  family: ['story', 'stories', 'కథ', 'कहान', 'கதை'],
  work: ['work', 'job', 'పని', 'काम', 'வேலை'],
  saying: ['saying', 'proverb', 'మాట', 'कहावत', 'பழமொழி'],
  migration: ['journey', 'moved', 'ప్రయాణ', 'यात्रा', 'பயண'],
};

export function topicsInText(text: string): string[] {
  const haystack = text.toLocaleLowerCase();
  const found: string[] = [];
  for (const [topic, words] of Object.entries(KEYWORDS)) {
    if (words.some((word) => haystack.includes(word.toLocaleLowerCase()))) {
      found.push(topic);
    }
  }
  return found;
}

export function coveredTopics(texts: readonly string[]): string[] {
  const topics = new Set<string>();
  for (const text of texts) {
    for (const topic of topicsInText(text)) {
      topics.add(topic);
    }
  }
  return [...topics];
}

export function nextPrompts(input: {
  language: PreferredLanguage;
  coveredTopics: readonly string[];
  usedPromptIds: readonly string[];
  limit?: number;
}): InterviewPrompt[] {
  const limit = input.limit ?? 3;
  const covered = new Set(input.coveredTopics);
  const used = new Set(input.usedPromptIds);
  const pool = QUESTION_BANK.filter(
    (item) => item.language === input.language && !used.has(item.id),
  );
  const followUps = pool.filter(
    (item) => item.requires !== undefined && covered.has(item.requires),
  );
  const primary = pool.filter((item) => item.requires === undefined && !covered.has(item.topic));
  const chosen = [...followUps, ...primary].slice(0, limit);
  return chosen.map((item) => ({
    id: item.id,
    language: item.language,
    topic: item.topic,
    text: item.text,
  }));
}
