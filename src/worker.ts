import { logger } from './infrastructure/logging/logger.js';
import { QueueWorker } from './infrastructure/queue/worker.js';
import { ProcessReviewUseCase } from './application/use-cases/process-review.use-case.js';
import { GitService } from './infrastructure/git/git.service.js';
import { WorkspaceManager } from './infrastructure/git/workspace.manager.js';
import { createRunner } from './infrastructure/ai/runner.factory.js';
import { promptService } from './application/services/prompt.service.js';
import { parserService } from './application/services/parser.service.js';
import { githubService } from './infrastructure/vcs/github.service.js';
import { gitlabService } from './infrastructure/vcs/gitlab.service.js';
import { TelegramNotifier } from './infrastructure/notifications/telegram.notifier.js';
import { config } from './config/index.js';
import type { JobPayload } from './domain/interfaces/queue.interface.js';

const aiProvider = createRunner(parserService);

const notifier =
  config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_CHAT_ID
    ? new TelegramNotifier(config.TELEGRAM_BOT_TOKEN, config.TELEGRAM_CHAT_ID)
    : undefined;

const useCase = new ProcessReviewUseCase({
  gitService: new GitService(),
  workspaceManager: new WorkspaceManager(),
  aiProvider,
  promptBuilder: promptService,
  outputParser: parserService,
  githubClient: githubService,
  gitlabClient: gitlabService,
  notifier,
});

const worker = new QueueWorker(async (job) => {
  await useCase.execute(job.data as JobPayload);
});

worker.start();

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down worker`);
  try {
    await worker.stop();
    process.exit(0);
  } catch (err) {
    logger.fatal('Worker shutdown error', err instanceof Error ? err : new Error(String(err)));
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
