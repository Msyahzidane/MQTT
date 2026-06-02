import { useState, useEffect, useCallback, useRef } from 'react';
import * as Ably from 'ably';
import { AppState } from './types';

interface UseMqttProps {
  onLog: (msg: string, type: 'info' | 'error' | 'success' | 'mqtt') => void;
  onSensorsUpdated: (suhu: string, humid: string) => void;
}

export function useMqtt({ onLog, onSensorsUpdated }: UseMqttProps) {
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<Ably.Realtime | null>(null);
  const channelsRef = useRef<Map<string, Ably.RealtimeChannel>>(new Map());

  const [state, setState] = useState<AppState>({
    temperature: '--',
    humidity: '--',
    relays: [false, false, false, false],
    variasiMode: 0,
  });

  const connect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.close();
    }

    onLog(`Connecting to Ably Realtime`, 'info');

    // Setup Ably Realtime
    const newClient = new Ably.Realtime({
      key: 'ZyRtEA.EIl0MA:jN4OHGaVHf2rbXzVYZGSmdfwWQJq7LBrvmP1H_0xkVM',
      clientId: 'Web_Control_Panel_' + Math.random().toString(16).substring(2, 8)
    });
    
    clientRef.current = newClient;

    newClient.connection.on('connected', () => {
      setIsConnected(true);
      onLog(`Terhubung ke Ably Realtime!`, 'success');

      // Helper for channel subscription
      const subscribeChannel = (topic: string) => {
        const channel = newClient.channels.get(topic);
        channelsRef.current.set(topic, channel);
        
        channel.subscribe((message) => {
          let msgStr = '';
          if (typeof message.data === 'string') {
            msgStr = message.data.trim();
          } else if (message.data instanceof ArrayBuffer || message.data instanceof Buffer) {
            msgStr = new TextDecoder().decode(message.data).trim();
          }

          onLog(`RX: [${topic}] ${msgStr}`, 'mqtt');

          if (topic === 'sensor/suhu') {
            setState((prev) => {
              onSensorsUpdated(msgStr, prev.humidity);
              return { ...prev, temperature: msgStr };
            });
          } else if (topic === 'sensor/kelembaban') {
            setState((prev) => {
              onSensorsUpdated(prev.temperature, msgStr);
              return { ...prev, humidity: msgStr };
            });
          } else if (topic.startsWith('kontrol/relay')) {
            const idxMatch = topic.match(/relay(\d)/);
            if (idxMatch) {
              const idx = parseInt(idxMatch[1]) - 1;
              const isOn = msgStr === 'ON';
              setState((prev) => {
                const newRelays = [...prev.relays] as [boolean, boolean, boolean, boolean];
                newRelays[idx] = isOn;
                return { ...prev, relays: newRelays };
              });
            }
          } else if (topic === 'kontrol/variasi') {
            if (msgStr === 'STOP') {
              setState((prev) => ({ ...prev, variasiMode: 0, relays: [false, false, false, false] }));
            } else {
              setState((prev) => ({ ...prev, variasiMode: parseInt(msgStr) || 1 }));
            }
          }
        });
      };

      // Subscribe to topics
      subscribeChannel('sensor/suhu');
      subscribeChannel('sensor/kelembaban');
      subscribeChannel('kontrol/relay1');
      subscribeChannel('kontrol/relay2');
      subscribeChannel('kontrol/relay3');
      subscribeChannel('kontrol/relay4');
      subscribeChannel('kontrol/variasi');
    });

    newClient.connection.on('failed', (err) => {
      onLog(`Ably Error: ${err?.message || 'Connection failed'}`, 'error');
    });

    newClient.connection.on('disconnected', () => {
      setIsConnected(false);
      onLog('Ably Disconnected', 'error');
    });

    newClient.connection.on('closed', () => {
      setIsConnected(false);
      onLog('Ably Connection Closed', 'error');
    });

    return () => {
      newClient.close();
    };
  }, [onLog, onSensorsUpdated]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.close();
      clientRef.current = null;
      channelsRef.current.clear();
      setIsConnected(false);
      onLog('Disconnected from Ably', 'info');
    }
  }, [onLog]);

  const publish = useCallback((topic: string, message: string) => {
    if (clientRef.current && isConnected) {
      const channel = channelsRef.current.get(topic) || clientRef.current.channels.get(topic);
      channel.publish('msg', message);
      onLog(`TX: [${topic}] ${message}`, 'info');
    } else {
      onLog(`Tidak bisa mengirim [${topic}], Ably belum terhubung!`, 'error');
    }
  }, [isConnected, onLog]);

  return { isConnected, connect, disconnect, publish, state };
}
