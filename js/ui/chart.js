export function enhanceBatteryMiniChart(measurements, settings, usages = []) {
  const currentChart = document.querySelector(".mini-chart");
  if (!currentChart) return;

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const minDate = new Date(now.getTime() - 28 * dayMs);
  const allPoints = [...measurements]
    .filter(m => typeof m.levelPercent === "number")
    .map(m => ({ ...m, dateObject: new Date(m.measuredAt ?? `${m.date}T00:00`) }))
    .filter(m => m.dateObject <= now)
    .sort((a, b) => a.dateObject - b.dateObject);

  for(let i=1;i<allPoints.length;i++) {
    const start=allPoints[i-1].dateObject.getTime(),end=allPoints[i].dateObject.getTime();
    allPoints[i].excludeFromPrevious=Boolean(allPoints[i].excludeFromPrevious||usages.some(u=>{const t=new Date(u.usedAt).getTime();return t>start&&t<=end;}));
  }
  if (allPoints.length < 2) {
    currentChart.outerHTML = `<p class="helper-text">Mini graphique disponible après au moins 2 mesures.</p>`;
    return;
  }

  const firstVisibleIndex = allPoints.findIndex(m => m.dateObject >= minDate);
  let points = [];

  if (firstVisibleIndex === -1) {
    const previous = allPoints.at(-2);
    const next = allPoints.at(-1);
    points = [
      createInterpolatedPoint(previous, next, minDate, "window-start"),
      createInterpolatedPoint(previous, next, now, "window-end", next.excludeFromPrevious)
    ];
  } else {
    points = allPoints.slice(firstVisibleIndex);
    if (firstVisibleIndex > 0) {
      const previous = allPoints[firstVisibleIndex - 1];
      const next = allPoints[firstVisibleIndex];
      points = [createInterpolatedPoint(previous, next, minDate, "window-start"), ...points];
    }
  }

  if (points.length < 2) {
    currentChart.outerHTML = `<p class="helper-text">Mini graphique disponible après au moins 2 mesures.</p>`;
    return;
  }

  const width = 420;
  const height = 190;
  const labelW = 42;
  const bottomH = 32;
  const padding = 12;
  const chartX = labelW;
  const chartY = padding;
  const chartW = width - labelW - padding;
  const chartH = height - bottomH - padding * 2;
  const alertThreshold = Number(settings.alertThresholdPercent ?? 30);
  const criticalThreshold = Number(settings.criticalThresholdPercent ?? 15);
  const yFor = level => chartY + ((100 - level) / 100) * chartH;
  const xFor = date => chartX + ((date - minDate) / (28 * dayMs)) * chartW;
  const colorForLevel = level => {
    if (level <= criticalThreshold) return "var(--danger)";
    if (level < alertThreshold) return "var(--warning)";
    return "var(--success)";
  };
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];
    const x1 = xFor(previous.dateObject);
    const x2 = xFor(current.dateObject);
    const y1 = yFor(previous.levelPercent);
    const y2 = yFor(current.levelPercent);
    if (current.excludeFromPrevious) {
      segments.push(`<line class="mini-chart-segment" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--muted)" stroke-width="3" stroke-dasharray="7 6" opacity="0.75"/>`);
      continue;
    }
    for (const part of splitSegmentByThresholds(previous.levelPercent, current.levelPercent, [alertThreshold, criticalThreshold])) {
      const partX1 = x1 + (x2 - x1) * part.startRatio;
      const partX2 = x1 + (x2 - x1) * part.endRatio;
      const midLevel = (part.startLevel + part.endLevel) / 2;
      segments.push(`<line class="mini-chart-segment" x1="${partX1.toFixed(1)}" y1="${yFor(part.startLevel).toFixed(1)}" x2="${partX2.toFixed(1)}" y2="${yFor(part.endLevel).toFixed(1)}" stroke="${colorForLevel(midLevel)}" stroke-width="3"/>`);
    }
  }

  currentChart.outerHTML = `
    <svg class="mini-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Évolution du niveau de batterie sur 28 jours">
      ${[100, 75, 50, 25, 0].map(level => `<text class="mini-chart-label" x="0" y="${(yFor(level) + 5).toFixed(1)}">${level} %</text><line class="mini-chart-grid" x1="${chartX}" y1="${yFor(level).toFixed(1)}" x2="${width - padding}" y2="${yFor(level).toFixed(1)}"${[25, 75].includes(level) ? ` stroke-dasharray="5 5" opacity="0.65"` : ""}/>`).join("")}
      <line class="mini-chart-threshold" x1="${chartX}" y1="${yFor(alertThreshold).toFixed(1)}" x2="${width - padding}" y2="${yFor(alertThreshold).toFixed(1)}" stroke="var(--warning)" stroke-dasharray="7 6" opacity="0.9"/>
      <line class="mini-chart-threshold" x1="${chartX}" y1="${yFor(criticalThreshold).toFixed(1)}" x2="${width - padding}" y2="${yFor(criticalThreshold).toFixed(1)}" stroke="var(--danger)" stroke-dasharray="7 6" opacity="0.9"/>
      ${[28, 21, 14, 7].map(days => {
        const x = xFor(new Date(now.getTime() - days * dayMs));
        return `<line class="mini-chart-grid" x1="${x.toFixed(1)}" y1="${chartY}" x2="${x.toFixed(1)}" y2="${(chartY + chartH).toFixed(1)}"/><text class="mini-chart-label" x="${x.toFixed(1)}" y="${height - 8}" text-anchor="middle">J-${days}</text>`;
      }).join("")}
      ${segments.join("")}
    </svg>
  `;
}

function createInterpolatedPoint(previous, next, dateObject, id, excludeFromPrevious = false) {
  const ratio = (dateObject - previous.dateObject) / Math.max(1, next.dateObject - previous.dateObject);
  const levelPercent = previous.levelPercent + (next.levelPercent - previous.levelPercent) * ratio;
  return { ...next, id, dateObject, levelPercent: Math.max(0, Math.min(100, levelPercent)), isWindowAnchor: true, excludeFromPrevious };
}

function splitSegmentByThresholds(startLevel, endLevel, thresholds) {
  if (startLevel === endLevel) return [{ startRatio: 0, endRatio: 1, startLevel, endLevel }];
  const ratios = [0, 1];
  for (const threshold of thresholds) {
    const crosses = (startLevel - threshold) * (endLevel - threshold) < 0;
    if (crosses) ratios.push((threshold - startLevel) / (endLevel - startLevel));
  }
  ratios.sort((a, b) => a - b);
  return ratios.slice(0, -1).map((startRatio, index) => {
    const endRatio = ratios[index + 1];
    return { startRatio, endRatio, startLevel: startLevel + (endLevel - startLevel) * startRatio, endLevel: startLevel + (endLevel - startLevel) * endRatio };
  }).filter(part => part.endRatio > part.startRatio);
}

