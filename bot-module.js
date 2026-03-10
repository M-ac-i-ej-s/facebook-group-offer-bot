const puppeteer = require('puppeteer');
const EventEmitter = require('events');

class FacebookGroupBot extends EventEmitter {
  constructor(config) {
    super();
    this.email = config.email;
    this.password = config.password;
    this.groupUrls = config.groupUrls;
    this.keywords = config.keywords;
    this.comment = config.comment;
    this.checkInterval = config.checkInterval || 5 * 60 * 1000;
    this.browser = null;
    this.page = null;
    this.isRunning = false;
  }

  emitBotError(message) {
    this.emit('bot-error', message);
  }

  async findFirstSelector(selectors, timeout = 30000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      for (const selector of selectors) {
        const element = await this.page.$(selector);
        if (element) {
          return selector;
        }
      }
      await this.page.waitForTimeout(250);
    }
    throw new Error(`Could not find any selector: ${selectors.join(', ')}`);
  }

  async findVisibleElement(selectors, timeout = 30000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      for (const selector of selectors) {
        const handle = await this.page.$(selector);
        if (!handle) {
          continue;
        }
        const isVisible = await this.page.evaluate((el) => {
          if (!el) return false;
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return (
            style &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            rect.width > 0 &&
            rect.height > 0
          );
        }, handle);
        if (isVisible) {
          return handle;
        }
      }
      await this.page.waitForTimeout(250);
    }
    throw new Error(`Could not find any visible selector: ${selectors.join(', ')}`);
  }

  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async humanClickElement(elementHandle) {
    const box = await elementHandle.boundingBox();
    if (!box) {
      throw new Error('Element is not clickable (no layout box)');
    }

    const targetX = box.x + box.width / 2 + this.randomBetween(-4, 4);
    const targetY = box.y + box.height / 2 + this.randomBetween(-4, 4);
    const approachX = targetX + this.randomBetween(-80, 80);
    const approachY = targetY + this.randomBetween(-50, 50);

    await this.page.mouse.move(approachX, approachY, { steps: this.randomBetween(18, 30) });
    await this.page.waitForTimeout(this.randomBetween(80, 180));
    await this.page.mouse.move(targetX, targetY, { steps: this.randomBetween(20, 35) });
    await this.page.waitForTimeout(this.randomBetween(100, 260));

    await this.page.mouse.down();
    await this.page.waitForTimeout(this.randomBetween(70, 180));
    await this.page.mouse.up();
  }

  async acceptCookiesIfPresent() {
    await this.page.waitForTimeout(2000);

    const consentSelectors = [
      'button[data-cookiebanner="accept_button"]',
      'button[aria-label="Zezwól na wszystkie pliki cookie"]',
      'button[title="Allow all cookies"]',
      'button[aria-label="Allow all cookies"]',
      'button[title="Accept All"]',
      'button[aria-label="Allow essential and optional cookies"]',
      'div[aria-label="Zezwól na wszystkie pliki cookie"]',
      'div[data-cookiebanner="accept_button"]',
      'div[title="Allow all cookies"]',
      'div[aria-label="Allow all cookies"]',
      'div[title="Accept All"]',
      'div[aria-label="Allow essential and optional cookies"]'
    ];

    for (const selector of consentSelectors) {
      const candidates = await this.page.$$(selector);
      for (const button of candidates) {
        try {
          const isVisible = await this.page.evaluate((el) => {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
          }, button);

          if (!isVisible) {
            continue;
          }

          await this.page.evaluate((el) => {
            el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
          }, button);

          await this.humanClickElement(button);
          await this.page.waitForTimeout(600);
          this.emit('status', `✅ Accepted cookie banner with selector: ${selector}`);
          return true;
        } catch (error) {
          try {
            await button.click({ delay: this.randomBetween(50, 120) });
            await this.page.waitForTimeout(600);
            this.emit('status', `✅ Accepted cookie banner (fallback) with selector: ${selector}`);
            return true;
          } catch (fallbackError) {
            // Try next matching element/selector.
          }
        }
      }
    }

    this.emit('status', 'ℹ️ No cookie banner found or clickable');
    return false;
  }

  async submitLoginForm(passwordInput) {
    const submitSelectors = [
      '#login_form button[name="login"]',
      '#login_form button[type="submit"]',
      '#login_form input[type="submit"]',
      '[data-testid="royal_login_button"]'
    ];

    try {
      const submitButton = await this.findVisibleElement(submitSelectors, 5000);

      await Promise.all([
        this.humanClickElement(submitButton),
        this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 })
      ]);
      return;
    } catch (error) {
      this.emit('status', 'Human click failed, trying Enter key fallback...');
    }

    try {
      await Promise.all([
        passwordInput.press('Enter'),
        this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 })
      ]);
    } catch (error) {
      this.emitBotError(`Enter key fallback also failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize the bot and launch the browser
   */
  async initialize() {
    try {
      this.emit('status', '🚀 Launching browser...');
      
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });

      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1280, height: 720 });
      
      // Block notification permission requests
      const context = this.browser.defaultBrowserContext();
      await context.overridePermissions('https://www.facebook.com', []);
      
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );

      this.emit('status', '✅ Browser initialized');
    } catch (error) {
      this.emitBotError(`Error initializing browser: ${error.message}`);
      throw error;
    }
  }

  /**
   * Log in to Facebook
   */
  async login() {
    const maxAttempts = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.emit('status', `🔐 Logging in to Facebook... (Attempt ${attempt}/${maxAttempts})`);

        await this.page.goto('https://www.facebook.com', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        await this.acceptCookiesIfPresent();
        
        await this.page.goto('https://www.facebook.com/login', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        await this.acceptCookiesIfPresent();
        await this.page.waitForSelector('form#login_form', { timeout: 30000 });

        const emailSelectors = [
          '#login_form input[name="email"]',
          '#login_form input#email',
          '#login_form input[autocomplete="username"]',
          '#login_form input[type="email"]'
        ];

        const passwordSelectors = [
          '#login_form input[name="pass"]',
          '#login_form input#pass',
          '#login_form input[type="password"]',
          '#login_form input[autocomplete="current-password"]'
        ];

        const emailInput = await this.findVisibleElement(emailSelectors, 30000);
        const passwordInput = await this.findVisibleElement(passwordSelectors, 30000);

        // Move mouse to email field naturally
        const emailBox = await emailInput.boundingBox();
        if (emailBox) {
          await this.page.mouse.move(
            emailBox.x + emailBox.width / 2,
            emailBox.y + emailBox.height / 2,
            { steps: 15 }
          );
          await this.page.waitForTimeout(100 + Math.random() * 200);
        }

        // Type directly into the email input to avoid focus-loss issues.
        await emailInput.focus();
        await emailInput.click({ clickCount: 3 });
        await this.page.keyboard.press('Backspace');
        await this.page.waitForTimeout(50 + Math.random() * 100);
        await emailInput.type(this.email, { delay: 50 + Math.random() * 100 });

        // Verify value was entered; if not, force set and trigger input events.
        const typedEmail = await this.page.evaluate((el) => el.value, emailInput);
        if (!typedEmail) {
          await this.page.evaluate((el, value) => {
            el.focus();
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, emailInput, this.email);
        }
        await this.page.waitForTimeout(300 + Math.random() * 500);

        // Move mouse to password field naturally
        const passBox = await passwordInput.boundingBox();
        if (passBox) {
          await this.page.mouse.move(
            passBox.x + passBox.width / 2,
            passBox.y + passBox.height / 2,
            { steps: 15 }
          );
          await this.page.waitForTimeout(100 + Math.random() * 200);
        }

        // Type directly into the password input to avoid focus-loss issues.
        await passwordInput.focus();
        await passwordInput.click({ clickCount: 3 });
        await this.page.keyboard.press('Backspace');
        await this.page.waitForTimeout(50 + Math.random() * 100);
        await passwordInput.type(this.password, { delay: 50 + Math.random() * 100 });

        // Verify value was entered; if not, force set and trigger input events.
        const typedPassword = await this.page.evaluate((el) => el.value, passwordInput);
        if (!typedPassword) {
          await this.page.evaluate((el, value) => {
            el.focus();
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, passwordInput, this.password);
        }

        // Wait before submitting to appear more human-like
        await this.page.waitForTimeout(800 + Math.random() * 1200);

        await this.submitLoginForm(passwordInput);

        await this.page.waitForTimeout(3000);
        const currentUrl = this.page.url();
        
        if (currentUrl.includes('facebook.com/login')) {
          throw new Error('Login failed - redirected back to login page');
        }

        this.emit('status', '✅ Successfully logged in');
        return; // Success - exit the retry loop
      } catch (error) {
        lastError = error;
        this.emitBotError(`Login attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < maxAttempts) {
          this.emit('status', `⏳ Waiting 3 seconds before retry...`);
          await this.page.waitForTimeout(3000);
        }
      }
    }

    // All attempts failed
    this.emitBotError(`All ${maxAttempts} login attempts failed`);
    throw lastError;
  }

  /**
   * Navigate to a specific group
   */
  async navigateToGroup(groupUrl) {
    try {
      this.emit('status', `📍 Navigating to group: ${groupUrl}`);
      
      await this.page.goto(groupUrl, { waitUntil: 'networkidle2' });
      await this.page.waitForTimeout(2000);
      
      this.emit('status', '✅ Group loaded');
      
      // Switch to "Nowe posty" (New Posts) sorting
      await this.switchToNewPostsSorting();
    } catch (error) {
      this.emitBotError(`Error navigating to group: ${error.message}`);
      throw error;
    }
  }

  /**
   * Switch feed sorting from "Najtrafniejsze" to "Nowe posty"
   */
  async switchToNewPostsSorting() {
    try {
      this.emit('status', '🔄 Switching to "Nowe posty" sorting...');
      
      // Try to find and click the sorting dropdown
      const sortingSelectors = [
        '[aria-label="Najtrafniejsze"]',
        'span:has-text("Najtrafniejsze")',
        'div[role="button"]:has-text("Najtrafniejsze")'
      ];
      
      let sortingButton = null;
      for (const selector of sortingSelectors) {
        try {
          // For text-based selectors, use evaluateHandle
          if (selector.includes(':has-text')) {
            const textToFind = selector.includes('Najtrafniejsze') ? 'Najtrafniejsze' : '';
            sortingButton = await this.page.evaluateHandle((text) => {
              const elements = Array.from(document.querySelectorAll('span, div[role="button"]'));
              return elements.find(el => el.textContent.trim().includes(text));
            }, textToFind);
            
            const element = sortingButton.asElement();
            if (element) {
              sortingButton = element;
              break;
            }
          } else {
            sortingButton = await this.page.$(selector);
            if (sortingButton) break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!sortingButton) {
        this.emit('status', '⚠️ Could not find sorting button - may already be on "Nowe posty" or layout changed');
        return;
      }
      
      await sortingButton.click();
      await this.page.waitForTimeout(1000);
      
      // Click on "Nowe posty" option
      const newPostsOption = await this.page.evaluateHandle(() => {
        const elements = Array.from(document.querySelectorAll('span, div[role="menuitem"], div[role="option"]'));
        return elements.find(el => el.textContent.trim().includes('Nowe posty'));
      });
      
      const newPostsElement = newPostsOption.asElement();
      if (newPostsElement) {
        await newPostsElement.click();
        await this.page.waitForTimeout(1500);
        this.emit('status', '✅ Switched to "Nowe posty" sorting');
      } else {
        this.emit('status', '⚠️ Could not find "Nowe posty" option');
      }
    } catch (error) {
      this.emit('status', `⚠️ Could not change sorting (may already be correct): ${error.message}`);
    }
  }

  /**
   * Check if a post contains any of the keywords (case-insensitive)
   */
  containsKeywords(postText) {
    if (!postText) return false;
    const lowerText = postText.toLowerCase();
    return this.keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  /**
   * Get all posts from the current group and filter by keywords
   */
  async getPostsWithKeywords() {
    try {
      this.emit('status', '📋 Scanning top 5 posts for keywords...');
      
      // Scroll to top to ensure we're viewing the latest posts
      await this.page.evaluate(() => window.scrollTo(0, 0));
      await this.page.waitForTimeout(1000);

      // Facebook's DOM changes often, so try multiple feed/article selectors.
      const postSelectors = [
        'div[data-ad-rendering-role="story_message"]',
        'div[role="feed"] div[role="article"]',
        'div[role="article"]',
        'div[data-pagelet*="FeedUnit"]'
      ];

      let postElements = [];
      let usedSelector = null;

      for (const selector of postSelectors) {
        const elements = await this.page.$$(selector);
        if (elements.length > 0) {
          postElements = elements;
          usedSelector = selector;
          break;
        }
      }

      if (!usedSelector) {
        this.emit('status', '⚠️ No post containers found with known selectors');
        return [];
      }

      this.emit('status', `ℹ️ Using post selector: ${usedSelector} (${postElements.length} candidates)`);

      const posts = [];
      const maxPostsToScan = Math.min(5, postElements.length);
      for (let index = 0; index < maxPostsToScan; index++) {
        const element = postElements[index];

        const postData = await this.page.evaluate((el, idx) => {
          const storyMessage = el.matches('div[data-ad-rendering-role="story_message"]')
            ? el
            : el.querySelector('div[data-ad-rendering-role="story_message"]');

          const text = (storyMessage?.innerText || el.innerText || '').replace(/\s+/g, ' ').trim();

          const permalink =
            el.querySelector('a[href*="/posts/"]')?.getAttribute('href') ||
            el.querySelector('a[href*="/permalink/"]')?.getAttribute('href') ||
            '';

          // Generate stable ID: prefer permalink, fallback to content-based identifier
          let rawId;
          if (permalink) {
            // Extract post ID from permalink
            const match = permalink.match(/\/(posts|permalink)\/([^\/\?]+)/);
            rawId = match ? `post_${match[2]}` : permalink;
          } else {
            // Use first 100 chars of text as stable identifier
            const contentId = text.slice(0, 100).replace(/[^a-zA-Z0-9]/g, '_');
            rawId = contentId || `index-${idx}`;
          }

          const rect = el.getBoundingClientRect();

          return {
            id: String(rawId).slice(0, 240),
            text,
            y: rect.top + window.scrollY
          };
        }, element, index);

        if (!postData.text) {
          continue;
        }

        posts.push({
          id: postData.id,
          text: postData.text,
          y: postData.y,
          element
        });
      }

      const matchingPosts = posts.filter((post) => this.containsKeywords(post.text));

      this.emit('status', `✅ Found ${matchingPosts.length} matching posts out of ${posts.length}`);
      return matchingPosts;
    } catch (error) {
      this.emitBotError(`Error getting posts: ${error.message}`);
      return [];
    }
  }

  async refreshPostElement(targetPost) {
    const postSelectors = [
      'div[data-ad-rendering-role="story_message"]',
      'div[role="feed"] div[role="article"]',
      'div[role="article"]',
      'div[data-pagelet*="FeedUnit"]'
    ];

    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const targetPrefix = normalize(targetPost.text).slice(0, 140);
    let bestMatch = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const selector of postSelectors) {
      const elements = await this.page.$$(selector);
      for (let index = 0; index < elements.length; index++) {
        const element = elements[index];
        const probe = await this.page.evaluate((el, idx) => {
          const storyMessage = el.matches('div[data-ad-rendering-role="story_message"]')
            ? el
            : el.querySelector('div[data-ad-rendering-role="story_message"]');

          const text = (storyMessage?.innerText || el.innerText || '').replace(/\s+/g, ' ').trim();
          const permalink =
            el.querySelector('a[href*="/posts/"]')?.getAttribute('href') ||
            el.querySelector('a[href*="/permalink/"]')?.getAttribute('href') ||
            '';

          // Generate stable ID: prefer permalink, fallback to content-based identifier
          let rawId;
          if (permalink) {
            // Extract post ID from permalink
            const match = permalink.match(/\/(posts|permalink)\/([^\/\?]+)/);
            rawId = match ? `post_${match[2]}` : permalink;
          } else {
            // Use first 100 chars of text as stable identifier
            const contentId = text.slice(0, 100).replace(/[^a-zA-Z0-9]/g, '_');
            rawId = contentId || `index-${idx}`;
          }

          const rect = el.getBoundingClientRect();

          return {
            id: String(rawId).slice(0, 240),
            text,
            y: rect.top + window.scrollY
          };
        }, element, index);

        const sameId = probe.id && targetPost.id && probe.id === targetPost.id;
        if (sameId) {
          return element;
        }

        const probePrefix = normalize(probe.text).slice(0, 140);
        const samePrefix =
          targetPrefix.length >= 40 &&
          (probePrefix.startsWith(targetPrefix) || targetPrefix.startsWith(probePrefix));
        const keywordCompatible =
          !this.containsKeywords(targetPost.text || '') ||
          this.containsKeywords(probe.text || '');

        if (samePrefix && keywordCompatible) {
          const yDistance =
            typeof targetPost.y === 'number' && typeof probe.y === 'number'
              ? Math.abs(probe.y - targetPost.y)
              : 0;
          if (yDistance < bestScore) {
            bestScore = yDistance;
            bestMatch = element;
          }
        }
      }
    }

    return bestMatch;
  }

  async refreshGroupPage() {
    try {
      await this.page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
      await this.page.waitForTimeout(1500);
      return true;
    } catch (reloadError) {
      this.emit('status', `⚠️ Page refresh failed, continuing with current view: ${reloadError.message}`);
      return false;
    }
  }

  /**
   * Post a comment on a specific post
   */
  async postComment(post, isFirstPost = false) {
    try {
      this.emit('status', '💬 Attempting to post comment...');
      if (isFirstPost) {
        this.emit('status', '🔵 This is the first post on the page - using first comment field');
      }

      const postElement = await this.refreshPostElement(post) || post.element;
      if (!postElement) {
        this.emit('status', '⚠️ Could not re-locate target post before commenting');
        return false;
      }

      const actionHandle = await this.page.evaluateHandle((el) => {
        return el.closest('div[role="article"]') || el.closest('div[data-pagelet*="FeedUnit"]') || el;
      }, postElement);
      const actionableElement = actionHandle.asElement() || postElement;

      await this.page.evaluate((postEl) => {
        postEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, actionableElement);

      await this.page.waitForTimeout(1000);

      const commentButtonSelectors = [
        '[aria-label="Napisz komentarz publiczny…"]'
      ];

      let openedComposer = false;
      const postBox = await actionableElement.boundingBox();
      
      for (const selector of commentButtonSelectors) {
        this.emit('status', `🔍 Trying selector: ${selector}`);
        
        // Search the entire page for elements
        const allButtons = await this.page.$$(selector);
        this.emit('status', `  Found ${allButtons.length} elements on entire page`);
        
        if (allButtons.length === 0) {
          continue;
        }
        
        // Rank candidates by proximity and prefer the second one.
        const rankedButtons = [];
        
        for (const btn of allButtons) {
          try {
            const btnBox = await btn.boundingBox();
            if (!btnBox) continue;
            
            // Calculate distance from post to button
            // Prioritize buttons below or near the post vertically
            const postBottomY = postBox.y + postBox.height;
            const btnTopY = btnBox.y;
            const btnCenterX = btnBox.x + btnBox.width / 2;
            const verticalDistance = Math.abs(btnTopY - postBottomY);
            const horizontalDistance = Math.abs((postBox.x + postBox.width / 2) - (btnBox.x + btnBox.width / 2));

            // Facebook often renders controls outside post subtree.
            // Keep candidates that are visually aligned with this post.
            const isVerticallyNear = btnTopY >= postBox.y - 120 && btnTopY <= postBottomY + 520;
            const isHorizontallyAligned = btnCenterX >= postBox.x - 120 && btnCenterX <= postBox.x + postBox.width + 120;
            const isBelowPost = btnTopY >= postBottomY - 10;
            if (!isVerticallyNear || !isHorizontallyAligned || !isBelowPost) {
              continue;
            }
            
            // Weight vertical distance more heavily, prefer buttons just below the post
            const distance = verticalDistance * 2 + horizontalDistance;
            
            this.emit('status', `    Button at Y:${btnTopY.toFixed(0)} (post bottom: ${postBottomY.toFixed(0)}, distance: ${distance.toFixed(0)})`);
            
            rankedButtons.push({ btn, distance });
          } catch (e) {
            continue;
          }
        }

        rankedButtons.sort((a, b) => a.distance - b.distance);
        
        // If this is the first post on the page, use the first (closest) button
        // Otherwise, prefer the second button to avoid conflicts
        const selected = isFirstPost 
          ? rankedButtons[0] 
          : (rankedButtons.length >= 2 ? rankedButtons[1] : rankedButtons[0]);

        if (selected?.btn) {
          const buttonChoice = isFirstPost ? 'first (closest)' : (rankedButtons.length >= 2 ? 'second' : 'closest');
          this.emit('status', `  ✅ Selected ${buttonChoice} button (distance: ${selected.distance.toFixed(0)})`);
          try {
            await selected.btn.click({ delay: this.randomBetween(30, 100) });
            this.emit('status', '✅ Clicked comment button, typing comment directly...');
            await this.page.waitForTimeout(1500);
            openedComposer = true;
            break;
          } catch (e) {
            this.emit('status', `  Failed to click: ${e.message}`);
          }
        }
      }

      if (!openedComposer) {
        this.emit('status', '⚠️ Could not find or click comment button');
        return false;
      }

      // Do not search for input field; Facebook usually focuses composer after click.
      await this.page.waitForTimeout(800);
      const commentToType = `${this.comment} `;
      await this.page.keyboard.type(commentToType, { delay: 25 + Math.random() * 45 });
      await this.page.waitForTimeout(700);

      // Submit by pressing Enter while focus is on the comment input
      await this.page.keyboard.press('Enter');
      this.emit('status', 'ℹ️ Pressed Enter to submit comment');

      await this.page.waitForTimeout(2000);
      this.emit('status', '✅ Comment posted successfully');
      this.emit('comment-posted', {
        timestamp: new Date().toISOString(),
        comment: this.comment
      });
      return true;
    } catch (error) {
      this.emitBotError(`Error posting comment: ${error.message}`);
      return false;
    }
  }

  /**
   * Monitor a group for new posts
   */
  async monitorGroup(groupUrl) {
    try {
      await this.navigateToGroup(groupUrl);
      
      let processedPostIds = new Set();

      // Build a startup baseline so existing posts are never commented.
      await this.refreshGroupPage();
      const initialMatchingPosts = await this.getPostsWithKeywords();
      for (const post of initialMatchingPosts) {
        processedPostIds.add(post.id);
      }
      this.emit('status', `🧱 Startup baseline captured: ${processedPostIds.size} existing matching posts will be skipped`);

      while (this.isRunning) {
        this.emit('status', `⏱️  Checking group at ${new Date().toLocaleTimeString()}...`);

        await this.refreshGroupPage();
        
        const maxSequentialCommentsPerCycle = 10;
        let commentedInThisCycle = 0;

        while (this.isRunning && commentedInThisCycle < maxSequentialCommentsPerCycle) {
          const matchingPosts = await this.getPostsWithKeywords();
          const nextPost = matchingPosts.find((post) => !processedPostIds.has(post.id));

          if (!nextPost) {
            if (commentedInThisCycle === 0) {
              this.emit('status', 'ℹ️ No new matching posts in this cycle');
            }
            break;
          }

          this.emit('status', `🎯 Found a matching post! ID: ${nextPost.id}`);

          // Check if this is the first post in the matching posts array
          const isFirstPost = matchingPosts[0]?.id === nextPost.id;
          
          const success = await this.postComment(nextPost, isFirstPost);

          if (success) {
            processedPostIds.add(nextPost.id);
            commentedInThisCycle += 1;
          }

          await this.page.waitForTimeout(1200);
        }

        this.emit('status', `📅 Next check in ${this.checkInterval / 1000} seconds...`);
        
        // Wait with ability to stop
        for (let i = 0; i < this.checkInterval / 1000; i++) {
          if (!this.isRunning) break;
          await this.page.waitForTimeout(1000);
        }
      }
    } catch (error) {
      this.emitBotError(`Error monitoring group: ${error.message}`);
    }
  }

  /**
   * Start the bot
   */
  async start() {
    try {
      this.isRunning = true;
      await this.initialize();
      await this.login();

      if (this.groupUrls.length > 0) {
        await this.monitorGroup(this.groupUrls[0]);
      } else {
        this.emitBotError('No group URLs provided');
      }
    } catch (error) {
      this.emitBotError(`Fatal error: ${error.message}`);
      this.isRunning = false;
    }
  }

  /**
   * Close the browser and cleanup
   */
  async close() {
    this.isRunning = false;
    
    if (this.browser) {
      await this.browser.close();
      this.emit('status', '🛑 Browser closed');
    }
  }
}

module.exports = FacebookGroupBot;
