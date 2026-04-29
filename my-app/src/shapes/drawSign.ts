import type { SignData } from '../types';
import { COLORS } from '../features/tcp/constants';

export function drawSign(
  ctx: CanvasRenderingContext2D,
  sign: { x: number; y: number; signData: SignData; rotation?: number; scale?: number },
  isSelected: boolean,
): void {
  const { x, y, signData, rotation = 0, scale = 1 } = sign;
  const s = 12 * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);

  if (isSelected) { ctx.shadowColor = COLORS.selected; ctx.shadowBlur = 12; }

  const shape = signData.shape;
  if (shape === "octagon") {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    }
    ctx.closePath();
    ctx.fillStyle = signData.color; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  } else if (shape === "diamond") {
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0);
    ctx.closePath();
    ctx.fillStyle = signData.color; ctx.fill();
    ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.stroke();
  } else if (shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s, s * 0.7); ctx.lineTo(-s, s * 0.7);
    ctx.closePath();
    ctx.fillStyle = signData.color; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  } else if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fillStyle = signData.color; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  } else if (shape === "shield") {
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, -s); ctx.lineTo(s * 0.7, -s);
    ctx.lineTo(s * 0.8, -s * 0.3); ctx.lineTo(0, s); ctx.lineTo(-s * 0.8, -s * 0.3);
    ctx.closePath();
    ctx.fillStyle = signData.color; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  } else {
    ctx.fillStyle = signData.color || "#fff";
    ctx.strokeStyle = signData.border || "#333";
    ctx.lineWidth = 2;
    ctx.fillRect(-s, -s * 0.65, s * 2, s * 1.3);
    ctx.strokeRect(-s, -s * 0.65, s * 2, s * 1.3);
  }

  ctx.fillStyle = signData.textColor || "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Allow text to span the full sign face (diamond tip-to-tip = 2s).
  // Using 3× gives a bit of overflow tolerance so multi-word phrases
  // like "ROAD WORK" land on one line rather than splitting every word.
  const maxTextWidth = s * 3;

  // Minimum 11px so text is readable at typical canvas zoom; scales up with sign.
  const baseFontSize = Math.max(11, 3.5 * scale);
  ctx.font = `bold ${baseFontSize}px 'JetBrains Mono', monospace`;

  // Word-wrap: greedily fill lines up to maxTextWidth
  const words = signData.label.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxTextWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  const lineHeight = baseFontSize * 1.25;
  const totalHeight = lines.length * lineHeight;
  const yBase = (shape === "triangle" ? s * 0.3 : 0) - totalHeight / 2 + lineHeight / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, yBase + i * lineHeight);
  }
  ctx.restore();
}
