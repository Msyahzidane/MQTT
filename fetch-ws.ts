fetch('https://mqtt.ably.io', {headers: {Connection: 'Upgrade', Upgrade: 'websocket'}}).then(r => console.log(r.status, r.statusText, r.headers)).catch(console.error);
