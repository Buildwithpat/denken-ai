'use client';

import { useEffect, useRef, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { ISourceOptions } from '@tsparticles/engine';

const OPTIONS: ISourceOptions = {
  background: { color: { value: 'transparent' } },
  fpsLimit: 60,
  interactivity: {
    detectsOn: 'window',
    events: {
      onHover: { enable: true, mode: ['repulse', 'bubble'] },
      onClick: { enable: true, mode: 'push' },
      resize: { enable: true },
    },
    modes: {
      repulse: { distance: 130, duration: 0.4, speed: 0.8 },
      bubble:  { distance: 160, size: 7,   duration: 0.3, opacity: 0.6 },
      push:    { quantity: 3 },
    },
  },
  particles: {
    color: { value: ['#ffffff', '#8762F7', '#a78bfa'] },
    links: {
      color: '#8762F7',
      distance: 140,
      enable: true,
      opacity: 0.12,
      width: 1,
    },
    move: {
      enable: true,
      speed: 0.5,
      direction: 'none',
      random: true,
      straight: false,
      outModes: { default: 'out' },
    },
    number: {
      density: { enable: true },
      value: 70,
    },
    opacity: {
      value: { min: 0.15, max: 0.5 },
      animation: { enable: true, speed: 0.6, sync: false },
    },
    size: {
      value: { min: 1, max: 3 },
    },
    shape: { type: 'circle' },
  },
  detectRetina: true,
};

export default function ParticlesBackground() {
  const [ready, setReady] = useState(false);
  const instanceId = useRef(`particles-${Date.now()}`);

  useEffect(() => {
    let active = true;
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
      setReady(false);
    };
  }, []);

  if (!ready) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <Particles id={instanceId.current} options={OPTIONS} className="h-full w-full" />
    </div>
  );
}
