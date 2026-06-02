import mqtt from 'mqtt';
const client = mqtt.connect('wss://kingfisher.lmq.cloudamqp.com:443/mqtt', {
  clientId: 'ESP_WEB_AMQP_' + Math.random().toString(16).substr(2, 8),
  clean: true,
  username: 'jkhntckb:jkhntckb',
  password: 'kvIQg8q622zZOqLhpTgo_v5M0nB8orRa',
  protocolVersion: 4,
});
client.on('connect', () => { console.log('AMQP connected!'); process.exit(0); });
client.on('error', (err) => { console.log('AMQP error:', err.message); process.exit(1); });
setTimeout(() => { console.log('timeout'); process.exit(1); }, 5000);
