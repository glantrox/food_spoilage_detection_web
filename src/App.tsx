import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// --- Tipe Data (TypeScript Interfaces) ---
interface SensorData {
  mq3: number;
  mq4: number;
  mq8: number;
  mq135: number;
}

interface HistoryData extends SensorData {
  time: string;
}

interface Verdict {
  status: "SPOILED" | "FRESH";
  label: string;
  confidence: string;
  details: string;
}

interface GaugeChartProps {
  value: number;
  max?: number;
  label: string;
}

interface ManualInputState {
  mq3: string | number;
  mq4: string | number;
  mq8: string | number;
  mq135: string | number;
}

// --- Komponen Gauge Sederhana ---
const GaugeChart: React.FC<GaugeChartProps> = ({ value, max = 500, label }) => {
  const percentage = Math.min(value / max, 1);
  const rotation = -90 + (percentage * 180);

  const getColor = () => {
    if (value < 150) return '#10B981';
    if (value < 300) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      <div className="relative w-48 h-24 overflow-hidden mb-2">
        <div className="absolute top-0 left-0 w-48 h-48 rounded-full border-[20px] border-slate-200 box-border"></div>
        <div
          className="absolute top-0 left-0 w-48 h-48 rounded-full border-[20px] border-transparent box-border transition-all duration-500 ease-out"
          style={{
            borderTopColor: getColor(),
            borderRightColor: value > 250 ? getColor() : 'transparent',
            transform: `rotate(${rotation}deg)`
          }}
        ></div>
        <div
          className="absolute bottom-0 left-1/2 w-1 h-24 bg-slate-800 origin-bottom transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        >
          <div className="absolute -top-1 -left-1.5 w-4 h-4 bg-slate-800 rounded-full"></div>
        </div>
      </div>
      <span className="text-3xl font-bold font-mono text-slate-700">{Math.round(value)}</span>
      <span className="text-sm text-slate-500 font-medium mt-1">{label}</span>
      <span className="text-xs text-slate-400 mt-1">ppm (simulated)</span>
    </div>
  );
};

