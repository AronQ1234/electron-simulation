//- Todo: add ghost -> mostly done
//-Todo: check function propability/transmitted/reflected -> make sure it is retutning what it needs to return <- mostly done
//- Todo: transmiton not passing through the barrier.
//- Todo: The electrons max and min y should be the same as the barier +  a bit. If it finds its ay obavoe the border/barier
//- Todo that tuches the barier z value it should be allowed to transmit through.
//- Todo: fix smoothness-> change position every 25 framse (don't use this/ use code below) mostly done
//- Todo: fix brounian motion boundries not working proparly, keep x the same, make changes to x and y only, keeping them in correct borders(-15/2, 15/2)(-20,rightZ) mostly done
//- Todo: adjust for paramerer and parameter value.
//- Todo: use frame does check of t for each, since we get both spin up and down save the non selected in cache, toggle one, one, both types of spin.
//- Todo: add voltage/temp effects on speed and scatter. -> maybe mostly done
//Todo: toggle betwin partical wand wave (put in side pannel).
//- ? Todo: width meight be mixed up with height. I think it is working but check again.
//-Todo: add reset button for parameters.-> almost done just styling left i think
//- Todo:delete ofscreen particles and ghosts, or respawn them on the left (for particles) to keep the flow going without slowdown from too many objects. -> mostly done
//- Todo: fix ranges of sliders based on graph 1 tab 2
//Todo: check voltage multiplier and formula
//- todo: remove temp option
//- Todo: only one option eaither up or down at a time
//- Todo: look at reflected on simpnel
//- Todo: transmision prob. 
// ElectronTunneling.jsx
import React, { useRef, useEffect, useState, useCallback,useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Center, Text3D, Sphere, Text, Billboard } from "@react-three/drei";
import Plot from "react-plotly.js";
import * as PH from "./physics";
import { MathUtils, BufferGeometry, Vector3 } from "three";



