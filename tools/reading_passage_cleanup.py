"""Explicit, reviewed prose repairs. Keep an origin map for answer evidence.

No heuristic deletion of sentences/paragraphs: that caused missing source text
in the earlier extraction. Each removed caption below has been identified.
"""
import re

# Reviewed OCR-highlight spellings, not a general-purpose word joiner.
OCR_WORDS = '''
p l u n ged|p en et rat e|i n spe c t i n g|sac rifi c es|gru el i n g|dem i se|soi l|c on st i t u t es|fl ou ri sh|b l essi n g
i n v aders|su b v ersi v e|c h an n el s|i n gen u i t y|m ec h an i sm
f ram ed|c om p l em en t|i n adeq u at e|i n fl i c t ed|i m p l em en t i n g|i m p osi n g|m ax i m i z i n g
evac u at i on s|c om p l i ed|w i l l|v u l n erab l e|en v i si on|sh i el ds|t u rb u l en c e|det ri m en t al|h au l ed
sc h ol ar|c ol l ab orat i on|m i n gl i n g|al arm i n g|ex t i n c t i on|ob l i v i on|sh ri n k s|ref u ge|t i de|i m m i n en t
st ru ggl i n g|su p p l em en t|sc ru t i n i z ed|f oref ron t|u n p rec eden t ed|n eu ral|ex q u i si t el y|daz z l e
ori gi n at e|c om p at i b l e|sal v age|i n t ri c at e|sen sat i on|v al i d|v i b rat e|c ru de
i m pl i c i t|par am et ers|i deol ogi c al l y|ac adem y|arb i t rary|c om m i ssi on s|den i ed|c on c u rren t l y|p rel i m i n ary
l i t erac y|al l ev i at e|m an u al l y|i n c orp orat es|em i t|di st ort ed|p osi t i on i n g|c om p an i on s|pr ec i si on|i n t erpr et|dedu c e
i n t egrat ed|c orrespo n ds|c oordi n at e|Prot ot y p e|sen t i m en t al|st art l i n g|c ap t i v e|st at e|l i c en sed|piz z a|manufa cturing
b i n d|di sp u t es|q u est|du p l i c at e|h i erarc h y|ab sol u t e|b i ased|i n fe r|c on sol es|c on fi des|c on su l t i n g|su c c essor|n ost al gi a
i n v oki n g|i n i t i at ed|l i b eral|em p i ri c al|sp l en di d|p ersec u t ed|am en di n g|vi ol at e|ap p en dages|i n t egri t y
dep l et ed|fil ed|u n rest rai n ed|rep ri si n g|au sp i c i ou s|m erger|c on v en e|ex p l i c i t|assu res|sal vat i on|i n f i n i t e|ex p l oi t i n g|ri v al|rev el at i on|v ersi on|sk ep t i c al|c om m i t m en t|du rat i on|c on st rai n t
'''
OCR_REPAIRS = [(re.compile(r'(?<!\w)' + re.escape(old.strip()) + r'(?!\w)'), old.replace(' ', '').strip())
               for old in OCR_WORDS.replace('\n', '|').split('|') if old.strip()]
HEADINGS = '''
R e duc i ng t he R i s k|H i g h - Tech Tex t i les|Wear able Elec t r on i c s|F u t u r e War ri or s|Traci n g An c est r y i n D N A|O u t o f Afri c a|Peop li n g t h e Am eri c as|Tast e f or L i f e|Siz e M a tte r s|OF Sa r di ni a ns|A d v e n tis ts|Ok i n a wa n s|Was t e Not , Wan t Not|In Sear ch of O t h er Ear t h s|L i f e—B u t Not as W e K n ow I t ?|W h at Can B e Don e?|An As t er oi d Bomb?|Makin g Sens e of the Wor ld|Str ug gling f or T r uth|Stor m of the Centur y|Coas t lines at Ris k|Retr eat f r om the Coas t|T h e King of Fis h|Conn ec ting B r ain with Machine|B r onz e Hor s e and Las t Supper|A Lif e Unf inis hed|The Per f ec t Loc ation|As s em bling the Ar r ay|Ear l y Dis c over ies
'''.strip().split('|')
FOOTNOTE_MARKERS = '''zenith 2|porous 5|looted 2|hydraulic 10|insurmountable 3|peer review 5|philanthropists 1|stunting 3|blissfully 6|lodging 8|mauled 1|dike 3|inscription 5|gigawatt 1|blossomed 2|jump-start 6|refracted 3|canneries 9|hydroelectric 6|liquid nitrogen 8|autism 8|brain implants 10|ruffling 1|flexing 3|epic 1|inept 2|quorum 5|tap 8|nut 4|enigmatic 2|cryptic 4|cavalry 6|belied 2|bypass 4|Millimeter/submillimeter 4|Caltech’s 5|high-resolution 6|shepherds 7|Big Bang 1|fateful 2|repel 5|Isabella 2|besieged 6|knights’ 7|Visigoth 2|dormant 1|demurely 2|smelters 3|entrenched 9|hoarded 10|eloquence. 11|nest egg 12|stringent 9|quinoa, 10'''.split('|')