// --- Komponen Utama Aplikasi ---
export default function App() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [selectedPort, setSelectedPort] = useState<string>("COM3");
  const [selectedModel, setSelectedModel] = useState<string>("random_forest");
  const [dataSource, setDataSource] = useState<"simulation" | "manual">("simulation");

  const [sensorData, setSensorData] = useState<SensorData>({
    mq3: 45,
    mq4: 200,
    mq8: 150,
    mq135: 300
  });

  const [dataHistory, setDataHistory] = useState<HistoryData[]>([]);

  const [manualInput, setManualInput] = useState<ManualInputState>({
    mq3: '', mq4: '', mq8: '', mq135: ''
  });

  // Load FontAwesome
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  const getVerdict = (data: SensorData): Verdict => {
    const threshold = 300;
    const isSpoiled = data.mq3 > threshold;
    const confidence = isSpoiled
      ? Math.min(99.9, 85 + (data.mq3 - threshold) * 0.1)
      : Math.min(99.9, 90 + (threshold - data.mq3) * 0.05);

    return {
      status: isSpoiled ? "SPOILED" : "FRESH",
      label: isSpoiled ? "BUSUK (Terdeteksi Fermentasi)" : "SEGAR (Layak Konsumsi)",
      confidence: confidence.toFixed(2),
      details: isSpoiled
        ? "Kadar alkohol tinggi terdeteksi oleh sensor MQ3, mengindikasikan aktivitas mikroba."
        : "Profil gas dalam batas normal. Tidak ada tanda fermentasi signifikan."
    };
  };

  const verdict = getVerdict(sensorData);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isConnected && dataSource === 'simulation') {
      interval = setInterval(() => {
        setSensorData(prev => {
          // Simulasi: 15% kemungkinan lonjakan (mendekatkan sampel)
          const isSpike = Math.random() > 0.85;

          let changeMQ3 = (Math.random() * 40 - 20);

          // Jika terjadi spike, kita simulasikan lonjakan drastis untuk efek visual
          if (isSpike) {
            // Jika nilai rendah, lonjak ke tinggi (simulasi didekatkan ke busuk)
            // Jika nilai tinggi, drop (simulasi dijauhkan)
            changeMQ3 = prev.mq3 < 200 ? 150 : -100;
          }

          const newMQ3 = Math.max(0, prev.mq3 + changeMQ3);
          const newMQ4 = Math.max(0, 200 + (Math.random() * 20 - 10));
          const newMQ8 = Math.max(0, 150 + (Math.random() * 15 - 7.5));
          const newMQ135 = Math.max(0, 300 + (Math.random() * 30 - 15));

          return {
            mq3: newMQ3,
            mq4: newMQ4,
            mq8: newMQ8,
            mq135: newMQ135
          };
        });
      }, 800);
    }
    return () => clearInterval(interval);
  }, [isConnected, dataSource]);

  useEffect(() => {
    setDataHistory(prev => {
      const newEntry: HistoryData = {
        time: new Date().toLocaleTimeString('id-ID', { hour12: false, minute: '2-digit', second: '2-digit' }),
        ...sensorData
      };
      const newHistory = [...prev, newEntry];
      if (newHistory.length > 20) newHistory.shift();
      return newHistory;
    });
  }, [sensorData]);

  const handleManualInject = () => {
    setDataSource('manual');
    setIsConnected(false);
    setSensorData({
      mq3: Number(manualInput.mq3) || 0,
      mq4: Number(manualInput.mq4) || 0,
      mq8: Number(manualInput.mq8) || 0,
      mq135: Number(manualInput.mq135) || 0,
    });
  };

  const generateRandomManual = () => {
    setManualInput({
      mq3: Math.floor(Math.random() * 500),
      mq4: Math.floor(Math.random() * 400),
      mq8: Math.floor(Math.random() * 300),
      mq135: Math.floor(Math.random() * 600),
    });
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">

      {/* 1. SIDEBAR */}
      <aside className="w-80 bg-slate-900 text-white flex flex-col shadow-2xl z-10 shrink-0">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-wider flex items-center gap-2">
            <i className="fa-solid fa-microchip text-blue-400"></i>
            BIO-NOSE <span className="text-xs bg-blue-600 px-1 rounded">PRO</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">AI Food Spoilage Detector</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-8">

          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Hardware Config</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Select Serial Port</label>
                <div className="relative">
                  <select
                    value={selectedPort}
                    onChange={(e) => setSelectedPort(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                  >
                    <option value="COM3">COM3 (Arduino Uno)</option>
                    <option value="COM4">COM4</option>
                    <option value="/dev/ttyUSB0">/dev/ttyUSB0 (Linux)</option>
                  </select>
                  <i className="fa-solid fa-usb absolute right-3 top-2.5 text-slate-500"></i>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">AI Model</label>
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                  >
                    <option value="random_forest">Random Forest (Recommended)</option>
                    <option value="logistic">Logistic Regression</option>
                    <option value="xgboost">XGBoost Classifier</option>
                  </select>
                  <i className="fa-solid fa-brain absolute right-3 top-2.5 text-slate-500"></i>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium">Status</span>
              <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
                {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setIsConnected(true); setDataSource('simulation'); }}
                disabled={isConnected}
                className={`py-2 px-3 rounded text-sm font-bold transition-all ${isConnected ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50'}`}
              >
                <i className="fa-solid fa-play mr-2"></i> START
              </button>
              <button
                onClick={() => setIsConnected(false)}
                disabled={!isConnected}
                className={`py-2 px-3 rounded text-sm font-bold transition-all ${!isConnected ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/50'}`}
              >
                <i className="fa-solid fa-stop mr-2"></i> STOP
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex justify-between items-center">
              Data Injection
              <span className="text-[10px] bg-slate-700 px-1 rounded text-yellow-400">DEBUG MODE</span>
            </h3>
            <div className="bg-slate-800/50 p-3 rounded border border-slate-700 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">MQ3 (Alc)</label>
                  <input type="number" value={manualInput.mq3} onChange={e => setManualInput({ ...manualInput, mq3: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">MQ4 (Met)</label>
                  <input type="number" value={manualInput.mq4} onChange={e => setManualInput({ ...manualInput, mq4: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">MQ8 (Hyd)</label>
                  <input type="number" value={manualInput.mq8} onChange={e => setManualInput({ ...manualInput, mq8: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">MQ135 (Air)</label>
                  <input type="number" value={manualInput.mq135} onChange={e => setManualInput({ ...manualInput, mq135: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={generateRandomManual} className="flex-1 bg-slate-700 hover:bg-slate-600 text-xs py-1 rounded text-slate-300">
                  <i className="fa-solid fa-shuffle mr-1"></i> Rnd
                </button>
                <button onClick={handleManualInject} className="flex-1 bg-purple-600 hover:bg-purple-500 text-xs py-1 rounded text-white font-bold">
                  INJECT
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
          v1.0.2 | Connected to Backend (Mock)
        </div>
      </aside>

      {/* 2. MAIN AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">

        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">AI Food Spoilage Detection System</h2>
            <p className="text-slate-500 text-sm">Real-time Gas Array Analysis & Classification</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-400 font-bold uppercase">System Time</div>
              <div className="font-mono text-slate-700">{new Date().toLocaleTimeString()}</div>
            </div>
            <div className="h-8 w-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
              <i className="fa-solid fa-user"></i>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* BARIS 1: THE VERDICT */}
          <div className="grid grid-cols-1 gap-6">
            <div className={`relative overflow-hidden rounded-2xl shadow-lg border-2 transition-colors duration-500 flex flex-col md:flex-row items-center p-6 ${verdict.status === 'SPOILED' ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>

              <div className="flex items-center gap-6 z-10">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-inner ${verdict.status === 'SPOILED' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {verdict.status === 'SPOILED' ? <i className="fa-solid fa-bacteria"></i> : <i className="fa-solid fa-apple-whole"></i>}
                </div>
                <div>
                  <h3 className="text-slate-500 font-bold tracking-widest text-sm uppercase mb-1">Model Prediction</h3>
                  <div className={`text-4xl font-extrabold ${verdict.status === 'SPOILED' ? 'text-red-600' : 'text-emerald-600'}`}>
                    {verdict.label}
                  </div>
                  <p className="text-slate-600 mt-2 max-w-xl text-sm">
                    {verdict.details}
                  </p>
                </div>
              </div>

              <div className="mt-6 md:mt-0 md:ml-auto z-10 w-full md:w-64">
                <div className="flex justify-between text-sm font-bold text-slate-600 mb-1">
                  <span>Confidence Score</span>
                  <span>{verdict.confidence}%</span>
                </div>
                <div className="w-full bg-white h-4 rounded-full overflow-hidden shadow-inner border border-slate-200">
                  <div
                    className={`h-full transition-all duration-700 ${verdict.status === 'SPOILED' ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${verdict.confidence}%` }}
                  ></div>
                </div>
                <div className="text-xs text-slate-400 mt-2 text-right">Model: {selectedModel.replace('_', ' ').toUpperCase()}</div>
              </div>

              <div className="absolute -right-10 -bottom-10 text-9xl opacity-5 pointer-events-none">
                {verdict.status === 'SPOILED' ? <i className="fa-solid fa-triangle-exclamation"></i> : <i className="fa-solid fa-check-circle"></i>}
              </div>
            </div>
          </div>

          {/* BARIS 2: KEY INDICATORS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-600"></div>
              <div className="w-full flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-slate-700 flex items-center gap-2">
                    <i className="fa-solid fa-wine-bottle text-purple-500"></i> MQ3 - Alkohol
                  </h4>
                  <p className="text-xs text-slate-400">Indikator Utama Fermentasi</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${sensorData.mq3 > 300 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                  {sensorData.mq3 > 300 ? 'CRITICAL' : 'NORMAL'}
                </span>
              </div>

              <GaugeChart value={sensorData.mq3} max={600} label="Konsentrasi Gas" />

              <div className="text-center text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded w-full">
                <i className="fa-solid fa-circle-info mr-1"></i>
                Nilai &gt; 300 ppm menandakan pembusukan aktif.
              </div>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded bg-orange-100 text-orange-500 flex items-center justify-center">
                    <i className="fa-solid fa-fire-flame-curved"></i>
                  </div>
                  <span className="font-bold text-slate-600 text-sm">MQ4 (Metana)</span>
                </div>
                <div className="text-3xl font-bold text-slate-800">{sensorData.mq4}</div>
                <div className="text-xs text-slate-400 mt-1">Gas hidrokarbon dasar</div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded bg-blue-100 text-blue-500 flex items-center justify-center">
                    <i className="fa-brands fa-cloudversify"></i>
                  </div>
                  <span className="font-bold text-slate-600 text-sm">MQ8 (Hidrogen)</span>
                </div>
                <div className="text-3xl font-bold text-slate-800">{sensorData.mq8}</div>
                <div className="text-xs text-slate-400 mt-1">Produk sampingan bakteri</div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded bg-teal-100 text-teal-500 flex items-center justify-center">
                    <i className="fa-solid fa-wind"></i>
                  </div>
                  <span className="font-bold text-slate-600 text-sm">MQ135 (Air Q.)</span>
                </div>
                <div className="text-3xl font-bold text-slate-800">{sensorData.mq135}</div>
                <div className="text-xs text-slate-400 mt-1">Kualitas udara umum</div>
              </div>

              <div className="md:col-span-3 bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
                <i className="fa-solid fa-lightbulb text-blue-500 mt-1"></i>
                <div>
                  <h5 className="font-bold text-blue-700 text-sm">Scientific Context</h5>
                  <p className="text-xs text-blue-600 leading-relaxed">
                    Korelasi antara kenaikan <strong>MQ3 (Alkohol)</strong> yang drastis sementara <strong>MQ4</strong> stabil adalah pola unik (fingerprint) dari pembusukan buah berkarbohidrat tinggi. Model AI mendeteksi anomali vektor ini, bukan hanya nilai ambang batas tunggal.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* BARIS 3: LIVE ANALYSIS */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-bold text-slate-700 flex items-center gap-2">
                <i className="fa-solid fa-chart-line text-blue-600"></i> Live Sensor Analysis
              </h4>
              <div className="flex gap-4 text-xs font-bold">
                <span className="flex items-center gap-1 text-purple-600"><span className="w-3 h-1 bg-purple-600 rounded"></span> MQ3 (Alc)</span>
                <span className="flex items-center gap-1 text-orange-400"><span className="w-3 h-1 bg-orange-400 rounded"></span> MQ4 (Met)</span>
                <span className="flex items-center gap-1 text-blue-400"><span className="w-3 h-1 bg-blue-400 rounded"></span> MQ8 (Hyd)</span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dataHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="time" hide={true} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <ReferenceLine y={300} label="Spoilage Threshold" stroke="red" strokeDasharray="3 3" opacity={0.5} />

                  <Line type="monotone" dataKey="mq3" stroke="#9333ea" strokeWidth={3} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="mq4" stroke="#fb923c" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="mq8" stroke="#60a5fa" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}