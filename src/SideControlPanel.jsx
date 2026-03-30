import InfoDialog from "./InfoDialog";
import DetailsList from "./DetailsList";
import { m0 } from "./physics";

const SideControlPanel = ({
  voltage, setVoltage, setTemperature, parameter, setParameter,
  tab, parts = [], totalPartsPriceLow = "0.00", totalPartsPriceHigh = "0.00", selectedChip, chipModel,
  V0, setV0, d_nm, setDnm, E_eV, setE, J_ex, setJex, M_FMI, setM, defaults, spinUP, setSpinUP, particleCount, setParticleCount, effectiveElectronMassMultiplier, setEffectiveElectronMassMultiplier
}) => {
  return (
    <aside className="w-full lg:w-72 p-3 sm:p-4">
      {tab === 1 ? (
        <div className="bg-white rounded-lg p-4 shadow max-h-[60vh] lg:max-h-none overflow-y-auto">
          <div className="text-sm font-semibold mb-3">Parts & Pricing</div>
          <div className="overflow-y">
            {parts.map((p) => (
              <div key={p.key} className="flex-col justify-between items-center py-2 border-b border-slate-100">
                <div className="flex items-center gap-1">
                  <InfoDialog className="z-10" text={p.explonation} placement="left"/>
                  <div className="font-semibold text-sm">{p.name}</div>
                </div>
                <div className="">${(p.lowp||0).toFixed(2)} - ${(p.highp||0).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-slate-200 mt-3 pt-3 flex justify-between items-center">
            <div className="font-semibold">Total</div>
            <div className="font-extrabold text-lg">${totalPartsPriceLow} - ${totalPartsPriceHigh}</div>
          </div>
        </div>
      ) : tab === 2 ? (
        <div className=" sticky top-4 max-h-[60vh] lg:max-h-none overflow-y-auto">
          <div className="bg-white rounded-lg p-4 shadow mb-2">
          <div className="text-sm font-semibold mb-3">Barrier & FMI Controls</div>

          <label className="block text-xs"><InfoDialog text="Height of the potential barrier" placement="left"/> Barrier height V₀: <span className="font-semibold">{V0.toFixed(2)} eV</span></label>
          <input className="w-full h-2 accent-sky-500 cursor-pointer" type="range" min="0.5" max="3.0" step="0.01" value={V0} onChange={(e)=>setV0(+e.target.value)} />

          <label className="block text-xs mt-3"><InfoDialog text="Width of the potential barrier" placement="left"/> Barrier width d: <span className="font-semibold">{d_nm.toFixed(2)} nm</span></label>
          <input className="w-full h-2 accent-sky-500 cursor-pointer" type="range" min="0.5" max="10.0" step="0.1" value={d_nm} onChange={(e)=>setDnm(+e.target.value)} />

          <label className="block text-xs mt-3"><InfoDialog text="Kinetic energy of the incident electron" placement="left"/> Electron energy E: <span className="font-semibold">{E_eV.toFixed(2)} eV</span></label>
          <input className="w-full h-2 accent-sky-500 cursor-pointer" type="range" min="0.05" max="2.5" step="0.01" value={E_eV} onChange={(e)=>setE(+e.target.value)} />

          <div className="text-sm font-semibold mt-3"><InfoDialog text="Exchange coupling strength between electron spin and FMI magnetization" placement="left"/> FMI exchange</div>
          <label className="block text-xs">J_ex: <span className="font-semibold">{J_ex.toFixed(3)} eV</span></label>
          <input className="w-full h-2 accent-sky-500 cursor-pointer" type="range" min="0.0" max="2.0" step="0.001" value={J_ex} onChange={(e)=>setJex(+e.target.value)} />

          <label className="block text-xs mt-2"><InfoDialog text="Magnetization factor of the ferromagnetic insulator (-1 to +1)" placement="left"/> M_FMI: <span className="font-semibold">{M_FMI.toFixed(2)}</span></label>
          <input className="w-full h-2 accent-sky-500 cursor-pointer" type="range" min="-1.0" max="1.0" step="0.05" value={M_FMI} onChange={(e)=>setM(+e.target.value)} />
          </div>
          <div className="bg-white rounded-lg p-4 shadow ">
            <div className="text-sm font-semibold mb-2">Results</div>
            <DetailsList
              title="Purpose of graphs"
              infoText="Explains what each graph shows"
              items={[
                "This chart shows how likely an electron is to get through the barrier at different energies. The blue and red lines are the probabilities for spin-up and spin-down electrons; the dashed verticals mark each spin’s effective barrier and the green marker is the current energy. Because the vertical axis is logarithmic, small-looking drops mean huge decreases in chance.",
                "This plot shows where the electron is most likely to be found as it approaches, sits inside, and leaves the barrier. The oscillations left/right are the free-particle regions, while the exponential drop inside the shaded barrier is the tunneling signature, more amplitude past the barrier means more particles get through. Comparing the blue and red curves shows which spin is more present inside/after the barrier (i.e., which spin tunnels better).",
              ]}
              defaultOpen={false}
            />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-4 shadow max-h-[60vh] lg:max-h-none overflow-y-auto">
          <div className="text-sm font-semibold mb-3">Parameters</div>
          
          <div className="block text-xs"><InfoDialog text="Enable or disable voltage" placement="left"/><button className={`${parameter ? 'bg-red-500' : 'bg-green-500'} text-white py-1 px-3 rounded`} onClick={()=>setParameter(!parameter)}>{parameter ? <h6>Disable</h6>: <h5>Enable</h5>} </button> {parameter === true? <>Voltage: <span className="font-semibold">{voltage.toFixed(1)} V</span></> : null}  </div>
          {parameter ?(
            <input className="w-full h-2 accent-sky-500 cursor-pointer" type="range" min="1" max="200" step="0.1" value={voltage} onChange={(e)=>setVoltage(+e.target.value)} />
          ) : null}
          <label className="block text-xs"><InfoDialog text="Height of the potential barrier" placement="left"/> Barrier height V₀: <span className="font-semibold">{V0.toFixed(2)} eV</span></label>
          <input className="w-full h-2 accent-sky-500 cursor-pointer" type="range" min="0.5" max="10" step="0.01" value={V0} onChange={(e)=>setV0(+e.target.value)} />

          <label className="block text-xs mt-3"><InfoDialog text="Width of the potential barrier" placement="left"/> Barrier width d: <span className="font-semibold">{d_nm.toFixed(2)} nm</span></label>
          <input className="w-full h-2 accent-sky-500 cursor-pointer" type="range" min="0.5" max="10.0" step="0.1" value={d_nm} onChange={(e)=>setDnm(+e.target.value)} />

          <label className="block text-xs mt-3"><InfoDialog text="Kinetic energy of the incident electron" placement="left"/> Electron energy E: <span className="font-semibold">{E_eV.toFixed(2)} eV</span></label>
          <input className="w-full h-2 accent-sky-500 cursor-pointer" type="range" min="0.05" max="2.5" step="0.01" value={E_eV} onChange={(e)=>setE(+e.target.value)} />

          <div className="text-sm font-semibold mt-3"><InfoDialog text="Exchange coupling strength between electron spin and FMI magnetization" placement="left"/> FMI exchange</div>
          <label className="block text-xs">J_ex: <span className="font-semibold">{J_ex.toFixed(3)} eV</span></label>
          <input className="w-full h-2 accent-sky-500 cursor-pointer" type="range" min="0.0" max="2.0" step="0.001" value={J_ex} onChange={(e)=>setJex(+e.target.value)} />

          <label className="block text-xs mt-2"><InfoDialog text="Magnetization factor of the ferromagnetic insulator (-1 to +1)" placement="left"/> M_FMI: <span className="font-semibold">{M_FMI.toFixed(2)}</span></label>
          <input className="w-full h-2 accent-sky-500 cursor-pointer" type="range" min="-1.0" max="1.0" step="0.05" value={M_FMI} onChange={(e)=>setM(+e.target.value)} />
          
          <label className="block text-xs"><InfoDialog text="multiplyier of m0, parameter that describes how an electron behaves within a crystal lattice" placement="left"/>Effective Electron Mass Multiplier: <span className="font-semibold">{effectiveElectronMassMultiplier.toFixed(2)}</span></label>
          <input className="w-full h-2 accent-sky-500 cursor-pointer" type="range" min="0" max="3" step="0.01" value={effectiveElectronMassMultiplier} onChange={(e)=>setEffectiveElectronMassMultiplier(+e.target.value)} />

          <div className="text-sm font-semibold mt-3"><InfoDialog text="Number of particles constantly in the simulation, it is the same as the max number of possible particles" placement="left"/> Particle Count</div>
          <label className="block text-xs">Particle Count: <span className="font-semibold">{particleCount}</span></label>
          <input className="w-full h-2 accent-sky-500 cursor-pointer" type="range" min="1" max="100" step="1" value={particleCount} onChange={(e)=>setParticleCount(parseInt(e.target.value))} />

           <div className="flex gap-2 mt-2">

              <button
                className="px-3 py-2 rounded-md bg-gray-600 text-amber-50 hover:bg-gray-500 transition-colors"
                onClick={() => {
                  setVoltage(5);
                  setDnm(defaults.d_nm);
                  setE(defaults.E_eV);
                  setJex(defaults.J_ex);
                  setM(defaults.M_FMI);
                  setV0(defaults.V0_eV);
                  setTemperature(25);
                }}
              >
                Reset
              </button>

              <button
                className={`px-3 py-2 rounded-md transition-colors ${
                  spinUP
                    ? "bg-sky-600 text-white hover:bg-sky-500"
                    : "bg-emerald-500 text-white hover:bg-emerald-400"
                }`}
                onClick={() => setSpinUP(!spinUP)}
              >
                {spinUP ? "Spin Up" : "Spin Down"}
              </button>

            </div>
          </div>
      )}
    </aside>
  );
};

export default SideControlPanel;
