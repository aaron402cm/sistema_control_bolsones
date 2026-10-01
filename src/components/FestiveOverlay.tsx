import React, { useEffect, useRef } from 'react';
import { ThemeConfig } from '../types';

interface FestiveOverlayProps {
  themeConfig: ThemeConfig;
}

export const FestiveOverlay: React.FC<FestiveOverlayProps> = ({ themeConfig }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !themeConfig.particleType) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const type = themeConfig.particleType;
    const particleCount = type === 'snow' ? 45 : type === 'petals' ? 25 : type === 'hearts' ? 20 : 30;

    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      opacity: number;
      rotation?: number;
      rotSpeed?: number;
      color?: string;
    }> = [];

    const colorsSnow = ['#ffffff', '#e0f2fe', '#bae6fd'];
    const colorsPetals = ['#f472b6', '#fb7185', '#fda4af', '#fecdd3'];
    const colorsHearts = ['#f43f5e', '#e11d48', '#be123c', '#fda4af'];
    const colorsConfetti = ['#ef4444', '#ffffff', '#dc2626'];
    const colorsSparkles = ['#f59e0b', '#fbbf24', '#fef08a', '#ffffff'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 4 + 2,
        speedY: Math.random() * 1.2 + 0.6,
        speedX: Math.random() * 0.8 - 0.4,
        opacity: Math.random() * 0.6 + 0.2,
        rotation: Math.random() * 360,
        rotSpeed: Math.random() * 2 - 1,
        color:
          type === 'snow'
            ? colorsSnow[Math.floor(Math.random() * colorsSnow.length)]
            : type === 'petals'
            ? colorsPetals[Math.floor(Math.random() * colorsPetals.length)]
            : type === 'hearts'
            ? colorsHearts[Math.floor(Math.random() * colorsHearts.length)]
            : type === 'confetti'
            ? colorsConfetti[Math.floor(Math.random() * colorsConfetti.length)]
            : colorsSparkles[Math.floor(Math.random() * colorsSparkles.length)],
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        if (p.rotation !== undefined && p.rotSpeed !== undefined) {
          p.rotation += p.rotSpeed;
        }

        if (p.y > height + 10) {
          p.y = -10;
          p.x = Math.random() * width;
        }
        if (p.x > width + 10) p.x = -10;
        if (p.x < -10) p.x = width + 10;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = p.opacity;

        if (type === 'snow') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color || '#fff';
          ctx.fill();
        } else if (type === 'hearts') {
          ctx.fillStyle = p.color || '#f43f5e';
          const s = p.size * 1.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-s, -s, -s * 1.5, s / 3, 0, s * 1.5);
          ctx.bezierCurveTo(s * 1.5, s / 3, s, -s, 0, 0);
          ctx.fill();
        } else if (type === 'petals') {
          ctx.rotate(((p.rotation || 0) * Math.PI) / 180);
          ctx.fillStyle = p.color || '#f472b6';
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 2, p.size, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (type === 'confetti') {
          ctx.rotate(((p.rotation || 0) * Math.PI) / 180);
          ctx.fillStyle = p.color || '#ef4444';
          ctx.fillRect(-p.size, -p.size * 2, p.size * 2, p.size * 4);
        } else {
          // sparkles
          ctx.fillStyle = p.color || '#fbbf24';
          const r = p.size * 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [themeConfig]);

  if (!themeConfig.particleType) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
      style={{ opacity: 0.85 }}
    />
  );
};
