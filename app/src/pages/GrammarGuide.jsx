import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const CONCEPTS = [
  {
    id: 'noun',
    en: 'Noun',
    so: 'Magac',
    color: 'blue',
    definition: 'A word for a person, place, thing, or idea.',
    definitionSo: 'Eray loogu talagalay qof, meel, shay, ama fikir.',
    examples: ['Ahmed is my friend.', 'The school is big.', 'I like music.'],
    exampleNotes: ['Ahmed → person / qof', 'school → place / meel', 'music → thing / shay'],
    pattern: 'subject + verb + noun',
  },
  {
    id: 'verb',
    en: 'Verb',
    so: 'Fal',
    color: 'red',
    definition: 'A word that shows an action or a state of being.',
    definitionSo: 'Eray muujinaya fal ama xaalad.',
    examples: ['I eat rice every day.', 'She runs to school.', 'He is tired.'],
    exampleNotes: ['eat → action / fal', 'runs → action / fal', 'is → state / xaalad'],
    pattern: 'subject + verb + ...',
  },
  {
    id: 'adjective',
    en: 'Adjective',
    so: 'Sifo',
    color: 'green',
    definition: 'A word that describes a noun — it tells us more about it.',
    definitionSo: 'Eray sharaxaya magac — waxay noo sheegaysaa wax dheeraad ah.',
    examples: ['Ahmed is a kind man.', 'The food is hot.', 'I have a small house.'],
    exampleNotes: ['kind → describes "man"', 'hot → describes "food"', 'small → describes "house"'],
    pattern: 'adjective + noun   OR   noun + is + adjective',
  },
  {
    id: 'adverb',
    en: 'Adverb',
    so: 'Sifada Fala',
    color: 'purple',
    definition: 'A word that describes a verb, adjective, or another adverb — it tells us HOW, WHEN, WHERE, or HOW MUCH.',
    definitionSo: 'Eray sharaxaya fal, sifo, ama sifada kale — waxay noo sheegaysaa SIDEEd, GOORta, MEEsha, ama INTEE LE\'EG.',
    examples: ['She speaks slowly.', 'He always wakes up early.', 'The test was very hard.'],
    exampleNotes: ['slowly → HOW she speaks', 'always, early → HOW OFTEN / WHEN', 'very → HOW MUCH hard'],
    pattern: 'verb + adverb   OR   very/really + adjective',
  },
  {
    id: 'pronoun',
    en: 'Pronoun',
    so: 'Bedelaha Magaca',
    color: 'yellow',
    definition: 'A word that replaces a noun so we don\'t repeat it.',
    definitionSo: 'Eray bedela magac si aan u soo celi doonin.',
    examples: ['Ahmed is tired. He needs rest.', 'Give the book to Sara. Give it to her.'],
    exampleNotes: ['He = Ahmed', 'it = book, her = Sara'],
    pattern: 'I / you / he / she / it / we / they',
    extra: 'Possessive: my, your, his, her, its, our, their',
  },
  {
    id: 'subject',
    en: 'Subject',
    so: 'Martida Jumlada',
    color: 'teal',
    definition: 'The person or thing doing the action in a sentence.',
    definitionSo: 'Qofka ama shayga fuliya fala ee jumlada.',
    examples: ['Ahmed eats lunch.', 'The dog barks loudly.', 'They study English.'],
    exampleNotes: ['Ahmed → subject', 'The dog → subject', 'They → subject'],
    pattern: '[Subject] + verb + ...',
  },
  {
    id: 'object',
    en: 'Object',
    so: 'Ujeedada Jumlada',
    color: 'orange',
    definition: 'The person or thing that receives the action.',
    definitionSo: 'Qofka ama shayga helaya fala.',
    examples: ['Ahmed eats lunch.', 'She called her mother.', 'I bought a car.'],
    exampleNotes: ['lunch → object (what is eaten)', 'her mother → object (who is called)', 'a car → object (what is bought)'],
    pattern: 'subject + verb + [Object]',
  },
  {
    id: 'present-simple',
    en: 'Present Simple',
    so: 'Waqtiga Hadda Caadiga ah',
    color: 'green',
    definition: 'Used for habits, routines, and facts that are always true.',
    definitionSo: 'Waxaa loo isticmaalaa caadooyinka, jirka, iyo xaqiiqooyinka had iyo jeer saxda ah.',
    examples: ['I eat breakfast every morning.', 'She works at a hospital.', 'Water boils at 100°C.'],
    exampleNotes: ['habit / caado', 'routine / jir', 'fact / xaqiiqo'],
    pattern: 'I/you/we/they + verb   |   he/she/it + verb+s',
    extra: 'Add -s/-es for he/she/it:  eat → eats,  go → goes,  watch → watches',
  },
  {
    id: 'present-continuous',
    en: 'Present Continuous',
    so: 'Waqtiga Hadda Socdaa',
    color: 'green',
    definition: 'Used for actions happening RIGHT NOW or around this time.',
    definitionSo: 'Waxaa loo isticmaalaa falalka HADDA dhacaya ama muddadan dhacaya.',
    examples: ['I am eating lunch right now.', 'She is studying for the test.', 'They are building a new school.'],
    exampleNotes: ['right now', 'around this time', 'currently happening'],
    pattern: 'subject + am/is/are + verb-ing',
    extra: 'am (I) · is (he/she/it) · are (you/we/they)',
  },
  {
    id: 'past-simple',
    en: 'Past Simple',
    so: 'Waqtiga Hore Caadiga ah',
    color: 'orange',
    definition: 'Used for completed actions in the past.',
    definitionSo: 'Waxaa loo isticmaalaa falalka oo dhammaatay ee hore.',
    examples: ['I ate lunch yesterday.', 'She worked at the hospital last year.', 'He went to school in 2010.'],
    exampleNotes: ['yesterday / shalay', 'last year / sanadkii hore', 'specific past time'],
    pattern: 'subject + verb(past form)',
    extra: 'Regular: walk → walked, work → worked\nIrregular: go → went, eat → ate, have → had',
  },
  {
    id: 'future',
    en: 'Future Tense',
    so: 'Waqtiga Mustaqbalka',
    color: 'indigo',
    definition: 'Used for things that will happen later.',
    definitionSo: 'Waxaa loo isticmaalaa waxyaalaha mustaqbalka dhici doona.',
    examples: ['I will call you tomorrow.', 'She is going to study medicine.', 'The exam starts at 9am.'],
    exampleNotes: ['will + verb → simple future', 'going to + verb → planned future', 'present simple → scheduled future'],
    pattern: 'will + verb   OR   am/is/are going to + verb',
  },
  {
    id: 'modal',
    en: 'Modal Verbs',
    so: 'Falaha Qaabka',
    color: 'purple',
    definition: 'Special verbs that show ability, possibility, permission, or obligation.',
    definitionSo: 'Falaha gaar ah ee muujinaya awood, suurtagalnimada, fasaxa, ama waajibka.',
    examples: [
      'I can speak English. (ability / awood)',
      'You should rest. (advice / taalo)',
      'We must pay the bill. (obligation / waajib)',
      'Could you help me? (polite request)',
      'It might rain today. (possibility)',
    ],
    exampleNotes: ['can / could', 'should / ought to', 'must / have to', 'would', 'may / might'],
    pattern: 'subject + modal + base verb (no -s, no -ed)',
    extra: 'Modal verbs NEVER change: He can (not "He cans")',
  },
  {
    id: 'preposition',
    en: 'Preposition',
    so: 'Xididka Meelaha iyo Waqtiga',
    color: 'pink',
    definition: 'A word that shows the relationship between things — usually place, time, or direction.',
    definitionSo: 'Eray muujinaya xiriirka shayga — caadi ahaan meel, waqti, ama jiho.',
    examples: ['The book is on the table.', 'I wake up at 7am.', 'She walked to the store.'],
    exampleNotes: ['on → place / meel', 'at → time / waqti', 'to → direction / jiho'],
    pattern: 'noun + preposition + noun/time',
    extra: 'Place: in, on, at, under, between, next to\nTime: at (7am), on (Monday), in (January/2020)',
  },
  {
    id: 'article',
    en: 'Articles: a / an / the',
    so: 'Xididada: a / an / the',
    color: 'teal',
    definition: '"A/an" is used for any one thing. "The" is used for a specific thing both speaker and listener know.',
    definitionSo: '"A/an" waxaa loo isticmaalaa shay kasta oo mid ah. "The" waxaa loo isticmaalaa shay gaar ah labaduba yaqaanaan.',
    examples: ['I saw a dog. The dog was big.', 'She is a teacher.', 'Please close the door.'],
    exampleNotes: ['a dog → any dog / the dog → that specific dog', 'a teacher → her job (general)', 'the door → both know which door'],
    pattern: 'a + consonant sound  |  an + vowel sound  |  the + specific',
    extra: 'a dog, a car, a university\nan apple, an hour, an elephant',
  },
  {
    id: 'conjunction',
    en: 'Conjunction',
    so: 'Xididka Jumlada',
    color: 'yellow',
    definition: 'A word that connects two words, phrases, or sentences.',
    definitionSo: 'Eray ku xidha laba eray, xarafood, ama jumlood.',
    examples: ['I like tea and coffee.', 'She is tired but she keeps working.', 'I stayed home because it was raining.'],
    exampleNotes: ['and → adds / ku daraa', 'but → contrast / ka soo horjeedaa', 'because → reason / sababta'],
    pattern: 'sentence + conjunction + sentence',
    extra: 'Coordinating: and, but, or, so, yet\nSubordinating: because, although, when, if, since',
  },
  {
    id: 'imperative',
    en: 'Imperative',
    so: 'Amar / Codsi',
    color: 'red',
    definition: 'A sentence that gives a command, instruction, or polite request.',
    definitionSo: 'Jumlad bixinaysa amar, tilmaame, ama codsi xushmad leh.',
    examples: ['Open the window.', 'Please sit down.', 'Don\'t touch that.'],
    exampleNotes: ['command / amar', 'polite request / codsi', 'negative command'],
    pattern: 'verb + ... (no subject needed)',
    extra: 'Negative: Don\'t + verb → "Don\'t run."',
  },
  {
    id: 'comparative',
    en: 'Comparative & Superlative',
    so: 'Isbarbardhigga & Ugu Sareysa',
    color: 'blue',
    definition: 'Comparative compares two things. Superlative shows the most extreme of a group.',
    definitionSo: 'Isbarbardhiggu wuxuu barbardhigayaa laba shay. Ugu sareystu waxay muujisaa ugu dambaysta.',
    examples: ['Ahmed is taller than Omar.', 'This exam is harder than the last one.', 'She is the best student in the class.'],
    exampleNotes: ['taller → comparative (than)', 'harder → comparative (than)', 'best → superlative (the ... in)'],
    pattern: 'adj + -er + than  |  the + adj + -est',
    extra: 'Short: tall→taller→tallest\nLong: beautiful→more beautiful→most beautiful\nIrregular: good→better→best  |  bad→worse→worst',
  },
  {
    id: 'question',
    en: 'Question Words',
    so: 'Erayada Su\'aalaha',
    color: 'indigo',
    definition: 'Words used to ask for specific information.',
    definitionSo: 'Erayo la isticmaalo si loo weydiiyo macluumaad gaar ah.',
    examples: ['What is your name?', 'Where do you live?', 'Why are you late?', 'How do you feel?'],
    exampleNotes: ['What → thing/shay', 'Where → place/meel', 'Why → reason/sababta', 'How → way/qaab'],
    pattern: 'Question word + auxiliary + subject + verb?',
    extra: 'What · Where · When · Who · Why · How · How much · How many · Which',
  },
  {
    id: 'plural',
    en: 'Plural',
    so: 'Badan (in ka badan mid)',
    color: 'green',
    definition: 'Used when there is more than one of something.',
    definitionSo: 'Waxaa loo isticmaalaa marka ka badan mid jiro.',
    examples: ['one book → two books', 'one child → three children', 'one person → many people'],
    exampleNotes: ['regular: +s / +es', 'irregular: child→children', 'irregular: person→people'],
    pattern: 'noun + s/es  (regular)',
    extra: 'Regular: book→books, bus→buses, watch→watches\nIrregular: man→men, woman→women, foot→feet',
  },
  {
    id: 'present-perfect',
    en: 'Present Perfect',
    so: 'Waqtiga Hadda Dhammaatay',
    color: 'teal',
    definition: 'Used for past actions that are connected to now — the exact time is not important.',
    definitionSo: 'Waxaa loo isticmaalaa falalka hore ee xiriir la leh hadda — waqtiga saxda ah muhiim ma aha.',
    examples: ['I have lived here for 5 years.', 'She has visited London.', 'Have you ever eaten sushi?'],
    exampleNotes: ['for/since → ongoing duration', 'life experience (ever/never)', 'question about experience'],
    pattern: 'subject + have/has + past participle',
    extra: 'have (I/you/we/they) · has (he/she/it)\neat → eaten · go → gone · see → seen',
  },
];

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  red:    { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700',     dot: 'bg-red-500' },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  teal:   { bg: 'bg-teal-50',   border: 'border-teal-200',   badge: 'bg-teal-100 text-teal-700',   dot: 'bg-teal-600' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  pink:   { bg: 'bg-pink-50',   border: 'border-pink-200',   badge: 'bg-pink-100 text-pink-700',   dot: 'bg-pink-500' },
};

