import type { INotifier, ReviewNotification, ReviewFailureNotification } from '../../domain/interfaces/notifier.interface.js';
import { logger } from '../logging/logger.js';

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class TelegramNotifier implements INotifier {
  private readonly apiUrl: string;

  constructor(
    botToken: string,
    private readonly chatId: string,
  ) {
    this.apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  }

  async notifyReviewComplete(info: ReviewNotification): Promise<void> {
    const prRef = esc(`${info.repoLabel} #${info.prNumber}`);
    const duration = (info.durationMs / 1000).toFixed(1);
    const lines = [
      `✅ <b>Code Review Complete</b>`,
      ``,
      `📁 ${prRef}`,
      `💬 ${info.commentCount} comment${info.commentCount !== 1 ? 's' : ''} posted`,
      `⏱ ${duration}s`,
    ];
    if (info.prUrl) lines.push(``, `🔗 ${esc(info.prUrl)}`);
    await this.send(lines.join('\n'));
  }

  async notifyReviewFailed(info: ReviewFailureNotification): Promise<void> {
    const prRef = esc(`${info.repoLabel} #${info.prNumber}`);
    const lines = [
      `❌ <b>Code Review Failed</b>`,
      ``,
      `📁 ${prRef}`,
      `⚠️ ${esc(info.errorMessage)}`,
    ];
    await this.send(lines.join('\n'));
  }

  private async send(text: string): Promise<void> {
    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: this.chatId, text, parse_mode: 'HTML' }),
      });
      if (!res.ok) {
        const body = await res.text();
        logger.warn('Telegram notification failed', undefined, { status: res.status, body });
      }
    } catch (err) {
      logger.warn('Telegram notification error', undefined, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
