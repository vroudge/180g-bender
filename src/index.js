import { getOrCreateQueue, attachQueueProcessors } from './queue/utils'
import logger from './lib/logger'

(async () => {
    try {
        const queue = await getOrCreateQueue();
        queue && logger.log('Queue created');

        const queueWithProcessors = await attachQueueProcessors(queue);
        queueWithProcessors && logger.log('Processors attached. Ready!');
    } catch (e) {
        logger.err('error in bender main', e);
    }
})();
