// Tekstet lokale të KAFE? dhe të reflektimit javor. Ndërtohen nga template, pa internet dhe pa API.
// {What} = aktiviteti me shkronjë të madhe në fillim.
export default {
  sq: {
    act: {
      kafe: 'një kafe', shetitje: 'një shëtitje', telefonate: 'një telefonatë e shkurtër',
      basketboll: 'basketboll', mesim: 'mësim bashkë', mesazh: 'një mesazh i shkurtër'
    },
    tone: { casual: 'I rehatshëm', warm: 'I ngrohtë', direct: 'I drejtpërdrejtë', short: 'Shumë i shkurtër' },
    tpl: {
      casual: ["Ç'kemi {name}? A je i lirë për {what} këtë javë?", '{name}, ke kohë për {what} ndonjë ditë këto ditë?', 'Hej {name}, po mendoja për {what}. A të bie mirë?'],
      warm: ['{name}, ka ca kohë pa u parë. A gjejmë kohë për {what}?', 'Përshëndetje {name}. Do të më bënte mirë të flisnim pak — ndoshta {what}?', '{name}, më ka marrë malli. {What} këtë javë?'],
      direct: ['{name}, a ke kohë për {what} këtë javë? Më thuaj cila ditë të përshtatet.', '{name}, po propozoj {what}. A të bie mirë nesër ose pasnesër?', '{name}, dua të takohemi. {What}, kur të kesh kohë?'],
      short: ['{name}, {what}?', '{name}, a dalim këtë javë?', '{name}, {what} nesër?']
    },
    you: 'ti',
    reasonSocial: 'Lidhja sociale ka qenë nën patternin tënd të zakonshëm këtë javë.',
    reasonGap: 'Kanë kaluar {n} ditë nga hera e fundit që e shënove këtë kontakt.',
    reasonHelp: 'Në të dhënat e tua, ditët me "{tag}" kanë pasur {metric} më të lartë.',
    reasonDefault: 'Një hap i vogël, kur të kesh kohë. Pa detyrim.',
    qSleep: 'Çfarë e zhvendosi orën e gjumit këtë javë?',
    qSocial: 'Cila ditë e kësaj jave të dha më shumë kohë me të tjerët?',
    qLoad: 'Cila pjesë e ngarkesës mund të shtyhet për javën tjetër?',
    qAny: 'Cila ditë e kësaj jave ishte më ndryshe nga të tjerat?',
    qNone: 'Çfarë do të mbash njësoj edhe javën tjetër?',
    stepHelp: 'Provo "{tag}" një ditë më shumë javën e ardhshme. Deri tani, ditët me të kanë pasur {metric} mesatarisht {lift} pikë ndryshe.',
    stepSocial: 'Përgatit një mesazh të shkurtër te {name}. Ti vendos nëse e dërgon.',
    stepDefault: 'Vazhdo check-in-in e përditshëm edhe disa ditë, që baseline-i të bëhet më i saktë.'
  },
  en: {
    act: {
      kafe: 'a coffee', shetitje: 'a walk', telefonate: 'a short phone call',
      basketboll: 'basketball', mesim: 'studying together', mesazh: 'a short message'
    },
    tone: { casual: 'Relaxed', warm: 'Warm', direct: 'Direct', short: 'Very short' },
    tpl: {
      casual: ["What's up {name}? Are you free for {what} this week?", '{name}, do you have time for {what} one of these days?', 'Hey {name}, I was thinking about {what}. Does that work for you?'],
      warm: ["{name}, it's been a while. Can we find time for {what}?", "Hi {name}. It would be good to talk a bit — maybe {what}?", '{name}, I miss you. {What} this week?'],
      direct: ['{name}, do you have time for {what} this week? Tell me which day suits you.', "{name}, I'm suggesting {what}. Does tomorrow or the day after work?", '{name}, I would like to meet. {What}, whenever you have time?'],
      short: ['{name}, {what}?', '{name}, shall we go out this week?', '{name}, {what} tomorrow?']
    },
    you: 'you',
    reasonSocial: 'Social connection has been below your usual pattern this week.',
    reasonGap: '{n} days have passed since you last marked this contact.',
    reasonHelp: 'In your data, days with "{tag}" had higher {metric}.',
    reasonDefault: 'A small step, when you have time. No obligation.',
    qSleep: 'What shifted your sleep time this week?',
    qSocial: 'Which day this week gave you the most time with others?',
    qLoad: 'Which part of the load could be moved to next week?',
    qAny: 'Which day this week was most different from the others?',
    qNone: 'What will you keep the same next week too?',
    stepHelp: 'Try "{tag}" one more day next week. So far, days with it have had {metric} on average {lift} points different.',
    stepSocial: 'Prepare a short message to {name}. You decide whether to send it.',
    stepDefault: 'Keep up the daily check-in for a few more days, so the baseline becomes more accurate.'
  }
};
