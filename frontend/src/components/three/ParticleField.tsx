"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ─── Floating particles with subtle size oscillation ─── */
function FloatingParticles({ count = 1200 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null!);
  const timeRef = useRef(0);

  const { positions, velocities, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 25;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 25;
      vel[i * 3] = (Math.random() - 0.5) * 0.005;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.005;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.005;
      sz[i] = 0.02 + Math.random() * 0.04;
    }
    return { positions: pos, velocities: vel, sizes: sz };
  }, [count]);

  useFrame((_, d) => {
    if (!ref.current) return;
    timeRef.current += d;
    const geo = ref.current.geometry;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      arr[i * 3] += velocities[i * 3];
      arr[i * 3 + 1] += velocities[i * 3 + 1];
      arr[i * 3 + 2] += velocities[i * 3 + 2];

      // Wrap around
      for (let j = 0; j < 3; j++) {
        if (arr[i * 3 + j] > 12.5) arr[i * 3 + j] = -12.5;
        if (arr[i * 3 + j] < -12.5) arr[i * 3 + j] = 12.5;
      }
    }
    posAttr.needsUpdate = true;
    ref.current.rotation.y += d * 0.01;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#9fef00" transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

/* ─── Connecting lines that pulse ─── */
function PulseConnections() {
  const ref = useRef<THREE.LineSegments>(null!);
  const timeRef = useRef(0);

  const positions = useMemo(() => {
    const nodes: THREE.Vector3[] = [];
    for (let i = 0; i < 30; i++) {
      nodes.push(new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
      ));
    }
    const pos: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[i].distanceTo(nodes[j]) < 4) {
          pos.push(nodes[i].x, nodes[i].y, nodes[i].z);
          pos.push(nodes[j].x, nodes[j].y, nodes[j].z);
        }
      }
    }
    return new Float32Array(pos);
  }, []);

  useFrame((_, d) => {
    timeRef.current += d;
    if (ref.current) {
      ref.current.rotation.y += d * 0.015;
      const mat = ref.current.material as THREE.LineBasicMaterial;
      mat.opacity = 0.08 + Math.sin(timeRef.current) * 0.04;
    }
  });

  return (
    <lineSegments ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#00d4ff" transparent opacity={0.1} />
    </lineSegments>
  );
}

/* ─── Main Export ─── */
export default function ParticleField() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <Canvas camera={{ position: [0, 0, 8], fov: 60 }} gl={{ antialias: true, alpha: true }} style={{ background: "transparent", pointerEvents: "none" }}>
        <FloatingParticles count={1000} />
        <PulseConnections />
      </Canvas>
    </div>
  );
}
