import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import * as THREE from "three";

function CapitalCore({ reducedMotion }) {
  const group = useRef();
  const ring = useRef();

  useFrame((state, delta) => {
    if (reducedMotion) return;
    group.current.rotation.y += delta * 0.16;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.35) * 0.08;
    ring.current.rotation.z -= delta * 0.22;
  });

  const nodes = useMemo(() => Array.from({ length: 10 }, (_, index) => {
    const angle = (index / 10) * Math.PI * 2;
    const radius = index % 2 ? 2.25 : 1.86;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.68, (index % 3 - 1) * 0.28];
  }), []);

  return <group ref={group} rotation={[0.18, -0.28, 0.08]}>
    <Float speed={reducedMotion ? 0 : 1.25} rotationIntensity={0.16} floatIntensity={0.3}>
      <mesh castShadow>
        <icosahedronGeometry args={[1.08, 5]}/>
        <meshPhysicalMaterial color="#101b26" metalness={0.92} roughness={0.18} clearcoat={1} clearcoatRoughness={0.1}/>
      </mesh>
      <mesh scale={1.025}>
        <icosahedronGeometry args={[1.08, 2]}/>
        <meshBasicMaterial color="#e8bd62" wireframe transparent opacity={0.32}/>
      </mesh>
      <mesh position={[0, 0, 1.08]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.52, 0.64, 0.08]}/>
        <meshPhysicalMaterial color="#f2ca70" metalness={0.8} roughness={0.18} clearcoat={1}/>
      </mesh>
    </Float>

    <group ref={ring}>
      <mesh rotation={[1.19, 0.15, 0.18]}>
        <torusGeometry args={[1.62, 0.025, 12, 160]}/>
        <meshStandardMaterial color="#e8bd62" emissive="#9d6718" emissiveIntensity={0.5} metalness={1} roughness={0.2}/>
      </mesh>
      <mesh rotation={[0.42, 1.12, -0.22]}>
        <torusGeometry args={[2.06, 0.014, 10, 160]}/>
        <meshBasicMaterial color="#668ea6" transparent opacity={0.42}/>
      </mesh>
    </group>

    {nodes.map((position, index) => <group key={index} position={position}>
      <mesh>
        <sphereGeometry args={[index % 3 === 0 ? 0.085 : 0.05, 18, 18]}/>
        <meshStandardMaterial color={index % 3 === 0 ? "#f0c76e" : "#78a9bf"} emissive={index % 3 === 0 ? "#9d6718" : "#315a70"} emissiveIntensity={0.8}/>
      </mesh>
      <pointLight color={index % 3 === 0 ? "#e8bd62" : "#5f9fbc"} intensity={0.13} distance={0.7}/>
    </group>)}
  </group>;
}

export default function HeroScene({ reducedMotion = false }) {
  return <div className="hero-canvas" aria-hidden="true">
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 6.6], fov: 42 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
      frameloop={reducedMotion ? "demand" : "always"}
    >
      <ambientLight intensity={0.6}/>
      <directionalLight position={[4, 5, 6]} intensity={3.4} color="#fff1c1"/>
      <pointLight position={[-4, -1, 3]} intensity={2.2} color="#3a88ad"/>
      <pointLight position={[2, -3, 2]} intensity={1.8} color="#d49b35"/>
      <CapitalCore reducedMotion={reducedMotion}/>
      <Sparkles count={reducedMotion ? 18 : 46} scale={[7.5, 5.2, 3]} size={1.5} speed={reducedMotion ? 0 : 0.18} opacity={0.32} color="#f2d286"/>
    </Canvas>
  </div>;
}
