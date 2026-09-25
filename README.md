# GuitarQuest

A practice app for electric guitar, built for the Enya Inspire and its direct USB-C audio input. It follows `GuitarQuest-requirements.md` (version 0.1) through Phases 0 to 3 of the build order.

It is plain HTML, CSS and JavaScript: no build step, no framework and no dependencies (REQ-NF-5). Audio is analysed on the device and never uploaded (REQ-NF-4).

## Running it

- **Mac, Chrome or Edge:** open `index.html` straight from the folder. It works from `file://`, but offline install needs a server.
- **Local server (all browsers, offline install):** `python3 -m http.server 8000` in this folder, then open `http://localhost:8000/`.
- **iPad:** Safari only allows audio input on an https page. The simplest way is GitHub Pages: in the repository, go to *Settings > Pages*, choose *Deploy from a branch*, `main`, `/ (root)`. The app is then at `https://<you>.github.io/GuitarQuest/`, and *Share > Add to Home Screen* installs it.

## First run

1. **Connect:** plug in the guitar, click *Allow audio input*, and pick the Enya in the list. If the badge doesn't say "Guitar", go to *Settings > Guitar input* and press **This is my guitar (direct input)**. Scored lessons only run on a confirmed direct input (REQ-HW-2).
2. **Noise floor:** measured automatically in the first 2 seconds. Keep the strings quiet.
3. **Tune:** level 1.1, or the *Tuner* tab. All six strings must hold within ±5 cents. Without this, runs are practice only.
4. **Calibrate:** *Settings > Latency calibration*. Pick a note on each click. Redo it when you change input or headphones.

## What is in it

| Area | Where | Requirements |
| --- | --- | --- |
| Direct input, device picker, microphone refusal, device-loss pause, capture settings check | `js/audio.js`, Settings | REQ-HW-1..5 |
| Monitoring with clean / warm / crunch tone | `js/audio.js` | REQ-HW-7 |
| YIN pitch detection in an AudioWorklet, onsets, noise gate, level and clipping | `js/worklet.js` | REQ-DET-1, 2, 7 |
| Chord recognition: 12-bin chroma over the 150 ms after an onset, matched against harmonic chord templates, with a confidence value | `js/worklet.js`, `js/chords.js` | REQ-DET-5 |
| "I didn't hear that clearly" instead of a wrong mark, unclear notes not scored, more than 20% unclear reported as an input problem | `js/lesson.js`, `js/scoring.js` | REQ-DET-6, REQ-SC-2 |
| Tuner with reference tones and A4 setting, tuning check before scoring, drift warning mid-lesson | `js/tuner.js`, `js/lesson.js` | REQ-DET-9 |
| Latency calibration, offset subtracted before timing is scored | `js/audio.js` | REQ-DET-4 |
| Beginner (waits), Intermediate, Advanced; practice lock; loop with tempo ramp; metronome, count-in, backing tracks | `js/lesson.js`, `js/sound.js` | REQ-FN-2, 3, 5, 6 |
| 140 levels in 14 units, 16 songs (traditional, public domain or original, origin on every card) | `js/curriculum.js`, `js/songs.js` | REQ-FN-1, 4, REQ-NF-6 |
| Fretboard with finger colours, falling-note highway, tab with rhythm and technique marks, standard notation, chord boxes shown before the change, live feedback | `js/render.js`, `js/ui-lesson.js` | REQ-UI-1..6 |
| Left-handed mode, display size, alternative tunings and capo | Settings | REQ-UI-7, 8 |
| Scoring out of 100 per note, stars at 60 / 80 / 95, progress, weak spots, chord-change speed, streak, profiles, export and import | `js/scoring.js`, `js/store.js`, Progress | REQ-SC-1..4 |
| Footswitch keys (learnable), voice commands, auto-advance | `js/controls.js` | REQ-PF-3 |
| PWA: manifest, service worker, icons | `manifest.webmanifest`, `sw.js` | REQ-PF-1 |
| Phase 0 input test page | `phase0/` | Build order, Phase 0 |

## Lesson notation

Lessons are written in a terse text format (see the top of `js/notation.js`):

```
q 6:0 6:1 6:3 | e 5:0 5:2 h 5:3     durations q h w e s (dotted with "."), string:fret
[Am] d u d   [F#m@E]   [P6:5]       chords, strums, movable barre and power-chord shapes
3:5h7 3:7p5 3:5/7 3:7b2 2:5~ 6:0pm  hammer, pull, slide, bend, vibrato, palm mute
E4 F#3 Bb3                          pitches, placed on the neck in the level's position
```

## Tests

```
node tests/run.js                        # detector accuracy, chord matching, every level parses and fits its bars
node tests/make-wav.js /tmp/guitar.wav   # synthesized test recording
npm i --no-save playwright               # only needed for the browser test
python3 -m http.server 8777 & node tests/browser.test.js
```

The detector tests use synthesized plucked strings, clean and overdriven:

- all ten notes from E2 to E6 are identified
- first stable pitch comes 26 to 41 ms after the pick
- all 16 test chords are matched, with no false matches

REQ-NF-1 asks for accuracy measured on a recorded test set of the real guitar. That still needs recordings of the Inspire.

## Known limits

- **Techniques:** bends are measured against their target. Hammer-ons, pull-offs and slides are recognised as notes without a new pick attack. Vibrato is displayed but not scored. Palm muting gives a hint, not a penalty.
- **Position:** the app never penalises the position you play a note in. It only suggests a place when a wrong note is heard (REQ-POS-2/3). The open-string sustain analysis in REQ-POS-3 is not built yet.
- **Chords:** the app recognises "that was A minor". It cannot tell you that a single string is muted (risk 8.2).
- **Android:** USB audio input on Android tablets is untested.
