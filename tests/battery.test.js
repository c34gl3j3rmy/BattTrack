import test from 'node:test';
import assert from 'node:assert/strict';
import { Battery, updateBattery, archiveBattery, restoreBattery } from '../js/battery.js';

test('Partial control changes never reset LED configuration', () => {
  const battery = new Battery({
    id: 'drone', name: 'Drone', inputType: 'led_advanced', preferredInputMode: 'led',
    ledConfig: { ledCount: 6, behavior: 'advanced' },
    controlIntervalDays: 30
  });
  for (const modified of [updateBattery(battery, {controlIntervalDays: 15}), archiveBattery(battery), restoreBattery(battery)]) {
    assert.equal(modified.inputType, 'led_advanced');
    assert.deepEqual(modified.ledConfig, { ledCount: 6, behavior: 'advanced' });
    assert.equal(modified.preferredInputMode, 'led');
  }
});

test('Explicitly editing input mode changes LEDs', () => {
  const battery = new Battery({id: 'one', name: 'Old', inputType: 'led_simple', ledConfig: {ledCount: 5, behavior: 'simple'}});
  const edited = updateBattery(battery, {name: 'New', inputType: 'percentage', ledConfig: null});
  assert.equal(edited.inputType, 'percentage');
  assert.equal(edited.ledConfig, null);
  assert.equal(edited.name, 'New');
});
