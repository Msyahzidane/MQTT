import mqtt from 'mqtt';
const client = mqtt.connect('wss://mqtt.ably.io:443/mqtt', {
  clientId: 'ESP_WEB_Ably_' + Math.random().toString(16).substr(2, 8),
  clean: true,
  username: 'ZyRtEA.EIl0MA',
  password: 'jN4OHGaVHf2rbXzVYZGSmdfwWQJq7LBrvmP1H_0xkVM',
  protocolVersion: 4,
});
client.on('connect', () => { console.log('connected!'); process.exit(0); });
client.on('error', (err) => { console.log('error:', err.message); process.exit(1); });
setTimeout(() => { console.log('timeout'); process.exit(1); }, 5000);