function ConceptCard({ concept }) {
  const [open, setOpen] = useState(false);
  const c = COLOR_MAP[concept.color] || COLOR_MAP.blue;

  return (
    <div id={concept.id} className={`border-2 rounded-xl overflow-hidden ${c.border} dark:border-opacity-50`}>
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between p-4 text-left ${c.bg} dark:bg-opacity-20`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${c.dot}`} />
          <div>
            <span className="font-bold text-gray-900 dark:text-white text-lg">{concept.en}</span>
            <span className="text-gray-400 mx-2">·</span>
            <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${c.badge} dark:bg-opacity-30`}>{concept.so}</span>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />}
      </button>

      {/* Definition (always visible) */}
      <div className="px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
        <p className="text-gray-800 dark:text-gray-200 text-sm">{concept.definition}</p>
        <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5 italic">{concept.definitionSo}</p>
      </div>

      {/* Expanded content */}
      {open && (
        <div className="px-4 pb-5 bg-white dark:bg-gray-900 space-y-4 border-t border-gray-100 dark:border-gray-700">
          {/* Examples */}
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 mt-3">Examples / Tusaalooyin</p>
            <div className="space-y-2">
              {concept.examples.map((ex, i) => (
                <div key={i} className={`rounded-lg px-4 py-2 flex items-start gap-3 ${c.bg} dark:bg-opacity-20`}>
                  <span className="font-mono text-gray-900 dark:text-gray-100 flex-1 text-sm">{ex}</span>
                  {concept.exampleNotes?.[i] && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 pt-0.5">← {concept.exampleNotes[i]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pattern */}
          {concept.pattern && (
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Pattern / Qaabka</p>
              <code className="block bg-gray-900 text-green-400 rounded-lg px-4 py-2 text-sm font-mono">
                {concept.pattern}
              </code>
            </div>
          )}

          {/* Extra notes */}
          {concept.extra && (
            <div className={`rounded-lg p-3 border ${c.border} ${c.bg} dark:border-opacity-30 dark:bg-opacity-20`}>
              <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Also remember / Xusuusnow:</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{concept.extra}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CATEGORIES = [
  { label: 'Word Types', labelSo: 'Noocyada Ereyada', ids: ['noun', 'verb', 'adjective', 'adverb', 'pronoun'] },
  { label: 'Sentence Parts', labelSo: 'Qaybaha Jumlada', ids: ['subject', 'object', 'preposition', 'article', 'conjunction', 'imperative'] },
  { label: 'Tenses & Time', labelSo: 'Waqtiyada', ids: ['present-simple', 'present-continuous', 'past-simple', 'future', 'present-perfect'] },
  { label: 'Special Forms', labelSo: 'Qaababka Gaar ah', ids: ['modal', 'comparative', 'plural', 'question'] },
];

export default function GrammarGuide() {
  const [search, setSearch] = useState('');
  const conceptMap = Object.fromEntries(CONCEPTS.map(c => [c.id, c]));

  const filtered = search.trim()
    ? CONCEPTS.filter(c =>
        c.en.toLowerCase().includes(search.toLowerCase()) ||
        c.so.toLowerCase().includes(search.toLowerCase()) ||
        c.definition.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-8 h-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Grammar Guide</h1>
        </div>
        <p className="text-indigo-600 dark:text-indigo-400 font-semibold text-lg">Hagaha Naxwaha Ingiriisiga</p>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          All the grammar concepts you need — in English and Somali. Click any concept to expand it.
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5 italic">
          Dhammaan fikradaha naxwaha ee aad u baahan tahay — Ingiriisi iyo Af-Soomaali. Riix fikrad kasta si aad u ballaariso.
        </p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search a concept... (e.g. verb, past, adjective)"
          className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm"
        />
      </div>

      {/* Search results */}
      {filtered ? (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 dark:text-gray-500 py-8">No concepts found for "{search}"</p>
          )}
          {filtered.map(c => <ConceptCard key={c.id} concept={c} />)}
        </div>
      ) : (
        <div className="space-y-10">
          {CATEGORIES.map(cat => (
            <div key={cat.label}>
              <div className="flex items-baseline gap-2 mb-4 border-b-2 border-gray-100 dark:border-gray-700 pb-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{cat.label}</h2>
                <span className="text-gray-400 dark:text-gray-500 text-sm">{cat.labelSo}</span>
              </div>
              <div className="space-y-3">
                {cat.ids.map(id => conceptMap[id] && <ConceptCard key={id} concept={conceptMap[id]} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper used by GrammarDiscovery to detect relevant concept IDs from text
export const GRAMMAR_KEYWORDS = [
  { id: 'verb',             keywords: ['verb', 'action word'] },
  { id: 'noun',             keywords: ['noun'] },
  { id: 'adjective',        keywords: ['adjective', 'describing word', 'adjective order'] },
  { id: 'adverb',           keywords: ['adverb', 'frequency adverb'] },
  { id: 'pronoun',          keywords: ['pronoun', 'possessive pronoun', 'he/she', 'i/you/we'] },
  { id: 'present-simple',   keywords: ['present simple', 'simple present'] },
  { id: 'present-continuous', keywords: ['present continuous', 'present progressive', '-ing'] },
  { id: 'past-simple',      keywords: ['past simple', 'simple past', 'past tense', 'regular vs irregular', 'used to'] },
  { id: 'future',           keywords: ['future', "'will'", 'will for', 'going to'] },
  { id: 'present-perfect',  keywords: ['present perfect', 'have/has', 'for/since', 'experience'] },
  { id: 'modal',            keywords: ['modal', 'can for', 'could', 'should', 'must', 'might', 'may', 'would', 'need to'] },
  { id: 'preposition',      keywords: ['preposition', 'in/on/at', 'at/in/on', 'time preposition', 'location', 'meesha'] },
  { id: 'article',          keywords: ['article', 'a/an', 'the '] },
  { id: 'conjunction',      keywords: ['conjunction', 'because', 'although', 'even though', 'so/', 'and/or'] },
  { id: 'imperative',       keywords: ['imperative', 'command', 'commands without'] },
  { id: 'comparative',      keywords: ['comparative', 'superlative', 'adjective order', '-er', 'more/most'] },
  { id: 'question',         keywords: ['question word', 'which vs', 'how much', 'how many', 'how often', 'what/where'] },
  { id: 'plural',           keywords: ['plural', 'singular', 's/es'] },
];
