import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceNarration } from './voiceNarrationEngine';

test('VoiceNarrationEngine: cleans text from markdown and scientific symbols for speech', () => {
  const rawText = 'Gunakan *kacamata* dan ukur ΣF = m·a dengan a = 9.81 m/s² pada suhu 25°C!';
  const cleaned = voiceNarration.cleanTextForSpeech(rawText);

  assert.ok(!cleaned.includes('*'), 'Markdown asterisks should be stripped');
  assert.ok(cleaned.includes('sigma'), 'Greek sigma symbol should be phonetic');
  assert.ok(cleaned.includes('meter per detik kuadrat'), 'Units should be spelled out phonetically');
  assert.ok(cleaned.includes('derajat Celsius'), 'Degrees Celsius should be spelled out');
});

test('VoiceNarrationEngine: gracefully handles node environment where window.speechSynthesis is absent', () => {
  assert.equal(voiceNarration.isSupported(), false);
  assert.equal(voiceNarration.isSpeaking(), false);

  // Calling speak or stop should not throw
  let errorCaught = false;
  voiceNarration.speak('Halo praktikan', {
    onError: () => {
      errorCaught = true;
    },
  });
  assert.equal(errorCaught, true);

  voiceNarration.stop();
  assert.equal(voiceNarration.isSpeaking(), false);
});
