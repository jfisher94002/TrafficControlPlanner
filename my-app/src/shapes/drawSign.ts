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
  const label = signData.label.length > 12 ? signData.label.slice(0, 11) + "…" : signData.label;
  const baseFontSize = label.length <= 4 ? 8 : label.length <= 8 ? 6.5 : 5;
  ctx.font = `bold ${Math.max(4, baseFontSize * scale)}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, shape === "triangle" ? s * 0.3 : 0);
  ctx.restore();
}
