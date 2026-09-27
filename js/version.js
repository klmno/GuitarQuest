/* GuitarQuest version. Bump this for every update: it is shown in Settings and the footer, and it
 * also names the offline cache in sw.js, so installed copies pick up the new files. */
(function (G) {
  'use strict';
  G.GQ_VERSION = '1.7.0';
  G.GQ_RELEASED = '2026-09-27';
  G.GQ_CHANGES = [
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
