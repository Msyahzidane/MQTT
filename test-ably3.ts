import mqtt from 'mqtt';
const client = mqtt.connect('wss://mqtt.ably.io', {
  clientId: 'ESP_WEB_Ably_' + Math.random().toString(16).substr(2, 8),
  username: 'ZyRtEA.EIl0MA',
  password: 'jN4OHGaVHf2rbXzVYZGSmdfwWQJq7LBrvmP1H_0xkVM',
});
client.on('connect', () => { console.log('Ably connected!'); process.exit(0); });
client.on('error', (err) => { console.log('Ably error:', err.message); process.exit(1); });
setTimeout(() => { console.log('timeout'); process.exit(1); }, 5000);
