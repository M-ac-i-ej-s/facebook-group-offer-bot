# Facebook Group Offer Bot

A Node.js bot that automatically monitors Facebook groups for specific keywords in posts and posts predetermined comments.

## Features

- 🔐 Automated Facebook login
- 👁️ Real-time monitoring of Facebook groups
- 🔍 Intelligent keyword detection (case-insensitive)
- 💬 Automatic comment posting
- ⏱️ Configurable check intervals
- 📱 Handles multiple groups
- 🛡️ Error handling and recovery

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A Facebook account
- Group URLs to monitor

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd facebook-group-offer-bot
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

4. Update `.env` with your credentials:

```
FB_EMAIL=your_email@facebook.com
FB_PASSWORD=your_password
FB_GROUP_URL_1=https://www.facebook.com/groups/your_group_id/
FB_GROUP_URL_2=https://www.facebook.com/groups/another_group_id/
FB_KEYWORDS=laptop,phone,sale
FB_COMMENT=Thanks for sharing! Interested in this.
CHECK_INTERVAL=300000
```

## Configuration

### Required Environment Variables

| Variable         | Description                              | Example                                   |
| ---------------- | ---------------------------------------- | ----------------------------------------- |
| `FB_EMAIL`       | Your Facebook email                      | `user@example.com`                        |
| `FB_PASSWORD`    | Your Facebook password                   | `mypassword123`                           |
| `FB_GROUP_URL_1` | First group URL to monitor               | `https://www.facebook.com/groups/123456/` |
| `FB_KEYWORDS`    | Keywords to search for (comma-separated) | `iphone,laptop,gadget`                    |
| `FB_COMMENT`     | Comment to post when keywords found      | `Great offer!`                            |

### Optional Environment Variables

| Variable                                 | Description                            | Default              |
| ---------------------------------------- | -------------------------------------- | -------------------- |
| `FB_GROUP_URL_2`, `FB_GROUP_URL_3`, etc. | Additional groups to monitor           | None                 |
| `CHECK_INTERVAL`                         | Interval between checks (milliseconds) | `300000` (5 minutes) |

## Usage

### Basic Usage

Start the bot with:

```bash
npm start
```

### Development Mode (with auto-reload)

```bash
npm run dev
```

This requires `nodemon` to be installed (included in devDependencies).

## How It Works

1. **Initialization**: Launches a Puppeteer browser instance
2. **Login**: Authenticates with Facebook using provided credentials
3. **Monitoring**:
   - Navigates to each group
   - Scrolls through posts to load content
   - Extracts post text and IDs
   - Filters posts containing any of the specified keywords (case-insensitive)
4. **Action**: Posts the configured comment on matching posts
5. **Interval**: Waits for the specified interval before checking again

## Keyword Configuration

Keywords are case-insensitive and support partial matching. For example:

- If you specify `phone`, it will match: "iPhone", "PHONE", "smartphone", "cellphone"
- Multiple keywords: `laptop,phone,tablet` will match any post containing any of these words

## Comment Examples

```env
FB_COMMENT=Hey, I'm interested! Can you send more details?
```

```env
FB_COMMENT=Thanks for posting! What's the lowest price?
```

## Important Notes

⚠️ **Legal & Ethical Considerations:**

- Always respect Facebook's Terms of Service
- Automated bots may violate Facebook's ToS
- Use responsibly and only on groups where you have permission
- Facebook actively detects and blocks suspicious bot behavior

⚠️ **Best Practices:**

- Use realistic check intervals (5-15 minutes recommended)
- Don't post identical comments too frequently
- Keep credentials secure and never commit `.env` to version control
- Use a `.gitignore` to exclude `.env` files

⚠️ **Security:**

- Never share your credentials
- Use a secondary Facebook account if possible
- Be aware that Facebook may lock your account for suspicious activity
- Consider using a VPN if accessing from multiple locations

## Troubleshooting

### Login Fails

- Verify email and password are correct in `.env`
- Check if Facebook account has 2FA enabled (may cause issues)
- Try adding a delay before automated login

### Posts Not Detected

- Verify group URLs are correct and public
- Check keyword spelling
- Ensure you're a member of the group
- Headless mode is always enabled in this build (no visible browser window)

### Comments Not Posting

- Verify the comment matches group rules
- Check if you have permission to comment in the group
- Facebook may rate-limit automated comments

## Advanced Configuration

### Multiple Groups

Add more group URLs to `.env`:

```env
FB_GROUP_URL_1=https://www.facebook.com/groups/group1/
FB_GROUP_URL_2=https://www.facebook.com/groups/group2/
FB_GROUP_URL_3=https://www.facebook.com/groups/group3/
```

The bot will monitor the first group. To monitor multiple groups simultaneously, extend the code in `bot.js` to use Promise.all() or create multiple bot instances.

### Headless Mode

Headless mode is always enabled and cannot be changed via configuration.

## API Reference

### FacebookGroupBot Class

#### Constructor

```javascript
new FacebookGroupBot(config);
```

**Config Object:**

- `email` (string): Facebook email
- `password` (string): Facebook password
- `groupUrls` (array): Group URLs to monitor
- `keywords` (array): Keywords to search for
- `comment` (string): Comment to post
- `checkInterval` (number): Interval in milliseconds

#### Methods

- `initialize()`: Launch browser and page
- `login()`: Authenticate with Facebook
- `navigateToGroup(url)`: Go to a group
- `getPostsWithKeywords()`: Find matching posts
- `postComment(postElement)`: Post comment on a post
- `monitorGroup(url)`: Main monitoring loop
- `start()`: Start the bot
- `close()`: Cleanup and close browser

## Limitations

- Facebook actively blocks automation; your account may be flagged
- Comment posting may fail due to rate limiting
- Complex page dynamics may require additional selectors
- 2FA-enabled accounts may cause login issues
- Headless mode may trigger additional Facebook verification checks in some sessions

MIT License - see LICENSE file for details

## Disclaimer

This tool is for educational purposes. Users are responsible for:

- Complying with Facebook's Terms of Service
- Respecting local laws and regulations
- Using the bot responsibly and ethically
- Account security and potential consequences of automation

The authors are not responsible for account suspensions, bans, or any other consequences resulting from using this bot.
