import { test, expect } from '@playwright/test';

test.describe('AI Orb & Mindful Chat Flows', () => {
  const TEST_EMAIL = 'test-user@example.com';
  const TEST_PASSWORD = 'password123';

  test('should render the levitating morphing AI Orb on the landing page', async ({ page }) => {
    await page.goto('/');
    
    // Verify AnyenOrb is present on landing page
    const orb = page.locator('.animate-liquid-flow');
    await expect(orb).toBeVisible();
    
    // Verify glassmorphism classes on the orb container
    await expect(orb).toHaveClass(/bg-white\/40/);
    await expect(orb).toHaveClass(/backdrop-blur-md/);
  });

  test('should open AI assistant and log expense via mindful chat', async ({ page }) => {
    // 1. Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    // 2. Mock the secure BFF Chat API Route to prevent hitting external Groq API
    await page.route('**/api/chat', async route => {
      // Introduce 500ms artificial delay to reliably test the UI "Thinking..." loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reply: "Got it! I've allocated C$6.50 for Matcha Tea ☕ under Dining Out. Mindful choice!",
          expense: {
            id: 'exp-mock-99',
            item: 'Matcha Tea',
            amount: 6.50, // CAD base
            original_amount: 6.50,
            original_currency: 'CAD',
            currency: 'CAD',
            category_id: 'cat-1', 
            date: '2026-05-10',
            categories: { name: 'Dining Out' }
          }
        }),
      });
    });

    // 3. Open Chat Modal using the Chat FAB
    await page.click('#action-elem-8'); // Chat FAB
    
    const chatModal = page.locator('.chat-modal-content');
    await expect(chatModal).toBeVisible();
    await expect(chatModal).toHaveClass(/bg-white\/40/); // Glassmorphism card check

    // 4. Send expense request
    const chatInput = page.locator('#chat-input');
    await chatInput.fill('I spent 6.50 on Matcha Tea');
    
    // Trigger send (click button or press enter)
    await page.click('#send-chat-btn');

    // 5. Assert Optimistic UI update (user message is added instantly)
    await expect(page.locator('.chat-message', { hasText: 'I spent 6.50 on Matcha Tea' })).toBeVisible();
    await expect(page.locator('.chat-message', { hasText: 'Thinking...' })).toBeVisible();

    // 6. Verify Mocked AI response with empathetic confirmation
    const aiMessage = page.locator('.chat-message', { hasText: "Got it! I've allocated C$6.50 for Matcha Tea" });
    await expect(aiMessage).toBeVisible();
    await expect(page.locator('.chat-message', { hasText: 'Thinking...' })).not.toBeVisible();

    // 7. Close Chat Modal
    await page.click('.close-btn'); // Close button inside modal
    await expect(chatModal).not.toBeVisible();

    // 8. Verify local list is updated automatically with the logged item from chat
    await page.click('#action-elem-2'); // Recent Tab
    const loggedItem = page.locator('.expense-item', { hasText: 'Matcha Tea' });
    await expect(loggedItem).toBeVisible();
    await expect(loggedItem.locator('.expense-amount')).toContainText('C$6.50');
  });
});
