import puppeteer from 'puppeteer';
import { getOrCreateQueue, attachQueueProcessors } from './queue/utils'
import * as Benders from './benders'
import logger from './lib/logger'

const destinationAddress = {
    first_name: 'Valentin',
    last_name: 'Roudge',
    line1: '54 Rue Merlin',
    line2: '4eme gauche',
    city: 'Paris',
    state: 'IDF',
    zip: '75011',
    country: 'fr'
};

(async () => {
    try {
        const queue = await getOrCreateQueue();
        queue && logger.log('Bender - Queue created');

        const queueWithProcessors = await attachQueueProcessors(queue);
        queueWithProcessors && logger.log('Bender - Processors attached. Ready!');
    } catch (e) {
        logger.err('error in bender main', e);
    }
})();
