const { randomUUID } = require('node:crypto');
const { MODES } = require('./timer');

function createSessionRecord(mode, completedAt, durationMs) {
  if (!MODES.includes(mode)) throw new RangeError(`Unknown session mode: ${mode}`);
  if (!(completedAt instanceof Date) || !Number.isFinite(completedAt.getTime())) {
    throw new TypeError('Session completion time must be a valid Date');
  }
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0 || durationMs % 60_000 !== 0) {
    throw new RangeError('Completed session duration must be a positive whole number of minutes');
  }
  return {
    id: randomUUID(),
    mode,
    completedAt: completedAt.toISOString(),
    durationMinutes: durationMs / 60_000,
  };
}

function sanitizeSessionHistory(input) {
  if (!Array.isArray(input)) throw new TypeError('Session history must be an array');
  return input.map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)
      || typeof record.id !== 'string' || !record.id
      || !MODES.includes(record.mode)
      || !Number.isSafeInteger(record.durationMinutes) || record.durationMinutes < 1 || record.durationMinutes > 120
      || typeof record.completedAt !== 'string') {
      throw new TypeError(`Session history record ${index} is invalid`);
    }
    const completedAt = new Date(record.completedAt);
    if (!Number.isFinite(completedAt.getTime()) || completedAt.toISOString() !== record.completedAt) {
      throw new TypeError(`Session history record ${index} has an invalid completion time`);
    }
    return {
      id: record.id,
      mode: record.mode,
      completedAt: record.completedAt,
      durationMinutes: record.durationMinutes,
    };
  }).sort((left, right) => right.completedAt.localeCompare(left.completedAt));
}

module.exports = { createSessionRecord, sanitizeSessionHistory };
