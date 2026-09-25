# GuitarQuest Phase 0: input test

This is the page from build-order step "Phase 0" in the requirements. It tells you whether the guitar input is good enough to build the app on.

## Run it

- **Mac, Chrome or Edge:** open `index.html` straight from the folder, or serve the folder and open `http://localhost:8000/phase0/`:
  `cd GuitarQuest && python3 -m http.server 8000`
- **Safari or iPad:** microphone access needs a secure page (https, or localhost on the same machine). To test on the iPad, host the folder on any https static host, or use a tunnel to the Mac.

## What to check

1. **Input device:** click *Allow audio input*. The Enya Inspire should show up in the list with a green badge. If it doesn't, the USB-C port isn't acting as an audio input (risk 8.1). Then use the instrument or headphone out into an interface. The capture settings list should show echo cancellation, noise suppression and auto gain all **off**, at 44.1 or 48 kHz.
2. **Level:** pick hard and watch for **CLIP**. Keep your hands still, then press *Measure noise floor* to set the gate.
3. **Live pitch:** play each open string. You should see E2 A2 D3 G3 B3 E4 within a few cents of 0. Try the 24th fret on the high e (E6), then switch to the Crunch preset and check again.
4. **Latency:** pick about 20 single notes, one at a time. The total estimate should come in under 60 ms. Then run the play-along calibration a couple of times. The spread should stay under about ±15 ms.

Note down the numbers for Mac and for iPad: they decide Phase 1.

## Files

- `pitch-worklet.js`: AudioWorklet with a 55 Hz high-pass filter, decimation to about 24 kHz, YIN pitch detection every ~5 ms, onset detection, a note tracker, level metering and noise-floor measurement.
- `app.js`: device picker, monitoring, meters, pitch display, latency breakdown and calibration.
- `index.html`, `style.css`: the page itself. No build step and no dependencies.
