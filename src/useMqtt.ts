import { useState, useEffect, useCallback, useRef } from 'react';
import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import * as Ably from 'ably';
import { AppState, BrokerConfig } from './types';

interface UseMqttProps {
  onLog: (msg: string, type: 'info' | 'error' | 'success' | 'mqtt') => void;
  onSensorsUpdated: (suhu: string, humid: string) => void;
}

export function useMqtt({ onLog, onSensorsUpdated }: UseMqttProps) {
  const [isConnected, setIsConnected] = useState(false);
  
  // MQTT Client ref
  const mqttClientRef = useRef<MqttClient | null>(null);
  
  // Ably Client refs
  const ablyClientRef = useRef<Ably.Realtime | null>(null);
  const channelsRef = useRef<Map<string, Ably.RealtimeChannel>>(new Map());

  const currentBrokerRef = useRef<string>('');

  const [state, setState] = useState<AppState>({
    temperature: '--',
    humidity: '--',
    relays: [false, false, false, false],
    variasiMode: 0,
  });

  const connect = useCallback((config: BrokerConfig) => {
    if (mqttClientRef.current) {
      mqttClientRef.current.end();
      mqttClientRef.current = null;
    }
    if (ablyClientRef.current) {
      ablyClientRef.current.close();
      ablyClientRef.current = null;
      channelsRef.current.clear();
    }
    setIsConnected(false);

    onLog(`Connecting to ${config.label}...`, 'info');
    currentBrokerRef.current = config.label;

    const handleMessage = (topic: string, msgStr: string) => {
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
    };

    if (config.label === 'Ably') {
      const newClient = new Ably.Realtime({
        key: config.username && config.password ? `${config.username}:${config.password}` : (config.password || ''),
        clientId: 'Web_Control_Panel_' + Math.random().toString(16).substring(2, 8)
      });
      
      ablyClientRef.current = newClient;

      newClient.connection.on('connected', () => {
        setIsConnected(true);
        onLog(`Terhubung ke Ably Realtime!`, 'success');

        const subscribeChannel = (topic: string) => {
          const channel = newClient.channels.get(topic);
          channelsRef.current.set(topic, channel);
          
          channel.subscribe((message) => {
            let msgStr = '';
            // Handle different types of payloads
            if (typeof message.data === 'string') {
              msgStr = message.data.trim();
            } else if (message.data instanceof ArrayBuffer || message.data instanceof Buffer) {
              msgStr = new TextDecoder().decode(message.data).trim();
            } else if (typeof message.data === 'object' && message.data !== null && 'buffer' in message.data) {
                // Edge case for buffer-like objects
                msgStr = new TextDecoder().decode((message.data as any).buffer).trim();
            } else if (message.data) {
                msgStr = String(message.data).trim();
            }
  
            handleMessage(topic, msgStr);
          });
        };

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
    } else {
       // Standard MQTT connection
       const options: IClientOptions = {
        clientId: config.clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 5000,
        username: config.username,
        password: config.password,
        protocolVersion: config.protocolVersion || 4,
      };

      const newClient = mqtt.connect(config.url, options);
      mqttClientRef.current = newClient;

      newClient.on('connect', () => {
        setIsConnected(true);
        onLog(`Terhubung ke MQTT Broker: ${config.label}`, 'success');

        newClient.subscribe('sensor/suhu');
        newClient.subscribe('sensor/kelembaban');
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
        handleMessage(topic, message.toString().trim());
      });
    }

  }, [onLog, onSensorsUpdated]);

  const disconnect = useCallback(() => {
    if (ablyClientRef.current) {
      ablyClientRef.current.close();
      ablyClientRef.current = null;
      channelsRef.current.clear();
      setIsConnected(false);
      onLog('Disconnected from Ably', 'info');
    }
    if (mqttClientRef.current) {
      mqttClientRef.current.end();
      mqttClientRef.current = null;
      setIsConnected(false);
      onLog('Disconnected from MQTT', 'info');
    }
  }, [onLog]);

  const publish = useCallback((topic: string, message: string) => {
      if (!isConnected) {
          onLog(`Tidak bisa mengirim [${topic}], broker belum terhubung!`, 'error');
          return;
      }
      
      if (currentBrokerRef.current === 'Ably') {
        if (ablyClientRef.current) {
            const channel = channelsRef.current.get(topic) || ablyClientRef.current.channels.get(topic);
            channel.publish('msg', message);
            onLog(`TX: [${topic}] ${message}`, 'info');
        }
      } else {
        if (mqttClientRef.current) {
            mqttClientRef.current.publish(topic, message);
            onLog(`TX: [${topic}] ${message}`, 'info');
        }
      }
  }, [isConnected, onLog]);

  return { isConnected, connect, disconnect, publish, state };
}
