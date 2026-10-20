const localtunnel = require('localtunnel');
const http = require('http');

const PORT = process.env.PORT || 5000;
let currentTunnel = null;

async function startTunnel() {
  try {
    const tunnel = await localtunnel({
      port: PORT,
      subdomain: 'knotiq-leads'
    });

    currentTunnel = tunnel;
    console.log(`\n======================================================`);
    console.log(`🚀 KNOTIQ RUGS PUBLIC TUNNEL ACTIVE`);
    console.log(`🔗 Public URL: ${tunnel.url}`);
    console.log(`🔑 IP Password (if prompted): 5.107.144.51`);
    console.log(`======================================================\n`);

    tunnel.on('close', () => {
      console.log('⚠️ Tunnel connection closed. Reconnecting in 3s...');
      setTimeout(startTunnel, 3000);
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err.message);
      setTimeout(startTunnel, 3000);
    });
  } catch (err) {
    console.error('Failed to open tunnel, retrying in 3s:', err.message);
    setTimeout(startTunnel, 3000);
  }
}

// Keep-alive ping every 30s to keep the tunnel awake
setInterval(() => {
  if (currentTunnel && currentTunnel.url) {
    http.get(`http://localhost:${PORT}/health`, () => {}).on('error', () => {});
  }
}, 30000);

startTunnel();
