const lamejs = require('./node_modules/lamejs');

// Apply the same polyfill
global.window = global;
window.MPEGMode = lamejs.MPEGMode || function (ordinal) {
  return { ordinal: () => ordinal };
};
window.Lame = lamejs.Lame || {
  V9: 410, V8: 420, V7: 430, V6: 440, V5: 450, V4: 460, V3: 470, V2: 480, V1: 490, V0: 500,
  R3MIX: 1000, STANDARD: 1001, EXTREME: 1002, INSANE: 1003, STANDARD_FAST: 1004, EXTREME_FAST: 1005, MEDIUM: 1006, MEDIUM_FAST: 1007,
  LAME_MAXMP3BUFFER: 16384 + 128 * 1024,
  LAME_ID: 0xFFF88E3B
};

try {
  const encoder = new lamejs.Mp3Encoder(1, 44100, 128);
  const left = new Int16Array(1152);
  const mp3buf = encoder.encodeBuffer(left);
  console.log("Success! Buf len:", mp3buf.length);
} catch (err) {
  console.error("Error occurred:");
  console.error(err);
}
