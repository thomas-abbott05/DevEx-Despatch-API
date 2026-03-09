// Entry point for the API server - run: npm run start
// DevEx Team, SENG2021 2026T1

const DevExServer = require('./src/server/server');

async function main() {
  const server = new DevExServer();
  
  try {
    await server.initialise();
    server.start();
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully');
      await server.stop();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down gracefully');
      await server.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();