/** Main scene */
export default function ElectronTunneling({
  voltage = 5,
  parameter,
  V0_eV = 1.7,//height
  d_nm = 2.0,//width
  E_eV = 0.5,//energy
  J_ex = 0.08,//exchange
  M_FMI = 1.0,//magnetic moment
  particleCount = 20,
  spawnIntervalSeconds = 0.5,
  maxElectrons = particleCount,
  speed=2,
  spinUp, setSpinUp,
  effectiveElectronMassMultiplier=1.2,
  isFullScreen,                   
  enterFullscreen,
  exitFullscreen,
  setModelKey,
  modelKey
}) {
  
  const [counts, setCounts] = useState({ transmitted: 0, reflected: 0, total: particleCount });
  const [running, setRunning] = useState(true);
  const [showWave, setShowWave] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });

    return () => cancelAnimationFrame(id);
  }, [isFullScreen]);

  const temp = 500;
  const elapsedTimeRef = useRef(0);
  const leftz = -20;
  const rightz = -(d_nm / 4) / 2;
  const reflectedCount = useRef(0);
  const transmittedCount = useRef(0);

  const topy = V0_eV*1.5 /2
  const bottomy = -V0_eV*1.5/2;
  
  // Convert temperature from Celsius to Kelvin for physics calculations
  const T_kelvin = temp + 273.15;

  // Convert voltage from simulation units to eV for barrier calculation
  const V_ox_eV = parameter===true ? voltage * 0.1: 0 * 0.1; //? Scale factor: adjust as needed for your model

  // Convert barrier width from nm to meters for physics functions
  const d_m = d_nm * 1e-9;

  const E_eff = useMemo(() => {
    // Calculate temperature-dependent current contribution
    const I_0 = 1e-12; // Reference current (Amperes) - adjust as needed
    const E_a = V0_eV; // Activation energy (use barrier height as reference)
    const I_temp = PH.calculateTemperatureDependentCurrent ? PH.calculateTemperatureDependentCurrent(I_0, E_a, T_kelvin) : I_0;
    
    // Calculate effective barrier heights considering J_ex and M_FMI
    const { V_eff_up, V_eff_down } = PH.calculateEffectiveBarrierHeights ? 
      PH.calculateEffectiveBarrierHeights(V0_eV, J_ex, M_FMI) : 
      { V_eff_up: V0_eV, V_eff_down: V0_eV };
    
    // Average effective barrier (for display purposes)
    const V_eff_avg = (V_eff_up + V_eff_down) / 2.0;
    
    return V_eff_avg;
  }, [V0_eV, J_ex, M_FMI, T_kelvin, voltage]);

  const Tvals = useMemo(() => {
    let tUp, tDown;

    try {
      if ((typeof PH.calculateVoltageDependentTunnelingBothSpins === "function")&& (parameter)) {
        const res = PH.calculateVoltageDependentTunnelingBothSpins(
          V0_eV,        // Base barrier height (eV)
          E_eV,         // Electron energy (eV)
          V_ox_eV,      // Applied voltage (eV)
          d_m,          // Barrier thickness (meters) 
          J_ex,         // Exchange coupling (eV)
          M_FMI,         // Magnetization factor (±1)
          effectiveElectronMassMultiplier
        );
        tUp = Number(res.T_up ?? 0);
        tDown = Number(res.T_down ?? 0);
        //console.log("Voltage-dependent tunneling probabilities:", res);
      } else if (typeof PH.calculateTunnelingProbabilitiesWKB === "function") {
        // Fallback to WKB if voltage function unavailable
        const res = PH.calculateTunnelingProbabilitiesWKB(V0_eV, E_eV, d_nm, J_ex, M_FMI, effectiveElectronMassMultiplier);
        //console.log("WKB Tunneling probabilities:", res);
        tUp = Number(res.T_up ?? 0);
        tDown = Number(res.T_down ?? 0);
      } else {
        const DeltaE = typeof PH.spinSplitting === "function" ? PH.spinSplitting(J_ex, M_FMI) : J_ex * M_FMI;
        const V_up = V0_eV - DeltaE / 2.0;
        const V_down = V0_eV + DeltaE / 2.0;
        tUp = PH.wkbTunneling ? PH.wkbTunneling(V_up, d_m, E_eV,effectiveElectronMassMultiplier) : 1e-12;
        tDown = PH.wkbTunneling ? PH.wkbTunneling(V_down, d_m, E_eV,effectiveElectronMassMultiplier) : 1e-12;
      }
    } catch (err) {
      console.warn("Tvals calc failed:", err);
    }
    return { T_up: tUp, T_down: tDown };
  }, [V0_eV, d_nm, E_eV, J_ex, M_FMI, V_ox_eV, d_m, parameter, effectiveElectronMassMultiplier]);

  const barrierRef = useRef();

  const particlesRef = useRef(
    new Array(particleCount).fill(0).map((_, i) => {
      const spin = spinUp ? "up" : "down";//Math.random() * (max - min) + min
      const z = (-(d_nm/4)/2) - (Math.random() *(-(d_nm/4) - (-15))); // random z within barrier depth
      const y = Math.random() * (topy - bottomy) + bottomy; // Math.random() * (max - min) + min
      const x = -7.5 + Math.random() * (7.5 -(-7.5)); //!
      return { id: i, x, y, z, spin, speed: speed};
    })
  );
  // Ghosts (shadows)
  const ghostsRef = useRef([]);
  //console.log("Particles", particlesRef)

  function resetSim() {
    particlesRef.current = new Array(particleCount).fill(0).map((_, i) => {
      const spin = spinUp ? "up" : "down";//Math.random() * (max - min) + min
      const z = (-(d_nm/4)/2) - (Math.random() *(-(d_nm/4) - (-20))); // random z within barrier depth
      const y = Math.random() * (topy - bottomy) + bottomy; 
      const x = -7.5 + Math.random() * (7.5 -(-7.5)); //!
      return { id: i, x, y, z, spin, speed: speed};
    });
    ghostsRef.current = [];
    setCounts({ transmitted: 0, reflected: 0, total: particleCount });
    transmittedCount.current=0;
    reflectedCount.current=0;
  }
  const plotData = [
    { x: ["Transmitted", "Reflected"], y: [counts.transmitted, counts.reflected], type: "bar", marker: { color: ["#4ea8ff", "#ff6b6b"] } },
  ];
  const plotLayout = { margin: { t: 10, l: 30, r: 10 }, height: 160, yaxis: { title: "count" } };
  

    //console.log("Refs for R and T", reflectedCount, transmittedCount)
    useEffect(() => {
      const interval = setInterval(() => {
        setCounts({ 
          transmitted: transmittedCount.current, 
          reflected: reflectedCount.current, 
          total: particlesRef.current.length 
        });
      }, 100); // Update 10x per second instead of 60x per frame
      
      return () => clearInterval(interval);
    }, []);
  function ParticlesSim({
    maxElectrons,
    speed, 
    spinUp 
  }) {
  

    useEffect(() => {
      for (let i = 0; i < particlesRef.current.length; i++) {
        particlesRef.current[i].spin = spinUp ? "up" : "down";
      }
    }, [spinUp]);
    
    useFrame((state, delta) => {
      if (!running) return;
      elapsedTimeRef.current += delta;
      //console.log(`Frame update: delta=${delta.toFixed(4)}s, elapsedTime=${elapsedTimeRef.current.toFixed(2)}s, SpanInterval=${spawnIntervalSeconds}s`);
      const arr = particlesRef.current;
      const ghosts = ghostsRef.current;
      // Voltage multiplier: higher voltage increases particle speed (simulates energy boost)
      const vMultiplier = 1 + 0.12 * Math.max(0, voltage - 1);
      // Temperature scatter: higher temp increases random scattering (Brownian motion)
      const tScatter = 1 + (Math.max(0, temp - 25) / 200);//! make based on energy insteed of temp

      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        //console.log("Particle id:" + p.id, p)
        // let decided = p.decided;

        const randomX = (Math.random() - 0.5) * tScatter * 0.5;
        const randomY = (Math.random() - 0.5) * tScatter * 0.5;
        const randomZ = (Math.random() - 0.5) * tScatter * 0.2;
        const forwardZ = p.speed * delta * vMultiplier / tScatter;
        let zTarget = p.z + forwardZ + randomZ;
        // Smooth random walk for x/y
        let xTarget = p.x + randomX;
        let yTarget = p.y + randomY;
        


        if (p.z< rightz && zTarget < rightz && zTarget > leftz) {
          let z = MathUtils.lerp(p.z, zTarget, 0.7);
          let x = MathUtils.lerp(p.x, xTarget, 0.25);
          let y = MathUtils.lerp(p.y, yTarget, 0.25);

          // Clamp to bounds
          x = Math.max(-7.5, Math.min(7.5, x));
          y = Math.max(bottomy, Math.min(topy, y));
          z = Math.max(-20, Math.min(20, z));

          arr[i] = {
            ...p,
            x: x,
            y: y,
            z: z
          };
        } 
        else if (p.z < rightz && zTarget >= rightz) {//-!condition not fully working
          const prob = p.spin === "up" ? Tvals.T_up : Tvals.T_down;
          //console.log(`Particle ${i} at barrier: spin=${p.spin}, prob=${prob}`);
          const roll = Math.random();
          // decided = true;
          if (roll < prob*10e15) {
            // transmitted = true;
            //particle passes through the barrier.
            transmittedCount.current += 1;
            arr[i] = {
              ...p,
              z: zTarget,
              x: p.x,
              y: p.y,
              spin: p.spin,
              speed: p.speed,
              id: p.id,
            };
            
           //console.log("ReflectedCountIncrement", transmittedCount.current)

          } else {
            // transmitted = false;
            // Reflect: bounce back and spawn a faint ghost on the right (low opacity)
            reflectedCount.current += 1;
            p.z -= 2;//!
            let z = -rightz +0.5;
            ghosts.push({
              id: `g-${Date.now()}-${i}`,
              x: p.x,
              z: -rightz + 0.5,
              y: p.y,
              life: 1.0,
              opacity: 0.4 + 0.2 * (1 - (roll - prob)),
              spin: p.spin,
              isGhost: true
            });
            // p.speed = -Math.abs(p.speed) * p.speed * delta * vMultiplier / tScatter;
            
            //console.log("ReflectedCountIncrement", reflectedCount.current)
          }
        }
        else if (p.z > rightz) {
          //move partical stright untill it goes out.
          let z = p.z + p.speed * delta * vMultiplier / tScatter;
          arr[i] = {
            ...p,
            z: z,
          }
          if (p.z > 21) {
            p.z += 0.02 * delta * 50;
            arr.splice(i, 1);
            continue;//!
          }
        }
        // Respawn if far right
        // else if (p.z > 21) {
        //   arr.splice(i, 1);
        //   // const spin = spinUp ? "up" : "down";
        //   // arr[i] = {
        //   //   ...p,
        //   //   x: left_nm + Math.random() * (Math.abs(left_nm) * 0.25),
        //   //   z: (Math.random() - 0.5) * 1.2,
        //   //   spin,
        //   //   decided: false,
        //   //   transmitted: false,
        //   //   speed: 0.4 + Math.random() * 0.8,
        //   // };
        //   continue;
        // }

        // Respawn if far left
        

        // Commit updates
        // arr[i].x = x;
        // arr[i].decided = decided;
        // arr[i].transmitted = transmitted;
      }

      if (counts.total < maxElectrons && elapsedTimeRef.current >= spawnIntervalSeconds){
        // const spin = Math.random() < 0.5 ? "up" : "down";
        //console.log("Spawning new particle. Current count:", arr.length);
        elapsedTimeRef.current = 0;
        const particle = {
          id: Date.now() + Math.random(),
          spin: spinUp ? "up" : "down",
          z: (-(d_nm/4)/2) - (Math.random() *(-(d_nm/4) - (-20))), // random z within barrier depth
          y: Math.random() * (topy - bottomy) + bottomy, //!
          x: -7.5 + Math.random() * (7.5 -(-7.5)), //!
          speed: arr[0]?.speed || (0.4 + Math.random() * 0.8),
        }
        arr.push(particle);
      }
      // Move in a straight line along the Z axis
      // We use 'delta' to ensure the speed is consistent regardless of frame rate
      // if (meshRef.current.position.z > -20 & meshRef.current.position.z < 20) { // Move until z = -10
      //   meshRef.current.position.z -= speed * delta * vMultiplier / tScatter;
      // }
      // else{
      //   // console.log("Resetting position to startX:", startX, "and initial Z:", position[2]);
      //   // meshRef.current.position.x += speed * delta;
      //   // meshRef.current.position.z += speed * delta;

      // }

      for (let g = ghosts.length - 1; g >= 0; g--) {
        ghosts[g].z += 0.02 * delta * 50;
        // if (ghosts[g].life <= 0) ghosts.splice(g, 1);
        if (ghosts[g].z > 22) ghosts.splice(g, 1);
      }
    });
     //console.log("particlesRef.current.spin:", particlesRef.current[0]);
    return (
      <>
          <group>
            {/* {particlesRef.current.map((p, i) => (
              <ParticleMesh key={p.id} position={[p.x, p.y, p.z]} spinUp={p.spin === "up"} />
            ))} */}
            {particlesRef.current.map((p) =>
  showWave ? (
    <WavePacket
      key={p.id}
      position={[p.x, p.y, p.z]}
      spin={p.spin}

      E_eV={E_eV}
      V0_eV={V0_eV}
      barrierWidth_nm={d_nm}

      J_ex={J_ex}
      M_FMI={M_FMI}
    />
  ) : (
    <ParticleMesh
      key={p.id}
      position={[p.x, p.y, p.z]}
      spinUp={p.spin === "up"}
    />
  )
)}
          </group>
          <group>
            {/* {ghostsRef.current.map((g) => (
              <ShadowMesh key={g.id} position={[g.x, g.y, g.z]} opacity={g.opacity} />
            ))} */}
            {ghostsRef.current.map((g) =>
  showWave ? (
    <WavePacket
      key={g.id}
      position={[g.x, g.y, g.z]}
      spin={g.spin}
      E_eV={E_eV}
      V0_eV={V0_eV}
      barrierWidth_nm={d_nm}
      J_ex={J_ex}
      M_FMI={M_FMI}
      isGhost={true}
    />
  ) : (
    <ShadowMesh
      key={g.id}
      position={[g.x, g.y, g.z]}
      opacity={g.opacity}
    />
  )
)}
          </group>
      </>
    );
  }


  function ParticleMesh({ position, spinUp }) {
    // console.log((d_nm/4))
    //  console.log("position:", position, "spinUp:", spinUp);
    return (
      <group position={position}>
        <Sphere args={[0.3, 10, 10]}>
          <meshStandardMaterial color={spinUp ? "hotpink" : "lightblue"} />
        </Sphere>
        <Billboard follow={true} position={[-0.3, 0.09, 0.2]}>
          <Text fontSize={0.3} color="white" anchorX="center" anchorY="middle">
            e-
          </Text>
        </Billboard>
      </group>
    );
  }


  function ShadowMesh({position, opacity=0.2}) {
    return (
      <group position={position}>
        <Sphere args={[0.3, 10, 10]}>
          <meshStandardMaterial color="#999A98" transparent={true} opacity={opacity} />
        </Sphere>
      </group>
    );
  }


  function WavePacket({
  position,
  spin,            // "up" or "down"
  E_eV,
  V0_eV,
  barrierWidth_nm,
  J_ex,
  M_FMI,
  isGhost = false, // <-- new prop
}) {
  const ref = useRef()
  const segments = 120
  const span_nm = 8

  const { geometry, psiBase } = useMemo(() => {
    const x_m = []
    const points = []
    const span_m = span_nm * 1e-9

    for (let i = 0; i < segments; i++) {
      const x = -span_m / 2 + (i / (segments - 1)) * span_m
      x_m.push(x)
    }

    const { up, down } = PH.getSpinEnergies(E_eV, J_ex, M_FMI)
    const E_spin = spin === "up" ? up : down

    const wf = PH.calculateWavefunction(
      x_m,
      V0_eV * PH.eV,
      E_spin * PH.eV,
      barrierWidth_nm * 1e-9
    )

    for (let i = 0; i < segments; i++) {
      const amp = Math.sqrt(wf.prob[i] || 0)
      points.push(new Vector3(i * 0.05, amp * 0.6, 0))
    }

    const geometry = new BufferGeometry().setFromPoints(points)
    return { geometry, psiBase: wf.prob || [] }
  }, [spin, E_eV, V0_eV, barrierWidth_nm, J_ex, M_FMI])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    const pos = ref.current.geometry.attributes.position.array

    for (let i = 0; i < segments; i++) {
      const amp = Math.sqrt(psiBase[i] || 0)
      const phase = Math.sin(i * 0.4 - t * 6)
      pos[i * 3 + 1] = amp * phase * (isGhost ? 0.35 : 0.7) // smaller for ghosts
    }
    ref.current.geometry.attributes.position.needsUpdate = true
  })

  // pick color: ghost = gray, else spin-based color
  const color = isGhost ? "#9a9a9a" : (spin === "up" ? "#ff4dd2" : "#4ecbff")
  const opacity = isGhost ? 0.35 : 0.95

  return (
    <line
      ref={ref}
      geometry={geometry}
      position={position}
      rotation={[0, Math.PI / 2, 0]} // face the barrier
    >
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  )
}
  const probValue = (spinUp ? Tvals.T_up:Tvals.T_down);
  return (
    <div
  className={`
    flex flex-row gap-3 h-full"
  `}
>
    <div className={`flex-1 bg-slate-900 rounded-md p-2 ${isFullScreen ? "h-screen" : "h-140"}`}>
      <Canvas key={isFullScreen ? "fs" : "normal"} style={{ width: "100%", height: "100%" }} pr={[1, 1.5]} gl={{ antialias: false }} camera={{ position: [-20, 0, 0], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[8, 10, 8]} intensity={0.9} />
        <directionalLight position={[-5, 8, 5]} intensity={0.6} />
        <mesh position={[0,0,0]} rotation={[0, 0, 0]} >
          {/* A rectangle with 4 units width, 2 units height, and minimal depth */}
          <boxGeometry args={[19, V0_eV*1.5, d_nm/4]} ref={barrierRef}/>
          <meshStandardMaterial color="teal" />
        </mesh>
        <ParticlesSim particleCount={particleCount} maxElectrons={maxElectrons} speed={speed} spinUp={spinUp}/>
        <OrbitControls
          enableDamping
          enablePan={false}
          maxPolarAngle={Math.PI / 2}
          // minDistance={4}
          // maxDistance={15}
        />
      </Canvas>
      </div>
      <div className="w-72 shrink-0">
        <div className="bg-white rounded-md p-3 shadow">
          <div className="font-semibold text-sm mb-2">Transmission Summary</div>
          <div className="text-xs text-slate-600 mb-2">Parameters</div>
          <ul className="text-xs">
            <li>V₀: {V0_eV.toFixed(3)} eV</li>
            <li>d: {d_nm.toFixed(3)} nm</li>
            <li>E_base: {E_eV.toFixed(4)} eV</li>
            <li>E_eff: {E_eff.toFixed(6)} eV</li>
            {/* <li>voltage: {voltage} V</li> */}
            {/* <li>temp: {temp} °C</li>
            <li>Effective electron mass: {PH.m0 * effectiveElectronMassMultiplier}</li> */}
          </ul>

          <div className="mt-3">
            <Plot data={plotData} layout={plotLayout} config={{ displayModeBar: false }} style={{ width: "100%" }} />
          </div>

          <h1>Current Model: <span className={`${modelKey === "our" ? "text-emerald-600" : "text-blue-600"}`}>{modelKey.toUpperCase()}</span></h1>

          <div className="mt-2 text-xs">
            <div>Current number of particles: {counts.total}</div>
            {/* <div><span className={`${(probValue== Math.max(Tvals.T_up, Tvals.T_down))?"text-indigo-600":"" }`}>Estimated probability T↑</span>: {typeof Math.max(Tvals.T_up, Tvals.T_down) === "number" ? Math.max(Tvals.T_up, Tvals.T_down).toExponential(2) : String(Math.max(Tvals.T_up, Tvals.T_down))}</div>
            <div><span className={`${(probValue== Math.max(Tvals.T_up, Tvals.T_down))?"": "text-indigo-600"}`}>Estimated probability T↓</span>: {typeof Math.min(Tvals.T_up, Tvals.T_down) === "number" ? Math.min(Tvals.T_up, Tvals.T_down).toExponential(2) : String(Math.min(Tvals.T_up, Tvals.T_down))}</div> */}
            <div><span>Estimated probability T</span>: {typeof probValue === "number" ? probValue.toExponential(2) : String(probValue)}</div>
            <div className="mt-2">Transmitted: {counts.transmitted}</div>
            <div>Reflected: {counts.reflected}</div>

            <div className="mt-3 flex gap-2">
              <button onClick={() => setRunning((r) => !r)} className="px-2 py-1 bg-slate-900 text-white rounded text-xs">
                {running ? "Pause" : "Resume"}
              </button>
              <button onClick={resetSim} className="px-2 py-1 bg-slate-900 text-white rounded text-xs">
                Reset
              </button>
              {/* <button
                className={`px-2 py-1 transition-colors text-xs ${
                  spinUp
                    ? "bg-sky-600 text-white hover:bg-sky-500"
                    : "bg-emerald-500 text-white hover:bg-emerald-400"
                }`}
                onClick={() => setSpinUp(!spinUp)}
              >
                {spinUp ? "Spin Up" : "Spin Down"}
              </button> */}
               <button
                className={`px-3 py-2 sm:px-4 sm:py-2 rounded-md text-sm font-semibold transition ${
                  modelKey === "our" ? "bg-sky-600 text-white shadow" : "bg-white text-slate-800 border"
                }`}
                onClick={() => setModelKey((prevKey) => prevKey === "our" ? "Market" : "our")}
              >
                Our model
              </button>

            </div>
            <div className="flex flex-row gap-2">
            <div className="mt-3 flex gap-2">
              <button 
                onClick={() => setShowWave((w) => !w)} 
                className={`px-2 py-1 rounded text-xs font-semibold ${showWave ? 'bg-purple-600 text-white' : 'bg-gray-300 text-gray-800'}`}
              >
                {showWave ? "Wave View" : "Particle View"}
              </button>
            </div>
            <div className="mt-3 flex gap-2">
            <button 
              onClick={() => {
                if (isFullScreen) {
                  exitFullscreen().catch(err => console.error("Exit fullscreen error:", err));
                } else {
                  enterFullscreen().catch(err => console.error("Enter fullscreen error:", err));
                }
              }}
              className="px-2 py-1 rounded text-xs font-semibold bg-gray-300 text-gray-800"
            >
              {isFullScreen ? "Exit Fullscreen" : "Go Fullscreen"}
            </button>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
