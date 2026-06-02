import { useState, useEffect, useCallback, useRef } from 'react';
import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { AppState, BrokerConfig } from './types';

interface UseMqttProps {
  onLog: (msg: string, type: 'info' | 'error' | 'success' | 'mqtt') => void;
  onSensorsUpdated: (suhu: string, humid: string) => void;
}

export function useMqtt({ onLog, onSensorsUpdated }: UseMqttProps) {
  const [client, setClient] = useState<MqttClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<MqttClient | null>(null);

  const [state, setState] = useState<AppState>({
    temperature: '--',
    humidity: '--',
    relays: [false, false, false, false],
    variasiMode: 0,
  });

  const connect = useCallback((config: BrokerConfig) => {
    if (clientRef.current) {
      clientRef.current.end();
    }

    onLog(`Connecting to ${config.label} at ${config.url}`, 'info');

    const options: IClientOptions = {
      clientId: config.clientId,
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 5000,
      username: config.username,
      password: config.password,
      protocolVersion: 4,
    };

    const newClient = mqtt.connect(config.url, options);
    clientRef.current = newClient;
    setClient(newClient);

    newClient.on('connect', () => {
      setIsConnected(true);
      onLog(`Terhubung ke MQTT Broker: ${config.label}`, 'success');

      // Subscribe to sensors
      newClient.subscribe('sensor/suhu');
      newClient.subscribe('sensor/kelembaban');
      // Subscribe to relay commands (to sync if multiple clients publish, optional but good)
      newClient.subscribe('kontrol/relay1');
      newClient.subscribe('kontrol/relay2');
      newClient.subscribe('kontrol/relay3');
      newClient.subscribe('kontrol/relay4');
      newClient.subscribe('kontrol/variasi');
    });

    newClient.on('error', (err) => {
      onLog(`MQTT Error: ${err.message}`, 'error');
    });

    newClient.on('offline', () => {
      setIsConnected(false);
      onLog('MQTT Offline', 'error');
    });

    newClient.on('message', (topic, message) => {
      const msgStr = message.toString().trim();
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

    return () => {
      newClient.end();
    };
  }, [onLog, onSensorsUpdated]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.end();
      clientRef.current = null;
      setClient(null);
      setIsConnected(false);
      onLog('Disconnected from MQTT', 'info');
    }
  }, [onLog]);

  const publish = useCallback((topic: string, message: string) => {
    if (clientRef.current && clientRef.current.connected) {
      clientRef.current.publish(topic, message);
      onLog(`TX: [${topic}] ${message}`, 'info');
    } else {
      onLog(`Tidak bisa mengirim [${topic}], MQTT belum terhubung!`, 'error');
    }
  }, [onLog]);

  return { isConnected, connect, disconnect, publish, state };
}
