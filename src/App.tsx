import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Terminal, Power, Thermometer, Droplets, Zap, Server, Activity } from 'lucide-react';
import { format } from 'date-fns';

import { useActivityLog } from './useActivityLog';
import { useMqtt } from './useMqtt';
import { useVoiceCommand } from './useVoice';
import { BrokerConfig } from './types';

// Pre-defined WebSocket connection parameters for the brokers
const BROKERS_PRESETS: BrokerConfig[] = [
  {
    label: 'Ably',
    url: 'wss://mqtt.ably.io', // Uses Ably SDK under the hood
    clientId: 'ESP_WEB_Ably',
    username: 'ZyRtEA.EIl0MA',
    password: 'jN4OHGaVHf2rbXzVYZGSmdfwWQJq7LBrvmP1H_0xkVM',
    protocolVersion: 4,
  },
  {
    label: 'Cedalo',
    url: 'wss://pf-ja6x4lxt1nt3206ohn7w.cedalo.cloud:443/mqtt',
    clientId: 'Web_Cedalo',
    username: 'Web',
    password: 's',
  },
  {
    label: 'CloudAMQP',
    url: 'wss://kingfisher.lmq.cloudamqp.com:443/mqtt',
    clientId: 'ESP_WEB_AMQP',
    username: 'jkhntckb:jkhntckb',
    password: 'kvIQg8q622zZOqLhpTgo_v5M0nB8orRa',
  },
];