def typography(value):
    value = re.sub(r'\s+', ' ', value).strip()
    for pattern, replacement in OCR_REPAIRS:
        value = pattern.sub(replacement, value)
    for old, new in [('proj ect', 'project'), ('j ointly', 'jointly'), ('j ob', 'job'), ('B i tcoins', 'Bitcoins'), ('arks:3 3', 'arks:'), ('taming 4 taming 4 taming 4', 'taming'), ('works. 18 1 Around', 'works. Around'), ('workable 18 plans', 'workable plans'), ('beit. 19 1 The', 'beit. The')]:
        value = value.replace(old, new)
    for marker in FOOTNOTE_MARKERS:
        value = re.sub(r'(?<!\w)' + re.escape(marker) + r'(?!\d)', marker.rsplit(' ', 1)[0], value)
    value = value.replace('/uni00A0', ' ')
    value = re.sub(r'\s*—\s*', '—', value)
    for old, new in [('U. S.', 'U.S.'), ('U. K.', 'U.K.'), ('B. C.', 'B.C.'), ('A. D.', 'A.D.'), ('a .d .', 'A.D.'), ('b.c .', 'B.C.')]:
        value = value.replace(old, new)
    value = re.sub(r'(?<=[a-z])- (?=[a-z])', '-', value)
    value = re.sub(r' +([,.;!?])', r'\1', value)
    return re.sub(r'\s+', ' ', value).strip()

