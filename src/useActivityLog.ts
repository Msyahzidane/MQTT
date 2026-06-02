import { useState, useCallback } from 'react';
import { LogEntry } from './types';

export function useActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs((prev) => [
      {
        id: Math.random().toString(36).substr(2, 9),
        time: new Date(),
        message,
        type,
      },
      ...prev,
    ].slice(0, 100)); // Keep last 100 logs
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, addLog, clearLogs };
}
