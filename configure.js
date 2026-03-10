#!/usr/bin/env node

/**
 * Interactive Bot Configuration Builder
 * Run: node configure.js
 * 
 * This script helps you set up your .env file interactively
 */

const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const questions = [
  {
    key: 'FB_EMAIL',
    prompt: 'Enter your Facebook email: ',
  },
  {
    key: 'FB_PASSWORD',
    prompt: 'Enter your Facebook password: ',
    hidden: true,
  },
  {
    key: 'FB_GROUP_URL_1',
    prompt: 'Enter the first group URL (e.g., https://www.facebook.com/groups/123456/): ',
  },
  {
    key: 'FB_GROUP_URL_2',
    prompt: 'Enter second group URL (optional, press Enter to skip): ',
  },
  {
    key: 'FB_KEYWORDS',
    prompt: 'Enter keywords to search for (comma-separated, e.g., iphone,laptop,offer): ',
  },
  {
    key: 'FB_COMMENT',
    prompt: 'Enter the comment to post on matching posts: ',
  },
  {
    key: 'CHECK_INTERVAL',
    prompt: 'Enter check interval in milliseconds (default: 300000 = 5 minutes): ',
    default: '300000',
  },
];

const config = {};
let questionIndex = 0;

function askQuestion(index) {
  if (index >= questions.length) {
    generateEnvFile();
    return;
  }

  const question = questions[index];
  const prompt = question.prompt;

  if (question.hidden) {
    // For password input
    rl.question(prompt, (answer) => {
      config[question.key] = answer;
      askQuestion(index + 1);
    });
  } else {
    rl.question(prompt, (answer) => {
      config[question.key] = answer || question.default || '';
      askQuestion(index + 1);
    });
  }
}

function generateEnvFile() {
  // Build the .env content
  let envContent = `# Facebook credentials\n`;
  envContent += `FB_EMAIL=${config.FB_EMAIL}\n`;
  envContent += `FB_PASSWORD=${config.FB_PASSWORD}\n\n`;

  envContent += `# Facebook group URLs\n`;
  envContent += `FB_GROUP_URL_1=${config.FB_GROUP_URL_1}\n`;
  
  if (config.FB_GROUP_URL_2) {
    envContent += `FB_GROUP_URL_2=${config.FB_GROUP_URL_2}\n`;
  }

  envContent += `\n# Keywords to search for (comma-separated, case-insensitive)\n`;
  envContent += `FB_KEYWORDS=${config.FB_KEYWORDS}\n\n`;

  envContent += `# Comment to post when keywords are found\n`;
  envContent += `FB_COMMENT=${config.FB_COMMENT}\n\n`;

  envContent += `# Check interval in milliseconds (default: 300000 = 5 minutes)\n`;
  envContent += `CHECK_INTERVAL=${config.CHECK_INTERVAL}\n`;

  // Check if .env already exists
  if (fs.existsSync('.env')) {
    rl.question('\n⚠️  .env file already exists. Overwrite? (yes/no): ', (answer) => {
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        fs.writeFileSync('.env', envContent);
        console.log('\n✅ .env file created successfully!');
        console.log('\n📝 Your configuration:');
        console.log(envContent);
        rl.close();
      } else {
        console.log('\n❌ Cancelled. Your .env file was not modified.');
        rl.close();
      }
    });
  } else {
    fs.writeFileSync('.env', envContent);
    console.log('\n✅ .env file created successfully!');
    console.log('\n📝 Your configuration:');
    console.log(envContent);
    console.log('\n🚀 You can now run: npm start');
    rl.close();
  }
}

// Start the interactive configuration
console.log('\n🤖 Facebook Group Offer Bot - Configuration Builder\n');
console.log('This tool will help you create a .env configuration file.\n');

askQuestion(0);
