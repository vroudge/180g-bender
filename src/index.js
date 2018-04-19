import {getOrCreateQueue, attachQueueProcessors} from './queue/utils'
import logger from './lib/logger'

(async () => {
    process.on('uncaughtException', (error) => {
        logger.err('Bender - uncaught reject', {message: error.message, stack: error.stack});
        process.exit(1);
    });
    process.on('unhandledRejection', (reason, promise) => {
        logger.err('Bender - unhandled rejection', {reason, promise})
        process.exit(1);
    });
    try {
        const queue = await getOrCreateQueue();
        queue && logger.log('Queue created');

        const queueWithProcessors = await attachQueueProcessors(queue);
        queueWithProcessors && logger.log('Processors attached. Ready!');
    } catch (e) {
        logger.err('error in bender main', e);
        throw e;
    }
})();
