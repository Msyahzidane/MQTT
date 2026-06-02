import mqtt from 'mqtt';
const client = mqtt.connect('wss://pf-ja6x4lxt1nt3206ohn7w.cedalo.cloud:443/mqtt', {
  clientId: 'ESP_WEB_Cedalo_' + Math.random().toString(16).substr(2, 8),
  clean: true,
  username: 'Web',
  password: 's',
  protocolVersion: 4,
});
client.on('connect', () => { console.log('Cedalo connected!'); process.exit(0); });
client.on('error', (err) => { console.log('Cedalo error:', err.message); process.exit(1); });
setTimeout(() => { console.log('timeout'); process.exit(1); }, 5000);