REPLACEMENTS = {
    'rc-level-5-u01-a': [('Chichén Itzá is located in Yucatán—a harsh region of Mexico with no rivers. Cenotes are the only permanent sources of fresh water. ', ''), ('Key to Sur vival ', ''), ('Pleas ing the Rain God ', '')],
    'rc-level-5-u01-b': [('Ruins of more than one thousand temples can be found in the Angkor area. Ta Prohm is one of the best preserved. ', ''), ('An Em pir e’s Fall ', ''), ('3 A si ege is a military or police operation in which soldiers or police surround a place in order to force the people there to come out. Rows of statues stand outside the stone gate of Angkor Thom—the last capital of the Khmer Empire. ', ''), ('5 A t rib u t e is something you give, say, do, or make to show your admiration and respect for someone.', ''), ('doom ed doom ed', 'doomed'), ('civil war,7 7', 'civil war,'), ('regi m e regi m e', 'regime'), ('Khmer Rouge,8 8', 'Khmer Rouge,'), ('su b seq u en t su b seq u en t', 'subsequent')],
    'rc-level-5-u02-b': [('Alex Honnold used ropes to research many routes up El Capitan before attempting his incredible free solo ascent. If someone has poise, they have calm self-confidence. ', ''), ('devoid devoid', 'devoid'), ('delicate delicate', 'delicate'), ('poise.1 1', 'poise.')],
    'rc-level-5-u03-a': [('That the Earth is round has been known since antiquity—but alternative geographies have persisted. This 1893 map by Orlando Ferguson, a South Dakota businessman, is a variation on 19th-century flat-Earth beliefs. Freckles, a genetically modified goat, is one of several preserved specimens at the Center for Postnatural History in Pittsburgh, a museum dedicated to the study of genetic alteration by humans.', ''), ('Ochange', 'change'), ('The I m plic ations of Doubt ', '')],
    'rc-level-5-u04-a': [('“Now, Venice gets giant cruise ships.', ''), ('You can’t understand Venice from 10 stories up; you might as well be in a helicopter.”', ''), ('N 7 A j est er was a professional clown employed by the nobility during the Middle Ages. Jesters’ hats are known for being colorful with pointed tips. ', '')],
    'rc-level-5-u04-b': [('Rot terdam’s Floating Pavilion consists of three interlinked domes. ', ''), ('w i t h st an d w i t h st an d', 'withstand')],
    'rc-level-5-u05-b': [('In Bavaria, Germany, many houses are equipped with their own solar panels. ', '')],
    'rc-level-5-u06-a': [('Iron Age 6', 'Iron Age'), ('Something that u n du l at es moves up and down or back and forth in a smooth, gentle motion. Blood picks up oxygen in the gills.', ''), ('Commercial fishermen unload a giant bluefin tuna on Prince Edward Island, Canada. Due to a dwindling population, the global annual catch of bluefin remains low compared to other species of tuna. ', '')],
    'rc-level-5-u06-b': [('1 When animals f orage, they search for food.', ''), ('6 H y droel ec t ri c is related to electricity made from the energy of running water.', ''), ('An endangered crowned sifaka—one of only 20 individuals living worldwide—is cared for at a zoo in Besancon, France. ', '')],
    'rc-level-5-u07-a': [('psychedelic 4', 'psychedelic'), ('Psy c h edel i c art has bright colors and strange patterns. A colored 3-Dscan of nerve fibers in the brain.', ''), ('The fibers transmit nerve signals between brain regions, and between the brain and spinal cord. Mapp ing the B r ain ', '')],
    'rc-level-5-u07-b': [('As scientists work to link machine and mind, artificial bones, organs, joints, and limbs (parts shaded green and blue) are gaining many of the capabilities of human ones.', ''), ('Electrodes in the eye send the signals to the optic nerve, which sends them to the brain, and a person is able to “see” the images. ', '')],
    'rc-level-5-u08-a': [('Researchers on Appledore Island observe swarming bee behavior. ', '')],
    'rc-level-5-u08-b': [('Leafcutter ants can carry leaf pieces that weigh 20 times their own weight. ', ''), ('O. Wilson, one of the world’s foremost authorities on biodiversity, discusses his lifelong love of the natural world, including its smallest members. ', '')],
    'rc-level-5-u09-a': [('A page from a Leonar do da Vinci notebook, filled with anatomical sketches and notes 18 3 18 ', '')],
    'rc-level-5-u09-b': [('The first recorded text in the Arabic alphabet was written in 512 a .d. 19 ', ''), ('19 3 An exhibitor demonstrates the benefits of electronic paper at the Educational IT Solutions Expo in Tokyo, Japan. ', '')],
    'rc-level-5-u10-a': [('Workers prepare to deliver a new antenna to the ALMA site. ', ''), ('m i l l i m et er = 0.001 m; su b m i l l i m et er = 0.0001 m; the array’s name refers to the range of radiation wavelengths that it can detect.', 'began to realize that by working together, they could build a larger and more powerful array than any one of them could alone.')],
    'rc-level-5-u10-b': [('A London taxi decorated with the periodic table ', ''), ('at t ri b u t es at t ri b u t es', 'attributes'), ('c h arges c h arges', 'charges'), ('c ou n t erp art c ou n t erp art', 'counterpart'), ('c ol l i si on s c ol l i si on s', 'collisions'), ('t ru st w ort h y t ru st w ort h y', 'trustworthy'), ('namesake.4 4', 'namesake.'), ('Beyond Mendelevium ', ''), ('Ac hie ving the Dr eam ', ''), ('belated 0', 'belated')],
    'rc-level-5-u11-a': [('rei gn s rei gn s', 'reigns'), ('SÜLEYMAN Yet', 'Yet'), ('Ferdin an d of Aragon (1452–1516) and Is ab ella of Castile (1451–1504) were rulers of Spain.', ''), ('Hungarian count 0', 'Hungarian count'), ('Mediterranean AA', 'Mediterranean')],
    'rc-level-5-u11-b': [('The interior of Cordoba’s Mosque-Cathedral is a forest of columns and arches. ', ''), ('Alfonso Xsupported', 'Alfonso X supported'), ('Charles Vto', 'Charles V to'), ('Ofurtive love', 'O furtive love')],
    'rc-level-5-u12-a': [('3 S m el t ers are machines or places that melt ores in order to extract the metals they contain.', ''), ('Someone who has the gift of el oq u en c e can write and speak very well. Paw n i n g is the act of giving or depositing personal property as security for payment of money borrowed. Henna and gold bracelets adorn the arms and hands of an Indian bride. ', ''), ('14 Rajam', 'Rajam')],
    'rc-level-5-u12-b': [('1 An i deol ogu e is someone who follows a certain set of political beliefs.', ''), ('Tesla Model Sruns', 'Tesla Model S runs'), ('The salt flat had long been regarded by Bolivians as little more than a geographical anomaly.', 'The salt flat had long been regarded by Bolivians as little more than a geographical anomaly. While surrounding mountains are celebrated in indigenous stories, “the Salar has never had cultural significance,” says Uyuni’s mayor, Patricio Mendoza. “People were afraid that if they took a walk on it, they might get lost and die of thirst or their llamas would damage their hooves on the salt.”')],
    'rc-level-4-u03-a': [('conf ine', 'confine'), ('Track i n g t h e Sou r ce ', ''), ('Students study new techniques of food production at Wageningen University & Research, Netherlands.', ''), ('A medical researcher examines a sample of E. coli. ', ''), ('DNA 4', 'DNA')],
    'rc-level-4-u03-b': [('modif ied', 'modified'), ('Two 18-month-old coho salmon show the difference genetic engineering can make. The top fish has been given a modified gene that allows it to ', ''), ('host 4', 'host'), ('OF GE CROPS, 2015 ', '')],
    'rc-level-4-u04-a': [('A thor ny devil lizar d ', ''), ('drenched!”1 1', 'drenched!”'), ('vital vital', 'vital'), ('biological biological', 'biological'), ('device device', 'device'), ('F r om Nat u r al Won d er t o U s efu l Tool ', ''), ('U n loc k i n g Nat u r e’ s Sec ret s ', ''), ('Cocklebur s have hooked spines that attach to clot hing and animal f ur.', ''), ('This design inspired the creation of Velc ro (r ight ). ', ''), ('termites 5', 'termites'), ('Th e B i o- I n s p i r ed Robot ', ''), ('surveillance 7', 'surveillance'), ('replicate,” 8', 'replicate,”'), ('fu nds', 'funds')],
    'rc-level-4-u07-b': [('Has our increased use of social media unlocked our natural cruelty?', ''), ('Researcher and author Agustín Fuentes examines whether the rise in social media is really to blame for our hostility online. ', ''), ('confr ont', 'confront'), ('How easy is it to throw insults on social media?', ''), ('As visualized by artist Javier Jaén, it’s as easy as a catapult flinging an egg—in this case, the blue egg that was Twitter’s original anonymous avatar. Adults and children gather in Halifax, Canada, to support anti-bullying measures designed to counter online aggression. ', '')],
    'rc-level-4-u08-a': [('In 1821, Napoleon Bonaparte died a prisoner on the island of St. Helena. The official cause of death was stomach cancer. However, a later analysis revealed the presence of arsenic—a classic poison—in Napoleon’s body.', ''), ('Napoleon Crossing the Alps (1802), by French artist Jacques-Louis David ', '')],
    'rc-level-4-u08-b': [('Bacteria and yeast break down complex molecules through a process called f ermentation. A replica of the poison-tipped umbrella used to kill Bulgarian writer Georgi Markov in 1978 ', ''), ('Frank ly,', 'Frankly,')],
    'rc-level-4-u09-a': [('153 After', 'After'), ('3-Dcopy', '3-D copy'), ('a god with the head of a boar.', 'a god with the head of a boar. A tiny goddess standing on his shoulder lovingly rubs his nose. “It reminds me of the wonderful Hollywood movie King Kong,” remarks K. C. Nauriyal, an Indian archeologist working at the site.'), ('slither 5', 'slither'), ('gaz ing', 'gazing')],
    'rc-level-4-u09-b': [('OF On February', 'On February'), ('A The team had come', 'The team had come'), ('known simply as T—', 'known simply as T1—'), ('looting,2', 'looting,'), ('fa scinated', 'fascinated'), ('T, T, and T (Tstands', 'T1, T2, and T3 (T stands'), ('in valleys T and T.', 'in valleys T1 and T3.'), ('Archeologist Oscar Neil Cruz uncovers one of the flat stones encircling a ruined plaza in La Mosquitia. 161 ', ''), ('3-Dscanner', '3-D scanner')],
    'rc-level-4-u10-a': [('At 106, Salvatore Caruso was still taking part in the olive harvest on his family’s land in Molochio, Italy. ', ''), ('More “wellderlies” are joining gyms as a way to keep fit. ', ''), ('without Laron syndrome, percent developed', 'without Laron syndrome, 5 percent developed'), ('Th e Gen e H u n t ', '')],
    'rc-level-4-u10-b': [('D 1 To slaughter animals such as cows and sheep means to kill them for their meat. ', ''), ('slaughtered 1', 'slaughtered'), ('fo rbids', 'forbids'), ('Emma Morano of Italy celebrates her 117th birthday surrounded by friends and family. ', '')],
    'rc-level-4-u11-a': [('Due to water scarcity, billion people', 'Due to water scarcity, 5 billion people'), ('II JJ A Rajasthani woman draws water from a well in the Thar Desert, India. ', '')],
    'rc-level-4-u11-b': [('Th e Pr oblem of E - w as t e ', ''), ('AS e-waste', 'e-waste'), ('haz ardous', 'hazardous'), ('infr astructure', 'infrastructure'), ('A S m all Solu t i on ?', '')],
    'rc-level-4-u12-b': [('An artist’s illustration of a huge asteroid crashing into Earth ', '')],
    'rc-level-3-u01-a': [('Children in the Democratic Republic of the Congo play soccer with a ball made of string and tape. ', ''), ('camaraderie: 1', 'camaraderie:')],
    'rc-level-3-u02-b': [('A model prepares for Fashion Week in New York City.', ''), ('UV rays (or ultra violet rays) from sunlight cause your skin to become darker. ', '')],
    'rc-level-3-u08-a': [('A boat travels down the Beijing-Hangzhou Grand Canal.', ''), ('real estate 4', 'real estate')],
    'rc-level-3-u08-b': [('Sunset over the Amazon rain forest, Madre de Dios, Peru ', ''), ('passageway OF spans', 'passageway spans'), ('unpaved 1', 'unpaved'), ('rural 6', 'rural')],
    'rc-level-4-u01-a': [('1 Something done in an unguarded moment is done when you think no one is watching. ', ''), ('Big Brother 3', 'Big Brother'), ('numb 4', 'numb'), ('prof ound', 'profound')],
    'rc-level-4-u01-b': [('MY IN An Omani fisherman casts his net at dawn. ', ''), ('tuition tuition', 'tuition'), ('teamwork teamwork', 'teamwork'), ('expectations expectations', 'expectations'), ('proj ect', 'project'), ('A portrait of an Indian woman from a poor background who became a solar engineer ', ''), ('L e sson s on t h e Road ', '')],
    'rc-level-4-u02-a': [('U n it 2 A 27 ', ''), ('startle 3', 'startle')],
    'rc-level-4-u02-b': [('his OF wings', 'his wings'), ('ballerina 1', 'ballerina'), ('flap 2', 'flap'), ('U n it 2 B 35 ', '')],
    'rc-level-4-u05-b': [('Pi on e ers of t h e Pac i f i c ', ''), ('navigation navigation', 'navigation'), ('stretch stretch', 'stretch'), ('AA intervalinterval', 'interval'), ('Ho w Di d T h e y Do I t ?', ''), ('stubbornstubborn', 'stubborn'), ('analogous analogous', 'analogous'), ('intactintact', 'intact'), ('oral histories 22', 'oral histories'), ('Hawaiian canoeists race in the waters of Kauai island, using a modern version of an ancient design. The Lapita traveled east from New Guinea some 3,000 years ago, and within a few centuries reached Tonga and Samoa.', ''), ('A thousand years later, their Polynesian descendants pushed farther, eventually reaching the most remote islands in the Pacific. ', ''), ('archipelagos 3', 'archipelagos'), ('twigs 4', 'twigs'), ('Help ed by E l N i ñ o?', '')],
    'rc-level-4-u06-a': [('Th e R i s e of Gold ', ''), ('tangible 2', 'tangible'), ('shells,3', 'shells,'), ('US Th e B i r t h of Trad e ', ''), ('underwrite 6', 'underwrite'), ('A shopper pays with cash at Sri Lanka’s Pettah Market. ', ''), ('Not es an d B i lls ', ''), ('bearer 7', 'bearer'), ('j udgment', 'judgment'), ('Tow ar d V i r t u al Mon ey ', '')],
    'rc-level-4-u06-b': [('Technicians inspect a Bitcoin mining facility in Saint-Hyacinthe, Canada. ', ''), ('W h at I s a V i r t u al C u r ren c y ?', ''), ('verif y', 'verify'), ('H o w Did Bitc o in B e g in ?', ''), ('How Does Bi t c oi n Wor k ?', ''), ('W h at Ar e t h e Ben ef i t s of Usin g a V i r t u al C u r ren c y L i k e B i t coin ?', ''), ('fr aud', 'fraud'), ('stock s:', 'stocks:')],
}


