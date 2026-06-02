export interface LogEntry {
  id: string;
  time: Date;
  message: string;
  type: 'info' | 'error' | 'success' | 'voice' | 'mqtt';
}

export interface BrokerConfig {
  label: string;
  url: string;
  clientId: string;
  username?: string;
  password?: string;
}

export interface AppState {
  temperature: string;
  humidity: string;
  relays: [boolean, boolean, boolean, boolean];
  variasiMode: number;
}
