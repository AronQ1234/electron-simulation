import InfoDialog from "./InfoDialog";
import DetailsList from "./DetailsList";
//. Todo: fix section for tab 2 add text explonation for info
//Todo: add tab 3  simulation fix
const SideControlPanel = ({
  voltage, setVoltage, temperature, setTemperature, humidity, setHumidity, 
  computeMetrics, tab, parts = [], totalPartsPriceLow = "0.00", totalPartsPriceHigh = "0.00", selectedChip, chipModel,
  V0, setV0, d_nm, setDnm, E_eV, setE, J_ex, setJex, M_FMI, setM
}) => {
  return (
    <aside className="w-72 p-4">
      {tab === 1 ? (
        <div className="bg-white rounded-lg p-4 shadow">
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
        <div className=" sticky top-4">
          <div className="bg-white rounded-lg p-4 shadow mb-2">
          <div className="text-sm font-semibold mb-3">Barrier & FMI Controls</div>

          <label className="block text-xs"><InfoDialog text="Height of the potential barrier" placement="left"/> Barrier height V₀: <span className="font-semibold">{V0.toFixed(2)} eV</span></label>
          <input className="w-full" type="range" min="0.5" max="3.0" step="0.01" value={V0} onChange={(e)=>setV0(+e.target.value)} />

          <label className="block text-xs mt-3"><InfoDialog text="Width of the potential barrier" placement="left"/> Barrier width d: <span className="font-semibold">{d_nm.toFixed(2)} nm</span></label>
          <input className="w-full" type="range" min="0.5" max="10.0" step="0.1" value={d_nm} onChange={(e)=>setDnm(+e.target.value)} />

          <label className="block text-xs mt-3"><InfoDialog text="Kinetic energy of the incident electron" placement="left"/> Electron energy E: <span className="font-semibold">{E_eV.toFixed(2)} eV</span></label>
          <input className="w-full" type="range" min="0.05" max="2.5" step="0.01" value={E_eV} onChange={(e)=>setE(+e.target.value)} />

          <div className="text-sm font-semibold mt-3"><InfoDialog text="Exchange coupling strength between electron spin and FMI magnetization" placement="left"/> FMI exchange</div>
          <label className="block text-xs">J_ex: <span className="font-semibold">{J_ex.toFixed(3)} eV</span></label>
          <input className="w-full" type="range" min="0.0" max="2.0" step="0.001" value={J_ex} onChange={(e)=>setJex(+e.target.value)} />

          <label className="block text-xs mt-2"><InfoDialog text="Magnetization factor of the ferromagnetic insulator (-1 to +1)" placement="left"/> M_FMI: <span className="font-semibold">{M_FMI.toFixed(2)}</span></label>
          <input className="w-full" type="range" min="-1.0" max="1.0" step="0.05" value={M_FMI} onChange={(e)=>setM(+e.target.value)} />
          </div>
          <div className="bg-white rounded-lg p-4 shadow ">
            {/* <div className="text-sm font-semibold mb-2">Results</div> */}
            <div className="bg-slate-50 rounded-md p-3 mt-2">
              <div className="text-sm font-semibold"><InfoDialog text="Electron loss percentage in the FMI" placement="left"/> Efficiency</div>
              <div className="text-xl font-bold mt-1">{computeMetrics(NaN, NaN, {}, V0, d_nm, E_eV, J_ex, M_FMI).efficiency}%</div>
            </div>
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
        <div className="bg-white rounded-lg p-4 shadow">
          <div className="text-sm font-semibold mb-3">Parameters</div>
          <label className="block text-sm text-slate-700 mb-2">Voltage: <span className="font-semibold">{voltage.toFixed(1)} V</span></label>
          <input className="w-full" type="range" min="1" max="12" step="0.1" value={voltage} onChange={(e)=>setVoltage(+e.target.value)} />
          <label className="block text-sm text-slate-700 mb-2">Temperature: <span className="font-semibold">{temperature.toFixed(1)} °C</span></label>
          <input className="w-full" type="range" min="1" max="120" step="0.1" value={temperature} onChange={(e)=>setTemperature(+e.target.value)} />
          <label className="block text-xs"><InfoDialog text="Height of the potential barrier" placement="left"/> Barrier height V₀: <span className="font-semibold">{V0.toFixed(2)} eV</span></label>
          <input className="w-full" type="range" min="0.5" max="3.0" step="0.01" value={V0} onChange={(e)=>setV0(+e.target.value)} />

          <label className="block text-xs mt-3"><InfoDialog text="Width of the potential barrier" placement="left"/> Barrier width d: <span className="font-semibold">{d_nm.toFixed(2)} nm</span></label>
          <input className="w-full" type="range" min="0.5" max="10.0" step="0.1" value={d_nm} onChange={(e)=>setDnm(+e.target.value)} />

          <label className="block text-xs mt-3"><InfoDialog text="Kinetic energy of the incident electron" placement="left"/> Electron energy E: <span className="font-semibold">{E_eV.toFixed(2)} eV</span></label>
          <input className="w-full" type="range" min="0.05" max="2.5" step="0.01" value={E_eV} onChange={(e)=>setE(+e.target.value)} />

          <div className="text-sm font-semibold mt-3"><InfoDialog text="Exchange coupling strength between electron spin and FMI magnetization" placement="left"/> FMI exchange</div>
          <label className="block text-xs">J_ex: <span className="font-semibold">{J_ex.toFixed(3)} eV</span></label>
          <input className="w-full" type="range" min="0.0" max="2.0" step="0.001" value={J_ex} onChange={(e)=>setJex(+e.target.value)} />

          <label className="block text-xs mt-2"><InfoDialog text="Magnetization factor of the ferromagnetic insulator (-1 to +1)" placement="left"/> M_FMI: <span className="font-semibold">{M_FMI.toFixed(2)}</span></label>
          <input className="w-full" type="range" min="-1.0" max="1.0" step="0.05" value={M_FMI} onChange={(e)=>setM(+e.target.value)} />
          <div className="mt-4">
            <div className="text-sm font-semibold">Results</div>
            <div className="bg-slate-50 rounded-md p-3 mt-2">
              <div className="text-sm font-semibold">Efficiency</div>
              <div className="text-xl font-bold mt-1">{computeMetrics(voltage, temperature, chipModel, V0, d_nm, E_eV, J_ex, M_FMI).efficiency}%</div>
              <div className="text-sm text-slate-600 mt-2">Est. cost: ${computeMetrics(voltage, temperature, chipModel, V0, d_nm, E_eV, J_ex, M_FMI).cost_est}</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default SideControlPanel;
