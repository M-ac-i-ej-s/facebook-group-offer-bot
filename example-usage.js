/**
 * Example of using the FacebookGroupBot programmatically
 * instead of relying solely on environment variables
 */

const FacebookGroupBot = require('./bot');

// Define your configuration directly
const botConfig = {
  email: 'your_email@facebook.com',
  password: 'your_password',
  groupUrls: [
    'https://www.facebook.com/groups/123456/', // Group 1
    'https://www.facebook.com/groups/789012/', // Group 2
  ],
  keywords: [
    'iphone',
    'phone',
    'smartphone',
    'laptop',
    'computer',
  ],
  comment: 'Thanks for sharing! I\'m very interested in this offer.',
  checkInterval: 5 * 60 * 1000, // 5 minutes in milliseconds
};

// Create and start the bot
const bot = new FacebookGroupBot(botConfig);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down bot...');
  await bot.close();
  process.exit(0);
});

// Start the bot
bot.start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
