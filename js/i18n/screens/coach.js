// Shabllonet e MIRA-s: Conversation Coach, Help Me Start, Talk It Through dhe ndihma sociale.
// Draftet janë pika fillimi — përdoruesi i ndryshon dhe i kopjon vetë. Asgjë nuk dërgohet.
export default {
  sq: {
    someone: 'dikush', greet: 'Hej {name},',
    sc: {
      apologize: 'Të kërkosh falje', boundary: 'Të vendosësh një kufi', argument: 'Të zgjidhësh një grindje',
      include: 'Të kërkosh të përfshihesh', say_no: 'Të thuash jo', parent: 'Të flasësh me një prind',
      teacher: 'Të flasësh me një mësues', ask_help: 'Të kërkosh ndihmë', check_friend: 'Të pyesësh si është një shok'
    },
    tone: { calm: 'I qetë', warm: 'I ngrohtë', direct: 'I drejtpërdrejtë', short: 'Shumë i shkurtër' },
    draft: {
      apologize: {
        calm: 'Kam menduar për atë që ndodhi. Nuk e kisha mirë dhe më vjen keq. Do të doja ta sqaronim kur të kesh kohë.',
        warm: 'Më vjen shumë keq për atë që thashë. Ti ke rëndësi për mua dhe nuk doja të të lëndoja. A mund të flasim?',
        direct: 'E kisha gabim. Më fal. Nuk do ta bëj sërish.',
        short: 'Më fal për dje. E kisha gabim.'
      },
      boundary: {
        calm: 'Dua të them diçka me qetësi: nuk ndihem mirë kur ndodh kjo. Do të më ndihmonte shumë nëse nuk përsëritet.',
        warm: 'E vlerësoj shoqërinë tonë, prandaj po ta them hapur: kjo gjë më shqetëson. A mund ta shmangim?',
        direct: 'Nuk më pëlqen kur ndodh kjo. Të lutem mos e bëj më.',
        short: 'Kjo nuk më përshtatet. Të lutem ndalo.'
      },
      argument: {
        calm: 'Mendoj se të dy u nxehëm. Do të doja ta dëgjoja edhe anën tënde, pa u grindur.',
        warm: 'Nuk dua që kjo të na largojë. A mund të ulemi dhe ta shohim bashkë?',
        direct: 'Le ta zgjidhim këtë. Kur ke 10 minuta për të folur?',
        short: 'A flasim për dje? Dua ta rregullojmë.'
      },
      include: {
        calm: 'Pashë që po planifikoni diçka. Nëse ka vend, do të doja të vija edhe unë.',
        warm: 'Më mungon të kaloj kohë me ju. A mund t\'ju bashkohem herën tjetër?',
        direct: 'Dua të jem pjesë e planeve tuaja. A mund të vij?',
        short: 'A mund të vij edhe unë?'
      },
      say_no: {
        calm: 'Faleminderit që më pyete. Këtë herë nuk mundem, por shpresoj të kuptosh.',
        warm: 'Më vjen mirë që më ftove, por sot kam nevojë për pak kohë për veten. Herën tjetër!',
        direct: 'Jo, faleminderit. Nuk dua ta bëj këtë.',
        short: 'Jo, faleminderit.'
      },
      parent: {
        calm: 'A ke pak kohë sot? Dua të flas për diçka që më rëndon. Nuk kam nevojë për zgjidhje menjëherë, vetëm të më dëgjosh.',
        warm: 'E di që je i/e zënë, por do të doja të flisja me ty për diçka të rëndësishme për mua.',
        direct: 'Kam nevojë të flas me ty për diçka. Kur mundesh sot?',
        short: 'Mund të flasim pak sot?'
      },
      teacher: {
        calm: 'Mirëdita. Kam vështirësi me një pjesë të lëndës dhe do të doja pak ndihmë ose një shpjegim shtesë. Kur do të ishte e përshtatshme?',
        warm: 'Mirëdita. Po përpiqem shumë me këtë lëndë, por një pjesë nuk më qartësohet. A mund të më ndihmoni?',
        direct: 'Mirëdita. Kam nevojë për ndihmë me këtë temë. A keni kohë pas orës?',
        short: 'A mund t\'ju pyes diçka pas orës?'
      },
      ask_help: {
        calm: 'Po kaloj një periudhë pak të vështirë dhe do të më ndihmonte të flisja me dikë. A ke kohë?',
        warm: 'Të besoj dhe prandaj po të shkruaj. Kam nevojë për pak ndihmë me diçka.',
        direct: 'Kam nevojë për ndihmë. A mund të flasim sot?',
        short: 'A ke pak kohë? Më duhet ndihmë.'
      },
      check_friend: {
        calm: 'Kohët e fundit më dukesh pak ndryshe. Si je vërtet? Jam këtu nëse do të flasësh.',
        warm: 'Po mendoja për ty. Nuk ke pse të më tregosh gjithçka, por dua ta dish që jam këtu.',
        direct: 'Si je? Më duket se diçka po të rëndon.',
        short: 'Si je? Jam këtu.'
      }
    },
    start: {
      write: { first: 'Shkruaj vetëm titullin dhe një fjali të parë — edhe nëse s\'është perfekte.', steps: ['Shkruaj 3 ide në pika.', 'Zgjero idenë e parë në një paragraf.', 'Lexoje një herë dhe ndrysho vetëm një gjë.'] },
      math: { first: 'Hap ushtrimin e parë dhe shkruaj çfarë jepet dhe çfarë kërkohet.', steps: ['Gjej një shembull të ngjashëm në libër ose fletore.', 'Zgjidh vetëm ushtrimin e parë.', 'Shëno pyetjen që të ngeci, për ta pyetur dikë.'] },
      study: { first: 'Hap materialin dhe lexo vetëm titujt e temës.', steps: ['Zgjidh një nëntemë të vetme.', 'Mbyll librin dhe shkruaj çfarë mban mend.', 'Kontrollo çfarë mungoi dhe përsërite vetëm atë.'] },
      read: { first: 'Lexo vetëm faqen e parë ose dy minuta.', steps: ['Nënvizo një fjali që të duket e rëndësishme.', 'Lexo deri në fund të kapitullit.', 'Shkruaj një fjali për atë që lexove.'] },
      project: { first: 'Shkruaj në një letër çfarë duhet të përmbajë projekti.', steps: ['Ndaje në 3 pjesë.', 'Zgjidh pjesën më të lehtë dhe fillo me të.', 'Shëno kë mund të pyesësh nëse ngec.'] },
      tidy: { first: 'Vendos vetëm 5 gjëra në vendin e tyre.', steps: ['Pastro një sipërfaqe të vetme.', 'Largo gjërat që nuk të duhen më.', 'Ndalu pas 10 minutash — mjafton për sot.'] },
      general: { first: 'Bëj pjesën më të vogël të mundshme për 2 minuta.', steps: ['Shkruaj hapin tjetër të qartë.', 'Punoji 10 minuta pa telefon.', 'Vendos ku do të ndalesh për sot.'] }
    },
    talk: {
      intro: 'Shkruaj lirshëm. Unë dëgjoj para se të jap këshilla. Kjo bisedë nuk ruhet.',
      placeholder: 'Shkruaj këtu…', send: 'Vazhdo', silence: 'Në rregull. Nuk ke pse të shkruash shumë.',
      echoes: ['Të dëgjova.', 'Faleminderit që e ndave këtë.', 'Kjo tingëllon e rëndë.', 'E kuptoj që ka shumë në mendje.', 'Në rregull, vazhdo.'],
      questions: ['Cila pjesë të rëndon më shumë?', 'Çfarë do të doje të ndodhte?', 'Çfarë ke provuar deri tani?', 'Çfarë do t\'i thoshe një shoku në të njëjtën situatë?', 'Çfarë të duhet tani — të dëgjohesh apo një hap?'],
      toPath: 'Bëjmë një plan të vogël', stop: 'Mjafton për tani', stopped: 'Në rregull. Mund të kthehesh kur të duash.'
    },
    social: {
      icebreaker: ['“Pashë që të pëlqen edhe ty basketbolli — cili është ekipi yt?”', '“Çfarë po luan kohët e fundit?”', '“Çfarë muzike po dëgjon këtë javë?”'],
      intro: ['Shkruaj 2–3 gjëra që të pëlqen të bësh.', 'Thuaj çfarë kërkon: shokë për studim, lojëra, muzikë…', 'Mos shkruaj shkollën, adresën ose numrin tënd.'],
      respectful: ['Fillo me atë që kupton nga mesazhi i tjetrit.', 'Fol për veten: “Unë mendoj…” në vend të “Ti gjithmonë…”.', 'Mund të presësh pak para se të përgjigjesh.'],
      misunderstanding: ['“Mendoj se nuk e kuptuam njëri-tjetrin. Doja të thosha…”', 'Pyet: “Çfarë deshe të thuash me këtë?”', 'Mbaje të shkurtër dhe të qetë.'],
      boundary: ['“Nuk dua të flas për këtë.”', '“Të lutem mos më dërgo më mesazhe të tilla.”', 'Nëse vazhdon: blloko dhe raporto.'],
      block_report: ['Hap profilin ose bisedën dhe zgjidh “Blloko”.', '“Raporto” e dërgon rastin te moderimi (në demo: te radha lokale e moderimit).', 'Fol edhe me një të rritur të besuar nëse diçka të shqetëson.']
    },
    // Ekrani i trajnerit
    pickScenario: 'Për çfarë bisede po përgatitesh?', pickTone: 'Toni', nameLabel: 'Emri (opsional)',
    editHint: 'Ndryshoje si të duash. Asgjë nuk dërgohet — vetëm e kopjon ti.', copy: 'Kopjo draftin', copied: 'Drafti u kopjua. Asgjë nuk u dërgua.',
    startTitle: 'Help Me Start', startIntro: 'Shkruaj detyrën që po e shtyn. MIRA e ndan në një hap 2-minutësh dhe deri në tre hapa të vegjël.',
    startPlaceholder: 'P.sh. “hartimi për letërsi”', startBtn: 'Më ndihmo të filloj', startFirst: 'Hapi 2-minutësh', startNext: 'Pastaj',
    startFocus: 'Fillo një seancë fokusi', startEmpty: 'Shkruaj detyrën fillimisht.'
  },
  en: {
    someone: 'someone', greet: 'Hey {name},',
    sc: {
      apologize: 'Apologizing', boundary: 'Setting a boundary', argument: 'Resolving an argument',
      include: 'Asking to be included', say_no: 'Saying no', parent: 'Talking to a parent',
      teacher: 'Talking to a teacher', ask_help: 'Asking for help', check_friend: 'Checking on a friend'
    },
    tone: { calm: 'Calm', warm: 'Warm', direct: 'Direct', short: 'Very short' },
    draft: {
      apologize: {
        calm: 'I’ve been thinking about what happened. I wasn’t right and I’m sorry. I’d like to talk it through when you have time.',
        warm: 'I’m really sorry for what I said. You matter to me and I didn’t want to hurt you. Can we talk?',
        direct: 'I was wrong. I’m sorry. I won’t do it again.',
        short: 'Sorry about yesterday. I was wrong.'
      },
      boundary: {
        calm: 'I want to say something calmly: I don’t feel okay when this happens. It would really help if it didn’t happen again.',
        warm: 'I value our friendship, so I’m telling you openly: this bothers me. Can we avoid it?',
        direct: 'I don’t like it when this happens. Please don’t do it anymore.',
        short: 'That doesn’t work for me. Please stop.'
      },
      argument: {
        calm: 'I think we both got heated. I’d like to hear your side too, without arguing.',
        warm: 'I don’t want this to push us apart. Can we sit down and look at it together?',
        direct: 'Let’s sort this out. When do you have 10 minutes to talk?',
        short: 'Can we talk about yesterday? I want to fix it.'
      },
      include: {
        calm: 'I saw you’re planning something. If there’s room, I’d like to come too.',
        warm: 'I miss spending time with you all. Could I join next time?',
        direct: 'I want to be part of your plans. Can I come?',
        short: 'Can I come too?'
      },
      say_no: {
        calm: 'Thanks for asking me. I can’t this time, but I hope you understand.',
        warm: 'I’m glad you invited me, but today I need some time for myself. Next time!',
        direct: 'No, thanks. I don’t want to do that.',
        short: 'No, thanks.'
      },
      parent: {
        calm: 'Do you have a little time today? I want to talk about something that’s weighing on me. I don’t need a solution right away, just for you to listen.',
        warm: 'I know you’re busy, but I’d like to talk to you about something important to me.',
        direct: 'I need to talk to you about something. When can you today?',
        short: 'Can we talk a bit today?'
      },
      teacher: {
        calm: 'Hello. I’m having trouble with part of the subject and would like some help or an extra explanation. When would be a good time?',
        warm: 'Hello. I’m trying hard with this subject, but one part still isn’t clear to me. Could you help me?',
        direct: 'Hello. I need help with this topic. Do you have time after class?',
        short: 'Could I ask you something after class?'
      },
      ask_help: {
        calm: 'I’m going through a bit of a hard time and it would help to talk to someone. Do you have time?',
        warm: 'I trust you, and that’s why I’m writing. I need a little help with something.',
        direct: 'I need help. Can we talk today?',
        short: 'Do you have a moment? I need help.'
      },
      check_friend: {
        calm: 'You’ve seemed a bit different lately. How are you really? I’m here if you want to talk.',
        warm: 'I was thinking about you. You don’t have to tell me everything, but I want you to know I’m here.',
        direct: 'How are you? It seems like something is weighing on you.',
        short: 'How are you? I’m here.'
      }
    },
    start: {
      write: { first: 'Write just the title and a first sentence — even if it isn’t perfect.', steps: ['Write 3 ideas as bullet points.', 'Expand the first idea into a paragraph.', 'Read it once and change only one thing.'] },
      math: { first: 'Open the first exercise and write down what is given and what is asked.', steps: ['Find a similar example in the book or notebook.', 'Solve only the first exercise.', 'Write down the question you got stuck on, to ask someone.'] },
      study: { first: 'Open the material and read only the headings of the topic.', steps: ['Pick one single subtopic.', 'Close the book and write what you remember.', 'Check what was missing and review only that.'] },
      read: { first: 'Read only the first page, or for two minutes.', steps: ['Underline one sentence that seems important.', 'Read to the end of the chapter.', 'Write one sentence about what you read.'] },
      project: { first: 'Write on a sheet of paper what the project needs to include.', steps: ['Split it into 3 parts.', 'Pick the easiest part and start with it.', 'Note who you can ask if you get stuck.'] },
      tidy: { first: 'Put just 5 things back in their place.', steps: ['Clear one single surface.', 'Remove things you no longer need.', 'Stop after 10 minutes — that’s enough for today.'] },
      general: { first: 'Do the smallest possible part for 2 minutes.', steps: ['Write down the next clear step.', 'Work on it for 10 minutes without your phone.', 'Decide where you’ll stop for today.'] }
    },
    talk: {
      intro: 'Write freely. I listen before giving advice. This conversation is not saved.',
      placeholder: 'Write here…', send: 'Continue', silence: 'That’s okay. You don’t have to write a lot.',
      echoes: ['I hear you.', 'Thank you for sharing that.', 'That sounds heavy.', 'I understand there’s a lot on your mind.', 'Okay, go on.'],
      questions: ['Which part weighs on you most?', 'What would you want to happen?', 'What have you tried so far?', 'What would you tell a friend in the same situation?', 'What do you need right now — to be heard, or a step?'],
      toPath: 'Let’s make a small plan', stop: 'That’s enough for now', stopped: 'Okay. You can come back whenever you want.'
    },
    social: {
      icebreaker: ['“I saw you also like basketball — which team do you follow?”', '“What game are you playing lately?”', '“What music are you listening to this week?”'],
      intro: ['Write 2–3 things you like doing.', 'Say what you’re looking for: study buddies, games, music…', 'Don’t write your school, address or number.'],
      respectful: ['Start with what you understand from the other person’s message.', 'Talk about yourself: “I think…” instead of “You always…”.', 'You can wait a little before replying.'],
      misunderstanding: ['“I think we misunderstood each other. What I meant was…”', 'Ask: “What did you mean by that?”', 'Keep it short and calm.'],
      boundary: ['“I don’t want to talk about this.”', '“Please don’t send me messages like that anymore.”', 'If it continues: block and report.'],
      block_report: ['Open the profile or chat and choose “Block”.', '“Report” sends the case to moderation (in the demo: the local moderation queue).', 'Also talk to a trusted adult if something bothers you.']
    },
    pickScenario: 'What conversation are you preparing for?', pickTone: 'Tone', nameLabel: 'Name (optional)',
    editHint: 'Change it however you like. Nothing is sent — you copy it yourself.', copy: 'Copy draft', copied: 'Draft copied. Nothing was sent.',
    startTitle: 'Help Me Start', startIntro: 'Write the task you keep putting off. MIRA splits it into a two-minute step and up to three small steps.',
    startPlaceholder: 'E.g. “literature essay”', startBtn: 'Help me start', startFirst: 'The two-minute step', startNext: 'Then',
    startFocus: 'Start a focus session', startEmpty: 'Write the task first.'
  },
  de: {
    someone: 'jemand', greet: 'Hey {name},',
    sc: {
      apologize: 'Sich entschuldigen', boundary: 'Eine Grenze setzen', argument: 'Einen Streit klären',
      include: 'Fragen, ob man dabei sein kann', say_no: 'Nein sagen', parent: 'Mit einem Elternteil sprechen',
      teacher: 'Mit einer Lehrkraft sprechen', ask_help: 'Um Hilfe bitten', check_friend: 'Nach einem Freund sehen'
    },
    tone: { calm: 'Ruhig', warm: 'Warm', direct: 'Direkt', short: 'Sehr kurz' },
    draft: {
      apologize: {
        calm: 'Ich habe über das nachgedacht, was passiert ist. Das war nicht okay von mir und es tut mir leid. Ich würde gern darüber reden, wenn du Zeit hast.',
        warm: 'Es tut mir wirklich leid, was ich gesagt habe. Du bist mir wichtig und ich wollte dich nicht verletzen. Können wir reden?',
        direct: 'Ich lag falsch. Es tut mir leid. Ich mache das nicht wieder.',
        short: 'Sorry wegen gestern. Das war falsch von mir.'
      },
      boundary: {
        calm: 'Ich möchte etwas ruhig sagen: Ich fühle mich nicht gut, wenn das passiert. Es würde mir sehr helfen, wenn es nicht wieder vorkommt.',
        warm: 'Unsere Freundschaft ist mir wichtig, deshalb sage ich es offen: Das stört mich. Können wir das vermeiden?',
        direct: 'Ich mag es nicht, wenn das passiert. Bitte mach das nicht mehr.',
        short: 'Das passt für mich nicht. Bitte hör auf.'
      },
      argument: {
        calm: 'Ich glaube, wir sind beide laut geworden. Ich würde gern auch deine Sicht hören, ohne zu streiten.',
        warm: 'Ich will nicht, dass uns das auseinanderbringt. Können wir uns zusammensetzen und es gemeinsam anschauen?',
        direct: 'Lass uns das klären. Wann hast du 10 Minuten zum Reden?',
        short: 'Können wir über gestern reden? Ich will es klären.'
      },
      include: {
        calm: 'Ich habe gesehen, dass ihr etwas plant. Wenn noch Platz ist, würde ich gern mitkommen.',
        warm: 'Ich vermisse es, Zeit mit euch zu verbringen. Kann ich nächstes Mal dabei sein?',
        direct: 'Ich möchte bei euren Plänen dabei sein. Kann ich mitkommen?',
        short: 'Kann ich auch mitkommen?'
      },
      say_no: {
        calm: 'Danke, dass du mich fragst. Diesmal kann ich nicht, aber ich hoffe, du verstehst das.',
        warm: 'Ich freue mich über die Einladung, aber heute brauche ich etwas Zeit für mich. Nächstes Mal!',
        direct: 'Nein, danke. Das möchte ich nicht.',
        short: 'Nein, danke.'
      },
      parent: {
        calm: 'Hast du heute ein bisschen Zeit? Ich möchte über etwas reden, das mich belastet. Ich brauche nicht sofort eine Lösung, nur dass du zuhörst.',
        warm: 'Ich weiß, dass du viel zu tun hast, aber ich würde gern mit dir über etwas reden, das mir wichtig ist.',
        direct: 'Ich muss mit dir über etwas reden. Wann passt es dir heute?',
        short: 'Können wir heute kurz reden?'
      },
      teacher: {
        calm: 'Guten Tag. Ich habe Schwierigkeiten mit einem Teil des Fachs und hätte gern etwas Hilfe oder eine zusätzliche Erklärung. Wann würde es passen?',
        warm: 'Guten Tag. Ich gebe mir viel Mühe in diesem Fach, aber ein Teil ist mir noch nicht klar. Könnten Sie mir helfen?',
        direct: 'Guten Tag. Ich brauche Hilfe bei diesem Thema. Haben Sie nach der Stunde Zeit?',
        short: 'Darf ich Sie nach der Stunde etwas fragen?'
      },
      ask_help: {
        calm: 'Ich habe gerade eine etwas schwere Zeit und es würde mir helfen, mit jemandem zu reden. Hast du Zeit?',
        warm: 'Ich vertraue dir, deshalb schreibe ich dir. Ich brauche ein bisschen Hilfe bei etwas.',
        direct: 'Ich brauche Hilfe. Können wir heute reden?',
        short: 'Hast du kurz Zeit? Ich brauche Hilfe.'
      },
      check_friend: {
        calm: 'Du wirkst in letzter Zeit etwas anders. Wie geht es dir wirklich? Ich bin da, wenn du reden willst.',
        warm: 'Ich habe an dich gedacht. Du musst mir nicht alles erzählen, aber ich möchte, dass du weißt: Ich bin da.',
        direct: 'Wie geht es dir? Es wirkt, als würde dich etwas belasten.',
        short: 'Wie geht’s dir? Ich bin da.'
      }
    },
    start: {
      write: { first: 'Schreib nur den Titel und einen ersten Satz — auch wenn er nicht perfekt ist.', steps: ['Schreib 3 Ideen als Stichpunkte.', 'Bau die erste Idee zu einem Absatz aus.', 'Lies es einmal und ändere nur eine Sache.'] },
      math: { first: 'Öffne die erste Aufgabe und schreib auf, was gegeben und was gesucht ist.', steps: ['Such ein ähnliches Beispiel im Buch oder Heft.', 'Löse nur die erste Aufgabe.', 'Notier die Frage, bei der du hängst, um jemanden zu fragen.'] },
      study: { first: 'Öffne den Stoff und lies nur die Überschriften des Themas.', steps: ['Wähle ein einziges Unterthema.', 'Schließ das Buch und schreib auf, was du noch weißt.', 'Prüf, was gefehlt hat, und wiederhole nur das.'] },
      read: { first: 'Lies nur die erste Seite oder zwei Minuten lang.', steps: ['Unterstreich einen Satz, der wichtig wirkt.', 'Lies bis zum Ende des Kapitels.', 'Schreib einen Satz über das, was du gelesen hast.'] },
      project: { first: 'Schreib auf ein Blatt, was das Projekt enthalten muss.', steps: ['Teil es in 3 Teile.', 'Wähl den leichtesten Teil und fang damit an.', 'Notier, wen du fragen kannst, wenn du feststeckst.'] },
      tidy: { first: 'Räum nur 5 Dinge an ihren Platz.', steps: ['Räum eine einzige Fläche frei.', 'Sortier Dinge aus, die du nicht mehr brauchst.', 'Hör nach 10 Minuten auf — das reicht für heute.'] },
      general: { first: 'Mach 2 Minuten lang den kleinstmöglichen Teil.', steps: ['Schreib den nächsten klaren Schritt auf.', 'Arbeite 10 Minuten ohne Handy daran.', 'Leg fest, wo du heute aufhörst.'] }
    },
    talk: {
      intro: 'Schreib frei. Ich höre zu, bevor ich Rat gebe. Dieses Gespräch wird nicht gespeichert.',
      placeholder: 'Schreib hier…', send: 'Weiter', silence: 'Das ist okay. Du musst nicht viel schreiben.',
      echoes: ['Ich höre dich.', 'Danke, dass du das teilst.', 'Das klingt schwer.', 'Ich verstehe, dass dir viel durch den Kopf geht.', 'Okay, erzähl weiter.'],
      questions: ['Welcher Teil belastet dich am meisten?', 'Was würdest du dir wünschen?', 'Was hast du bisher versucht?', 'Was würdest du einem Freund in derselben Situation sagen?', 'Was brauchst du gerade — gehört werden oder einen Schritt?'],
      toPath: 'Lass uns einen kleinen Plan machen', stop: 'Das reicht für jetzt', stopped: 'Okay. Du kannst jederzeit zurückkommen.'
    },
    social: {
      icebreaker: ['„Ich habe gesehen, dass du auch Basketball magst — welches Team verfolgst du?“', '„Was spielst du gerade so?“', '„Welche Musik hörst du diese Woche?“'],
      intro: ['Schreib 2–3 Dinge, die du gern machst.', 'Sag, was du suchst: Lernpartner, Spiele, Musik…', 'Schreib nicht deine Schule, Adresse oder Nummer.'],
      respectful: ['Fang mit dem an, was du aus der Nachricht der anderen Person verstehst.', 'Sprich über dich: „Ich finde…“ statt „Du immer…“.', 'Du kannst kurz warten, bevor du antwortest.'],
      misunderstanding: ['„Ich glaube, wir haben uns missverstanden. Ich meinte…“', 'Frag: „Wie hast du das gemeint?“', 'Halte es kurz und ruhig.'],
      boundary: ['„Darüber möchte ich nicht reden.“', '„Bitte schick mir solche Nachrichten nicht mehr.“', 'Wenn es weitergeht: blockieren und melden.'],
      block_report: ['Öffne das Profil oder den Chat und wähle „Blockieren“.', '„Melden“ schickt den Fall an die Moderation (in der Demo: an die lokale Moderationsliste).', 'Sprich auch mit einem Erwachsenen, dem du vertraust, wenn dich etwas beunruhigt.']
    },
    pickScenario: 'Auf welches Gespräch bereitest du dich vor?', pickTone: 'Ton', nameLabel: 'Name (optional)',
    editHint: 'Ändere es, wie du willst. Nichts wird gesendet — du kopierst es selbst.', copy: 'Entwurf kopieren', copied: 'Entwurf kopiert. Nichts wurde gesendet.',
    startTitle: 'Help Me Start', startIntro: 'Schreib die Aufgabe, die du vor dir herschiebst. MIRA teilt sie in einen Zwei-Minuten-Schritt und bis zu drei kleine Schritte.',
    startPlaceholder: 'Z. B. „Aufsatz für Deutsch“', startBtn: 'Hilf mir anzufangen', startFirst: 'Der Zwei-Minuten-Schritt', startNext: 'Danach',
    startFocus: 'Fokus-Session starten', startEmpty: 'Schreib zuerst die Aufgabe.'
  }
};
