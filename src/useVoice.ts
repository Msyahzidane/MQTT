import { useState, useCallback, useRef } from 'react';

// Handle TypeScript definitions for Speech API
const SpeechRecognition = typeof window !== 'undefined'
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null;

export function useVoiceCommand(onCommandParsed: (command: string, transcript: string) => void, onLog: (msg: string, type: 'voice' | 'error') => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const initRecognition = useCallback(() => {
    if (!SpeechRecognition) {
      onLog('Browser tidak mendukung Web Speech API (suara). Gunakan Chrome/Edge desktop.', 'error');
      return null;
    }
    
    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        onLog('Mendengarkan perintah suara...', 'voice');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        onLog(`Dikenali: "${transcript}"`, 'voice');
        parseCommand(transcript);
      };

      recognition.onerror = (event: any) => {
        onLog(`Error pendengaran: ${event.error}`, 'error');
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
    return recognitionRef.current;
  }, [onLog]);

  const startListening = useCallback(async () => {
    // Meminta izin mikrofon secara eksplisit jika belum
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (err: any) {
      onLog(`Izin mikrofon ditolak: ${err.message}`, 'error');
      return;
    }

    const recognition = initRecognition();
    if (recognition) {
      try {
        recognition.start();
      } catch (err: any) {
        if (err.name === 'InvalidStateError') {
          // Already started, ignore
        } else {
          console.error(err);
          onLog(`Error start recognition: ${err.message}`, 'error');
        }
      }
    }
  }, [initRecognition, onLog]);

  const parseCommand = (transcript: string) => {
    // 1. Suhu & Kelembaban
    if (transcript.includes('suhu')) {
      onCommandParsed('TANYA_SUHU', transcript);
    } else if (transcript.includes('kelembapan') || transcript.includes('kelembaban') || transcript.includes('lembab')) {
      onCommandParsed('TANYA_KELEMBABAN', transcript);
    } 
    // 2. Relay
    else if (transcript.includes('nyalakan') || transcript.includes('hidupkan')) {
      if (transcript.includes('satu') || transcript.includes('1')) onCommandParsed('R1_ON', transcript);
      else if (transcript.includes('dua') || transcript.includes('2')) onCommandParsed('R2_ON', transcript);
      else if (transcript.includes('tiga') || transcript.includes('3')) onCommandParsed('R3_ON', transcript);
      else if (transcript.includes('empat') || transcript.includes('4')) onCommandParsed('R4_ON', transcript);
      else if (transcript.includes('semua')) onCommandParsed('ALL_ON', transcript);
    } 
    else if (transcript.includes('matikan') || transcript.includes('padamkan')) {
      if (transcript.includes('satu') || transcript.includes('1')) onCommandParsed('R1_OFF', transcript);
      else if (transcript.includes('dua') || transcript.includes('2')) onCommandParsed('R2_OFF', transcript);
      else if (transcript.includes('tiga') || transcript.includes('3')) onCommandParsed('R3_OFF', transcript);
      else if (transcript.includes('empat') || transcript.includes('4')) onCommandParsed('R4_OFF', transcript);
      else if (transcript.includes('semua')) onCommandParsed('ALL_OFF', transcript);
    }
    // 3. Variasi
    else if (transcript.includes('variasi')) {
      if (transcript.includes('satu') || transcript.includes('1')) onCommandParsed('VAR_1', transcript);
      else if (transcript.includes('dua') || transcript.includes('2')) onCommandParsed('VAR_2', transcript);
      else if (transcript.includes('stop') || transcript.includes('berhenti')) onCommandParsed('VAR_STOP', transcript);
    } else {
      onLog('Perintah tidak dikenali.', 'error');
    }
  };

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    window.speechSynthesis.speak(utterance);
    onLog(`TTS: "${text}"`, 'voice');
  }, [onLog]);

  return { isListening, startListening, speak, supported: !!SpeechRecognition };
}