def cleanup(article_id, paragraphs):
    rows = [{'text': text, 'origins': [i]} for i, text in enumerate(paragraphs, 1)]
    def replace(old, new):
        found = False
        for row in rows:
            if old in row['text']:
                row['text'] = row['text'].replace(old, new)
                found = True
        assert found, (article_id, old)

    for old, new in REPLACEMENTS.get(article_id, []):
        replace(old, new)
    if article_id == 'rc-level-4-u03-b':
        replace('A Q: W h at ex ac tly are biotech foods?', 'Q: What exactly are biotech foods?')
        replace('Q : Can bi otech f ood s h el p feed the world?', 'Q: Can biotech foods help feed the world?')
    if article_id == 'rc-level-4-u04-b':
        replace('Sensors on this smart shi rt can monitor the w earer’ s breathing and t ransmit the data to a cell phone. ', '')
    if article_id == 'rc-level-4-u05-a':
        replace('A geneticist is a scientist who studies DNA and genes. ', '')
        replace('scattered scattered', 'scattered')
        replace('Ychromosome', 'Y-chromosome')
    if article_id == 'rc-level-5-u04-a':
        replace('c al l ed', 'called')
    if article_id == 'rc-level-5-u04-b':
        replace('t ook fo r gran t ed', 'took for granted')
    if article_id == 'rc-level-5-u10-a':
        replace('i n op erat i on', 'in operation')
    if article_id == 'rc-level-5-u02-b':
        rows[11]['text'] = rows[11]['text'].split(' Hollow Flake')[0] + ' below freezing.' + rows[16]['text'].split('below freezing.', 1)[1]
        rows[11]['origins'].append(17)
        for row in rows[12:17]:
            row['text'] = ''
    elif article_id == 'rc-level-5-u06-a':
        rows[5]['text'] = 'A bluefin swims' + rows[5]['text'].split('A bluefin swims', 1)[1]
        rows[7]['text'] = rows[7]['text'].split(' These systems are present')[0]
        rows[8]['text'] = 'Tunas have a greater proportion' + rows[8]['text'].split('Tunas have a greater proportion', 1)[1]
    elif article_id == 'rc-level-5-u08-a':
        rows[16]['text'] = rows[16]['text'].split(' Rectal gland')[0] + ' pages that link to them,' + rows[17]['text'].split('pages that link to them,', 1)[1]
        rows[16]['origins'].append(18)
        rows[17]['text'] = ''
    elif article_id == 'rc-level-5-u08-b':
        assert rows[5]['text'].endswith(' E.')
        rows[5]['text'] = rows[5]['text'][:-3]
    elif article_id == 'rc-level-5-u05-b':
        sentence = 'The panels, dispersed across the German countryside, are all connected to the national grid.'
        replace(' ' + sentence, '')
        replace('The solar boom', sentence + ' The solar boom')
        replace('The day before, when snow', '“We are being paid for living in this house,” said Wolfgang Schnürer, one of Solarsiedlung’s residents. The day before, when snow')
    elif article_id == 'rc-level-5-u10-b':
        theory, stalin = rows[9]['text'].split(' Soviet leader', 1)
        seaborg, oganessian = rows[10]['text'].split(' Around the time', 1)
        rows[4]['text'] += ' This heightened secrecy led him to suspect that they were building atomic bombs, and in April 1942, he wrote to Soviet leader' + stalin
        rows[4]['origins'].append(10)
        rows[5]['text'] = ''  # periodic-table diagram labels, not the article
        rows[9]['text'] = theory
        rows[10]['text'] = seaborg + '.'
        rows[8]['text'] = rows[8]['text'].replace('Meanwhile, theorists', 'In the end, a spirit of compromise prevailed: Element 105 was named dubnium and element 106 seaborgium. Meanwhile, theorists')
        rows = rows[:5] + [rows[10]] + rows[6:10] + [{'text': 'Around the time' + oganessian, 'origins': [11]}] + rows[11:]
    elif article_id == 'rc-level-5-u11-a':
        rows[3]['text'] = rows[3]['text'].split(' The Ottoman Empire lasted')[0] + ' and religions' + rows[4]['text'].split(' and religions', 1)[1]
        rows[3]['origins'].append(5)
        mehmed = rows[5]['text'].split(' From his capital Constantinople')[0]
        justice = 'and justice.' + rows[5]['text'].split(' and justice.', 1)[1]
        ambassador, dream = rows[8]['text'].split(' A portrait of Süleyman the Magnificent ', 1)
        rows[5]['text'] = mehmed + ' ' + dream
        rows[5]['origins'].append(9)
        rows[11]['text'] += ' ' + justice
        rows[11]['origins'].append(6)
        rows[8]['text'] = ambassador + ' in gold, in people, in ships, and in obedience; no state can be compared with it.'
        rows[12]['text'] = rows[8]['text'] + ' ' + rows[12]['text']
        rows[12]['origins'].append(9)
        rows[12]['text'] += ' There he was met on the sultan’s behalf by the monarch’s vizier, or grand advisor, who, on special occasions, led the envoy past 2,000 bowing officials and heaps of silver coins.'
        rows[13]['text'] = rows[13]['text'].replace('The visitor was led across', 'The ambassador was robed in gold cloth while his royal presents were inspected, since the sultan was “not to be approached without gifts.” At the door of the throne room, two officials held the visitor firmly by the arms. The visitor was led across')
        tomb_end, mood = rows[21]['text'].split(' Statues in the Turkish-Hungarian Friendship Park commemorate the battle at Szigetvár. ', 1)
        rows[18]['text'] += ' ' + mood
        rows[18]['origins'].append(22)
        rows[21]['text'] = tomb_end
        death, decline = rows[23]['text'].split(' Following Süleyman’s death,', 1)
        decline_end, succession = rows[24]['text'].split(' Three weeks after', 1)
        rows[23]['text'] = death
        rows[24]['text'] = 'Three weeks after' + succession
        # Keep the two independent history sidebars after the continuous article.
        rows = rows[:4] + [rows[5]] + rows[9:12] + rows[6:8] + rows[12:19] + rows[22:26] + rows[19:22] + [{'text': 'Following Süleyman’s death,' + decline + ' ' + decline_end, 'origins': [24, 25]}]
    elif article_id == 'rc-level-5-u11-b':
        rows[6]['text'] = rows[6]['text'].split(' 1 Your t em p eram en t')[0] + ' fair-skinned' + rows[7]['text'].split(' fair-skinned', 1)[1]
        rows[6]['origins'].append(8)
        rows[7]['text'] = ''
        before, remainder = rows[20]['text'].split(' 8 S q u at t ers', 1)
        conclusion, after = remainder.split(' brilliant civilization', 1)[1].split(' CC ', 1)
        rows[20]['text'] = before + ' ' + after
        main_end, sidebar = rows[24]['text'].split(' AA BB ', 1)
        rows[24]['text'] = main_end + ' brilliant civilization' + conclusion.replace('Dark Ages.11', 'Dark Ages.')
        rows[24]['origins'].append(21)
        rows.insert(25, {'text': sidebar, 'origins': [25]})
    elif article_id == 'rc-level-5-u12-a':
        rows[10]['text'] += ' has persuaded' + rows[12]['text'].split(' has persuaded', 1)[1]
        rows[10]['origins'].append(13)
        rows[11]['text'] = rows[12]['text'] = ''  # detached commodity chart commentary
        main, bridal = rows[20]['text'].split(' The gold ornaments', 1)
        rows[20]['text'] = main + ' she has hung a large painting of the yellow Caterpillar 793 on her wall. Nur Piah’s job is not without its hardships. Maneuvering the enormous truck over a 12-hour shift is especially stressful, she says, when the pit’s graded roads are slicked by torrential rains. But now, after a long day, she smiles contentedly as her child, age six, falls asleep on her lap. The girl’s middle name is Higrid, the Indonesian approximation of “high-grade,” the best ore in the mine.'
        rows.insert(21, {'text': 'The gold ornaments' + bridal, 'origins': [21]})
    elif article_id == 'rc-level-1-u04-a':
        intro, later = rows[3]['text'].split('Looking for Intelligent Life ', 1)
        rows[2]['text'] += ' ' + intro
        rows[2]['origins'].append(4)
        rows[3]['text'] = later.replace(' Making Contact ', ' If these planets are similar to Earth and are close enough to a star, they might have intelligent life. ')
        rows = [rows[2], rows[0], rows[1], *rows[3:]]
        replace('radio signals 4', 'radio signals')
    elif article_id == 'rc-level-2-u02-a':
        quotation, intro = rows[1]['text'].split('Herman Melville,', 1)
        rows[1]['text'] = quotation.strip()
        rows.insert(0, {'text': 'Herman Melville,' + intro, 'origins': [2]})
        replace('Recording Gentle Giants ', '')
        replace('A humpback whale calf. Young humpbacks do not stop growing until they are ten years old. ', '')
        replace('looked him over 3', 'looked him over')
        replace('flippers 4', 'flippers')
    elif article_id == 'rc-level-2-u06-a':
        food, intro = rows[2]['text'].split('For uncounted generations,', 1)
        rows[2]['text'] = food.strip()
        continuation, caption = rows[3]['text'].split('Coral reefs occupy less than', 1)
        rows[3]['text'] = ''
        rows.insert(0, {'text': 'For uncounted generations,' + intro + ' ' + continuation, 'origins': [3, 4]})
        replace('Here are some examples of the creatures that call a coral reef home. Spot-banded butterflyfish A blue-girdled angelfish A redfin butterflyfish ', '')
    elif article_id == 'rc-level-3-u09-a':
        intro, rest = rows[5]['text'].split('Interviewer: Explain', 1)
        rows[5]['text'] = 'Interviewer: Explain' + rest
        rows.insert(0, {'text': intro.strip(), 'origins': [6]})
        replace('A video gamer tries a wireless VR headset at the 2019 Consumer Electronics Show in Las Vegas. ', '')
        replace('NFL 1', 'NFL'); replace('plays 3', 'plays'); replace('degrading 5', 'degrading')
        replace('CO degrades', 'CO₂ degrades'); replace('CO 2', 'CO₂')
    elif article_id == 'rc-level-4-u05-b':
        if not rows[-1]['text'].endswith('”'):
            rows[-1]['text'] += '”'
    elif article_id == 'rc-level-4-u06-b':
        rows[12]['text'] = rows[12]['text'].split(' The global market share')[0]
    elif article_id == 'rc-level-4-u04-a':
        # The sidebar was inserted between the verb "create" and "Stickybot".
        # Its independent examples are retained after the main article.
        beginning, sidebar = rows[9]['text'].split(' A cl ose- up l ook at Vel cro • ', 1)
        sidebar_end, continuation = rows[10]['text'].split(' Stickybot,', 1)
        rows[9]['text'] = beginning + ' Stickybot,' + continuation
        rows[9]['origins'].append(11)
        rows[10]['text'] = ''
        for part in (sidebar + ' ' + sidebar_end).split(' • '):
            rows.append({'text': part.strip(), 'origins': [10, 11]})
    elif article_id == 'rc-level-4-u12-a':
        rows[6]['text'] = rows[6]['text'].split(' 0.1 1 10')[0]
        rows[8]['text'] = ''  # floating labels from a missing temperature chart
        rows[9]['text'] = 'The dream of astronomers' + rows[9]['text'].split('The dream of astronomers', 1)[1]
    elif article_id == 'rc-level-4-u12-b':
        first = rows[3]['text'].split(' The colored dots')[0]
        rows[3]['text'] = first + ' Every day,' + rows[3]['text'].split(' Every day,', 1)[1]
        rows[6]['text'] = 'There is evidence that,' + rows[6]['text'].split('There is evidence that,', 1)[1]

    # Repair only typographic spacing, not vocabulary or factual claims.
    output, origin_map = [], {}
    for row in rows:
        value = re.sub(r'\s+', ' ', row['text']).strip()
        for heading in HEADINGS:
            value = value.replace(heading, '')
        value = typography(value)
        if not value:
            continue
        output.append(value)
        for origin in row['origins']:
            origin_map.setdefault(origin, []).append(len(output))
    return output, origin_map
