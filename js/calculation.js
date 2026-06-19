import { MEASUREMENT_TYPES, STATUS } from "./constants.js";

export function calculateBatteryStatus(battery, measurements, settings) {
  const sortedMeasurements = [...measurements].sort((a, b) => a.date.localeCompare(b.date));

  if (sortedMeasurements.length === 0) {
    return createUninitializedStatus(battery.id);
  }

  const cycles = buildCycles(sortedMeasurements);
  const points = normalizeMeasurementsByCycle(cycles);
  const regression = calculateLinearRegression(points);
  const lastMeasurement = sortedMeasurements[sortedMeasurements.length - 1];

  const dischargePerDay = regression.slope < 0 ? Math.abs(regression.slope) : 0;
  const estimatedThresholdDate = calculateEstimatedThresholdDate(
    lastMeasurement.date,
    lastMeasurement.levelPercent,
    dischargePerDay,
    settings.criticalThresholdPercent
  );

  const status = calculateStatus({
    lastLevelPercent: lastMeasurement.levelPercent,
    estimatedThresholdDate,
    settings
  });

  return {
    batteryId: battery.id,
    lastLevelPercent: lastMeasurement.levelPercent,
    lastMeasurementDate: lastMeasurement.date,
    lastChargeDate: getLastChargeDate(sortedMeasurements),
    measurementCount: sortedMeasurements.length,
    cycleCount: cycles.length,
    averageDischargePerDay: dischargePerDay,
    estimatedThresholdDate,
    status,
    confidence: calculateConfidence(points, regression.rmse)
  };
}

export function buildCycles(measurements) {
  const cycles = [];
  let currentCycle = [];

  for (const measurement of measurements) {
    if (measurement.type === MEASUREMENT_TYPES.CHARGE || currentCycle.length === 0) {
      if (currentCycle.length > 0) cycles.push(currentCycle);
      currentCycle = [measurement];
    } else {
      currentCycle.push(measurement);
    }
  }

  if (currentCycle.length > 0) cycles.push(currentCycle);
  return cycles;
}

export function normalizeMeasurementsByCycle(cycles) {
  const points = [];

  for (const cycle of cycles) {
    const cycleStart = cycle[0];

    for (const measurement of cycle) {
      points.push({
        x: daysBetween(cycleStart.date, measurement.date),
        y: measurement.levelPercent,
        measurementId: measurement.id
      });
    }
  }

  return points;
}

export function calculateLinearRegression(points) {
  if (points.length < 2) {
    return { slope: 0, intercept: points[0]?.y ?? 0, rmse: null };
  }

  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);
  const denominator = n * sumXX - sumX * sumX;

  if (denominator === 0) {
    return { slope: 0, intercept: sumY / n, rmse: null };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const squaredErrors = points.map((point) => {
    const predicted = slope * point.x + intercept;
    return Math.pow(point.y - predicted, 2);
  });

  const rmse = Math.sqrt(squaredErrors.reduce((sum, value) => sum + value, 0) / n);

  return { slope, intercept, rmse };
}

export function calculateEstimatedThresholdDate(referenceDate, lastLevelPercent, dischargePerDay, thresholdPercent) {
  if (!dischargePerDay || dischargePerDay <= 0 || lastLevelPercent <= thresholdPercent) {
    return referenceDate;
  }

  const daysUntilThreshold = Math.ceil((lastLevelPercent - thresholdPercent) / dischargePerDay);
  const date = new Date(`${referenceDate}T00:00:00`);
  date.setDate(date.getDate() + daysUntilThreshold);

  return date.toISOString().slice(0, 10);
}

export function calculateStatus({ lastLevelPercent, estimatedThresholdDate, settings }) {
  if (lastLevelPercent <= settings.criticalThresholdPercent) return STATUS.RED;

  const days = daysBetween(new Date().toISOString().slice(0, 10), estimatedThresholdDate);
  const percentBeforeCritical = lastLevelPercent - settings.criticalThresholdPercent;

  if (days <= 0) return STATUS.RED;
  if (days <= settings.orangeAlertDays || percentBeforeCritical <= settings.orangeAlertPercent) return STATUS.ORANGE;

  return STATUS.GREEN;
}

export function calculateConfidence(points, rmse) {
  if (points.length < 2) return "inconnue";
  if (points.length < 4) return "faible";
  if (rmse !== null && rmse > 12) return "moyenne";
  if (points.length < 8) return "moyenne";
  return "bonne";
}

function createUninitializedStatus(batteryId) {
  return {
    batteryId,
    lastLevelPercent: null,
    lastMeasurementDate: null,
    lastChargeDate: null,
    measurementCount: 0,
    cycleCount: 0,
    averageDischargePerDay: 0,
    estimatedThresholdDate: null,
    status: STATUS.UNINITIALIZED,
    confidence: "inconnue"
  };
}

function getLastChargeDate(measurements) {
  const charges = measurements.filter((measurement) => measurement.type === MEASUREMENT_TYPES.CHARGE);
  return charges.at(-1)?.date ?? null;
}

export function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.round((end - start) / 86400000);
}
