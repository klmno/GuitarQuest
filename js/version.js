/* GuitarQuest version. Bump this for every update: it is shown in Settings and the footer, and it
 * also names the offline cache in sw.js, so installed copies pick up the new files. */
(function (G) {
  'use strict';
  G.GQ_VERSION = '1.12.0';
  G.GQ_RELEASED = '2026-10-01';
  G.GQ_CHANGES = [
    ['1.12.0', '2026-10-01', 'Progress while you play: next to the note steps, a bar and a count of the notes played right so far (and how many were missed).'],
    ['1.11.0', '2026-10-01', 'My songs can be written as guitar tab: paste a plain-text tab into the Creator (or import a .tab file) and play it with its exact strings, frets, hammer-ons, slides, bends and palm mutes. Saved and exported as .tab.'],
    ['1.10.0', '2026-10-01', 'Settings > Instrument: flip the fretboard and tab so the low E string is on top, as you see the neck when you look down.'],
    ['1.9.0', '2026-09-28', 'Songs folder: keep My songs as .abc files in a folder on your computer (Chrome and Edge), synced both ways, so they survive cleared browser data. Download all my songs in one .abc file.'],
    ['1.8.0', '2026-09-27', 'New Practice tab: 72 well-known exercises by name (pentatonic boxes, blues scale, the spider, 1-2-3-4, modes, arpeggios, 12-bar shuffle, Travis picking, bends, speed ladders), each with Listen, note steps and scoring.'],
    ['1.7.1', '2026-09-27', 'Creator lists only the first 10 problems, with the total count.'],
    ['1.7.0', '2026-09-27', 'Creator: write your own songs in ABC, hear and check them, and save them to My songs (with Edit, Export and Import .abc). New ABC help page.'],
    ['1.6.0', '2026-09-27', 'Note steps: play any lesson or song with 10% to 100% of its notes and build up; the score is capped at the step.'],
    ['1.5.0', '2026-09-27', 'Version number and release notes in Settings; notice when an update has been installed.'],
    ['1.4.0', '2026-09-26', 'Electric guitar sound for Listen; better detection when earlier notes are still ringing.'],
    ['1.3.0', '2026-09-25', '110 new levels, 44 new songs, and a Listen button for every lesson and song.'],
    ['1.2.0', '2026-09-25', 'Profiles page, profile switcher and "Who’s playing?" at start-up.'],
    ['1.1.0', '2026-09-25', 'Practice runs show on the Learn screen; tuning check survives a reload.'],
    ['1.0.0', '2026-09-24', 'First version: Phases 1 to 3 of the requirements.'],
  ];
})(typeof self !== 'undefined' ? self : globalThis);
