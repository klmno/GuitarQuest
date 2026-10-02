/* GuitarQuest: help page for the ABC format used by the Creator and by imported .abc files. */
(function (G) {
  'use strict';
  const GQ = G.GQ, h = GQ.h, UI = GQ.ui;

  const EXAMPLES = GQ.abc.EXAMPLES;

  UI.screens.help = function (main) {
    const ex = (key, caption) => h('div.example', null,
      h('pre.abc', null, EXAMPLES[key]),
      h('div.row', null, h('button.btn.small.primary', { onclick: () => UI.openInCreator(EXAMPLES[key]) }, 'Open in the Creator'),
        caption ? h('span.small.muted', null, caption) : null));
    const table = (rows) => h('table.help', null, h('tbody', null, ...rows.map((r) => h('tr', null, h('td', null, h('code', null, r[0])), h('td', null, r[1])))));
    const sec = (title, ...kids) => h('section.card.helpsec', null, h('h2', null, title), ...kids);
    main.append(
      h('div.hero', null, h('div', null, h('h2', null, 'Writing songs in ABC'),
        h('p.muted.small', null, 'ABC is a plain-text way to write music, used for thousands of folk tunes online. GuitarQuest reads it, places the notes on the neck, and turns the song into a lesson.')),
        h('div.row', null, h('a.btn.primary', { href: '#/creator' }, 'Open the Creator'), h('a.btn.ghost', { href: '#/songs/mine' }, 'My songs'))),
      h('nav.helpnav.card', null, ...[['start', 'A first tune'], ['header', 'The header'], ['notes', 'Notes and octaves'], ['lengths', 'Note lengths'], ['bars', 'Bars and repeats'], ['keys', 'Keys and accidentals'], ['tab', 'Tab'], ['chords', 'Chords'], ['guitar', 'GuitarQuest settings'], ['more', 'What else is read'], ['examples', 'More examples'], ['problems', 'Fixing problems']]
        .map(([id, t]) => h('a', { href: '#/help', onclick: (e) => { e.preventDefault(); document.getElementById('h-' + id).scrollIntoView({ behavior: 'smooth' }); } }, t))),
      h('div.helpgrid', null,
        h('div', { id: 'h-start' }, sec('A first tune',
          h('p', null, 'Every tune has a header (lines like ', h('code', null, 'T:'), ' for the title) that ends with the key line ', h('code', null, 'K:'), '. The notes come after it. Bar lines are ', h('code', null, '|'), '.'),
          ex('first', 'Eight bars in C, one quarter note per letter.'))),
        h('div', { id: 'h-header' }, sec('The header',
          h('p', null, 'One field per line. Only ', h('code', null, 'X:'), ' and ', h('code', null, 'K:'), ' are required, and ', h('code', null, 'K:'), ' must come last.'),
          table([['X:1', 'Tune number. Starts a tune (a file can hold several).'], ['T:Title', 'The title shown in the song library.'], ['C:Name', 'Composer, or who wrote it down.'],
            ['M:4/4', 'Meter: 4/4, 3/4, 2/4, 6/8, 12/8, C (= 4/4) or C| (= 2/2).'], ['L:1/8', 'Default note length: what a plain letter is worth. 1/8 if you leave it out (1/16 for meters under 3/4).'],
            ['Q:1/4=90', 'Tempo: 90 quarter notes a minute. Q:3/8=100 is 100 dotted quarters a minute (good for 6/8).'], ['K:G', 'Key. Also K:Am, K:D Dorian, K:A Mixolydian, K:none.'],
            ['R:, O:, N:, S:, Z:', 'Rhythm, origin, notes, source, transcriber: kept as information.'], ['%', 'Starts a comment: the rest of the line is ignored.']]))),
        h('div', { id: 'h-notes' }, sec('Notes and octaves',
          table([['C D E F G A B', 'The octave starting at middle C.'], ['c d e f g a b', 'The octave above.'], ["c' d'", 'One octave higher still (each \' adds an octave).'], ['C, D,', 'One octave lower (each , lowers an octave).'], ['z', 'A rest (silence).'], ['x', 'An invisible rest (also silence).'], ['Z4', 'Four whole bars of rest.']]),
          h('p', null, 'Guitar music is written an octave above how it sounds, and GuitarQuest follows that: a written ', h('code', null, 'C'), ' (middle C) is played as the C on the A string, fret 3. The lowest note, the open low E, is written ', h('code', null, 'E,'), '. If your tune is written at sounding pitch, add ', h('code', null, 'I:octave 0'), ' (see GuitarQuest settings).'))),
        h('div', { id: 'h-lengths' }, sec('Note lengths',
          h('p', null, 'A number after a note multiplies the default length L:. With ', h('code', null, 'L:1/8'), ':'),
          table([['C', 'Eighth note'], ['C2', 'Quarter note'], ['C3', 'Dotted quarter'], ['C4', 'Half note'], ['C8', 'Whole note'], ['C/ or C/2', 'Sixteenth (half as long)'], ['C// or C/4', 'Thirty-second'], ['C3/2', 'Dotted eighth'],
            ['C>D', 'Broken rhythm: C dotted, D half as long (C<D is the reverse, C>>D stronger).'], ['(3CDE', 'Triplet: three notes in the time of two.'], ['C2-C2', 'Tie: one note held for both lengths (same pitch).']]),
          h('p.small.muted', null, 'Spaces between notes don’t change the rhythm; in printed music they only group notes under one beam.'))),
        h('div', { id: 'h-bars' }, sec('Bars and repeats',
          table([['|', 'Bar line'], ['||', 'Double bar line'], ['|]', 'Final bar line'], ['|: ... :|', 'Play the section twice'], [':: or :|:', 'End one repeat and start another'], ['|1 ... :|2 ...', 'First and second endings (also [1 and [2)']]),
          h('p', null, 'GuitarQuest writes repeats out in full, so a repeated section is played and scored twice. Each bar should add up to the meter: the Creator warns you if a bar is too long or too short. A shorter first bar (a pickup) is fine.'))),
        h('div', { id: 'h-keys' }, sec('Keys and accidentals',
          table([['^F', 'F sharp'], ['_B', 'B flat'], ['=F', 'F natural (cancels the key or an earlier sharp)'], ['^^F  __B', 'Double sharp, double flat']]),
          h('p', null, 'The key signature applies to every octave: in ', h('code', null, 'K:G'), ' every F is F sharp. An accidental lasts until the next bar line, for that note in that octave, like in printed music. You can change key in the middle with ', h('code', null, '[K:D]'), '.'))),
        h('div', { id: 'h-chords' }, sec('Chords',
          h('p', null, h('b', null, 'Chord symbols'), ' go in double quotes just before a note: ', h('code', null, '"Am"A2 c2'), '. They set the backing track and show the chord box. GuitarQuest knows the open and barre shapes for major, minor, 7, m7, maj7, sus, add9 and power chords (', h('code', null, '"G5"'), '); a bass note after a slash is ignored (', h('code', null, '"D/F#"'), ' plays D).'),
          h('p', null, h('b', null, 'Notes played together'), ' go in square brackets: ', h('code', null, '[CEG]2'), '. GuitarQuest puts each note on its own string.'),
          ex('chords', 'A melody with chord symbols: the backing plays the chords while you play the tune.'))),
        h('div', { id: 'h-guitar' }, sec('GuitarQuest settings',
          h('p', null, 'These go in the header as ', h('code', null, 'I:'), ' lines (or ', h('code', null, '%%'), ' lines). Other ABC programs ignore them.'),
          table([['I:position 5', 'Play the tune in fifth position (frets 5 to 8, one finger per fret). 0 is open position, the default.'],
            ['I:octave -1', 'Guitar music, written an octave above how it sounds. This is the default. Use 0 to play the notes as written, or -2 to go down another octave.'],
            ['I:play chords', 'Strumming song: every note or x strums the current chord symbol, in that rhythm. On the beat is a down-strum, off the beat an up-strum; z is silence. The default is I:play melody.']]),
          ex('strum', 'A strumming song: the x’s set the rhythm, the chord symbols the chords.'),
          ex('riff', 'A riff in fifth position.'))),
        h('div', { id: 'h-more' }, sec('What else is read',
          h('p', null, 'Decorations (', h('code', null, '!trill! ~ . T'), '), slurs ', h('code', null, '( )'), ', grace notes ', h('code', null, '{g}'), ', lyrics (', h('code', null, 'w:'), ') and extra voices (', h('code', null, 'V:2'), ') are read and skipped: only the first voice is played. Inline changes ', h('code', null, '[M:3/4] [L:1/16] [Q:1/4=120] [K:D]'), ' work anywhere.'),
          h('p', null, 'Not supported yet: bends, slides and hammer-ons (write the notes plainly), and multi-tune medleys in one song (each X: becomes its own song when you import a file).'))),
        h('div', { id: 'h-tab' }, sec('Songs written as tab',
          h('p', null, 'Your own songs can also be written as plain-text guitar tab instead of ABC: choose ', h('b', null, 'Tab'), ' under "Written as" in the Creator, or just paste a tab into a new song. Tab songs keep the exact strings and frets of the tab. They are saved, exported and kept in the songs folder as .tab files.'),
          h('pre.abc', null, GQ.tab.EXAMPLE),
          h('div.row', null, h('button.btn.small.primary', { onclick: () => { GQ.storage.set('creatorDraft', { id: null, abc: GQ.tab.EXAMPLE, format: 'tab', at: Date.now() }); UI.go('#/creator'); } }, 'Open in the Creator')),
          table([['Title: / By: / Tempo: / Time:', 'Optional lines above the tab: the title, who wrote it, quarter notes a minute (100 if left out) and the meter (4/4 if left out).'],
            ['e|---0---|', 'Six lines per block, high e on top. A block with E on top and e at the bottom is read the other way up.'],
            ['|', 'Bar line. Each bar lasts the meter, and the notes in it are placed by their column.'],
            ['5h7  7p5', 'Hammer-on, pull-off.'], ['5/7  7\\5', 'Slide up, down. A slide with nothing before it (/7) is played as a plain note.'],
            ['7b9  7b', 'Bend up to the pitch of fret 9; a whole step if no target is written.'], ['7~', 'Vibrato.'], ['x', 'Dead (muted) note: rhythm only.'],
            ['x3', 'After a block: play the block three times.'], ['pm----', 'On a line under the block: palm mute for the notes above it.']]),
          h('p.small.muted', null, 'Tab doesn’t say how long notes are, so the rhythm is read from the spacing: every note lands on the nearest eighth, or sixteenth when notes are close together. Space the notes evenly and check the result with Listen. Lines that are not tab (chord names, counts, comments) are ignored.'))),
        h('div', { id: 'h-examples' }, sec('More examples',
          ex('jig', 'A traditional jig in 6/8 with a pickup, repeats and an ending bar.'))),
        h('div', { id: 'h-problems' }, sec('Fixing problems',
          table([['"Notes start before the K: line"', 'Move the K: line up so it is the last header line, just above the notes.'],
            ['"… is below the guitar\'s range"', 'The note is lower than the open low E. Raise it an octave (remove a , or add a \'), or use I:octave 0.'],
            ['"Bar 3 lasts 5 beats …"', 'The note lengths in that bar don’t add up to the meter. Check for a missing or extra number.'],
            ['"Unexpected …"', 'A character GuitarQuest doesn’t understand. Click the problem to jump to its line.'],
            ['"No guitar shape for the chord …"', 'That chord name is unusual. It is shown but the backing skips it: try a simpler name (Bbmaj7 → Bb).']]),
          h('p.small.muted', null, 'Your songs are kept in this browser. Use Export on the song card (or Download .abc in the Creator) to back them up or share them.')))));
  };
})(typeof window !== 'undefined' ? window : globalThis);