export default function App() {
  const { logs, addLog } = useActivityLog();
  const [selectedBrokerIdx, setSelectedBrokerIdx] = useState(0); 

  // Latest sensor states for TTS reading
  const sensorsRef = useRef({ suhu: '--', humid: '--' });

  const handleSensorsUpdated = useCallback((suhu: string, humid: string) => {
    sensorsRef.current = { suhu, humid };
  }, []);

  const { isConnected, connect, disconnect, publish, state } = useMqtt({
    onLog: addLog,
    onSensorsUpdated: handleSensorsUpdated,
  });

  const handleVoiceCommand = useCallback((cmd: string, transcript: string) => {
    switch (cmd) {
      case 'TANYA_SUHU':
        speak(`Suhu saat ini adalah ${sensorsRef.current.suhu} derajat celcius`);
        break;
      case 'TANYA_KELEMBABAN':
        speak(`Kelembaban saat ini adalah ${sensorsRef.current.humid} persen`);
        break;
      case 'R1_ON': publish('kontrol/relay1', 'ON'); break;
      case 'R1_OFF': publish('kontrol/relay1', 'OFF'); break;
      case 'R2_ON': publish('kontrol/relay2', 'ON'); break;
      case 'R2_OFF': publish('kontrol/relay2', 'OFF'); break;
      case 'R3_ON': publish('kontrol/relay3', 'ON'); break;
      case 'R3_OFF': publish('kontrol/relay3', 'OFF'); break;
      case 'R4_ON': publish('kontrol/relay4', 'ON'); break;
      case 'R4_OFF': publish('kontrol/relay4', 'OFF'); break;
      case 'ALL_ON':
        publish('kontrol/relay1', 'ON'); publish('kontrol/relay2', 'ON'); 
        publish('kontrol/relay3', 'ON'); publish('kontrol/relay4', 'ON');
        break;
      case 'ALL_OFF':
        publish('kontrol/relay1', 'OFF'); publish('kontrol/relay2', 'OFF'); 
        publish('kontrol/relay3', 'OFF'); publish('kontrol/relay4', 'OFF');
        break;
      case 'VAR_1': publish('kontrol/variasi', '1'); break;
      case 'VAR_2': publish('kontrol/variasi', '2'); break;
      case 'VAR_STOP': publish('kontrol/variasi', 'STOP'); break;
    }
  }, [publish]);

  const { isListening, startListening, speak, supported } = useVoiceCommand(handleVoiceCommand, addLog);

  // Auto-connect to broker on mount
  useEffect(() => {
    connect(BROKERS_PRESETS[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBrokerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value);
    
    // Publish to the CURRENT broker so the ESP knows to switch
    publish('kontrol/broker', idx.toString());

    // Allow a brief moment for the message to be sent before disconnecting
    setTimeout(() => {
      setSelectedBrokerIdx(idx);
      disconnect();
      connect(BROKERS_PRESETS[idx]);
    }, 500);
  };

  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl space-y-6">
        
        {/* Header */}
        <header className="bg-white border border-slate-200 px-6 py-4 rounded-2xl flex flex-col md:flex-row items-center justify-between shadow-sm gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">IoT Control Hub</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Control & Monitor Panel</span>
                <span className="text-slate-300">•</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                  <span className={`text-[10px] font-bold ${isConnected ? 'text-emerald-600' : 'text-red-600'}`}>
                    {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-2 hidden sm:flex">
                <span className="text-xs text-slate-400 uppercase font-bold">Active Broker</span>
                <div className="flex items-center gap-1">
                  <select 
                    title="broker"
                    value={selectedBrokerIdx}
                    onChange={handleBrokerChange}
                    className="bg-transparent text-sm font-semibold text-blue-600 focus:outline-none cursor-pointer"
                  >
                    {BROKERS_PRESETS.map((b, i) => (
                      <option key={i} value={i}>{b.label}</option>
                    ))}
                  </select>
                </div>
            </div>

            <button
              onClick={startListening}
              disabled={!supported || isListening}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
                isListening 
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200 animate-pulse' 
                  : 'bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-blue-200'
              }`}
            >
              <Mic className="w-5 h-5" />
              {isListening ? 'Mendengarkan...' : 'Voice Command'}
            </button>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Sensors & Variasi */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Sensors Area */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="p-3 bg-orange-100 text-orange-600 rounded-xl shrink-0">
                  <Thermometer className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Temperature</p>
                  <h3 className="text-2xl font-bold text-slate-900">{state.temperature}<span className="text-sm text-slate-400 font-normal ml-1">°C</span></h3>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl shrink-0">
                  <Droplets className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Humidity</p>
                  <h3 className="text-2xl font-bold text-slate-900">{state.humidity}<span className="text-sm text-slate-400 font-normal ml-1">%</span></h3>
                </div>
              </div>
            </div>

            {/* Mode Variasi */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center">
                <span className="w-1.5 h-4 bg-indigo-500 rounded-full mr-2"></span>
                Variasi Pattern
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => publish('kontrol/variasi', '1')}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs md:text-sm transition-opacity ${state.variasiMode === 1 ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  MODE 1 (CHASE)
                </button>
                <button
                  onClick={() => publish('kontrol/variasi', '2')}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs md:text-sm transition-opacity ${state.variasiMode === 2 ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  MODE 2 (REVERSE)
                </button>
                <button
                  onClick={() => publish('kontrol/variasi', 'STOP')}
                  className="flex-1 py-3 px-4 border-2 border-red-500 text-red-500 rounded-xl font-bold text-xs md:text-sm hover:bg-red-50 transition-colors"
                >
                  STOP PATTERN
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Relays & Logs */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Relays */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-slate-800">
              <h2 className="text-lg font-bold mb-6 flex items-center">
                <span className="w-1.5 h-6 bg-blue-600 rounded-full mr-3"></span>
                Manual Relay Control
              </h2>
              <div className="grid grid-cols-2 gap-4 lg:gap-6">
                {[1, 2, 3, 4].map((num, i) => {
                  const isActive = state.relays[i];
                  return (
                    <button
                      key={num}
                      onClick={() => publish(`kontrol/relay${num}`, isActive ? 'OFF' : 'ON')}
                      className={`text-left p-4 rounded-2xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:scale-[0.98] ${
                        isActive 
                          ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className={`font-bold ${isActive ? 'text-blue-900' : 'text-slate-700'}`}>
                          Relay {num}
                        </span>
                        {/* Switch indicator */}
                        <div className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${isActive ? 'bg-blue-600 justify-end' : 'bg-slate-200 justify-start'}`}>
                          <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                        </div>
                      </div>
                      <p className={`text-xs font-medium ${isActive ? 'text-blue-700' : 'text-slate-400'}`}>
                        Status: {isActive ? 'Active (ON)' : 'Idle (OFF)'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Logs */}
            <div className="bg-white flex-1 rounded-2xl border border-slate-100 flex flex-col overflow-hidden shadow-sm min-h-[300px]">
              <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-400" />
                  Activity Log
                </h2>
                <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-1 rounded font-bold uppercase tracking-tight">Live Feed</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
                {logs.length === 0 ? (
                  <div className="text-slate-400 text-sm font-medium italic">No activity yet.</div>
                ) : (
                  [...logs].reverse().map((log) => {
                    const dotColors = {
                      error: 'bg-rose-500',
                      success: 'bg-emerald-500',
                      voice: 'bg-indigo-500',
                      mqtt: 'bg-amber-500',
                      info: 'bg-blue-500'
                    };
                    const titleColors = {
                      error: 'text-rose-700',
                      success: 'text-emerald-700',
                      voice: 'text-indigo-700',
                      mqtt: 'text-amber-700',
                      info: 'text-slate-900'
                    };
                    const titleTexts = {
                      error: 'System Error',
                      success: 'System Success',
                      voice: 'Voice Command',
                      mqtt: 'MQTT Protocol',
                      info: 'System Event'
                    };

                    return (
                      <div key={log.id} className="flex space-x-3 items-start">
                        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotColors[log.type]}`}></div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${titleColors[log.type]}`}>{titleTexts[log.type]}</p>
                          <p className="text-xs text-slate-600 break-words mt-0.5 leading-relaxed">{log.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block font-mono">{format(log.time, 'HH:mm:ss')}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

