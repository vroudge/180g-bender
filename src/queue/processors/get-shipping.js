import kek from 'puppeteer/node6/ElementHandle'

import puppeteer from 'puppeteer';

import _ from 'lodash';

import * as Benders from '../../benders'
import logger from '../../lib/logger'

export default (job, ctx, done) => ({
    jobName: 'get-shipping',
    concurrency: 1,
    processor: async (job, ctx, done) => {
        let browser, result;
        try {
            const {retailers, cart, destinationAddress} = job.data;
            const orderRaw = cart.content.vinyls;
            logger.nfo('Querying shipping data in retailers', job.data.cart);
            //cleanup cart object for use
            const order = _.map(orderRaw, (elem, key) => {
                const retailerForVariant = _.find(retailers, retailer => retailer.id === elem.retailerId).name;

                if (!retailerForVariant) {
                    throw new Error('UNSUPPORTED_RETAILER');
                }

                elem.variantId = key;
                elem.retailer = retailerForVariant;

                return elem;
            });

            logger.nfo('Clean order', order);
            const variants = _.reduce(order, (acc, elem) => {
                const {variantId, shopId} = elem;

                if (!acc[elem.retailer]) {
                    acc[elem.retailer] = {arr: [], retailerId: elem.retailerId};
                }

                for (let quantity of _.range(elem.quantity)) {
                    acc[elem.retailer].arr.push({variantId, shopId});
                }

                return acc;
            }, {});

            if (process.env.NODE_ENV === 'production') {
                browser = await puppeteer.launch({
                    headless: true,
                    ignoreHTTPSErrors: true,
                    executablePath: '/usr/bin/chromium-browser',
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
                });
            } else {
                browser = await puppeteer.launch({
                    headless: false,
                    ignoreHTTPSErrors: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
                });
            }

            logger.nfo('Browser takeoff', !!browser);
            result = await Promise.all(
                _.map(variants, async (elem, key) => {
                    return (await new Benders[key](browser, {
                        variants: elem.arr,
                        destinationAddress,
                        retailerId: elem.retailerId
                    })).start({checkout: false});
                })
            );
            await browser.close();
        } catch (e) {
            if (browser) await browser.close();
            logger.err(`Error in get-shipping`, {...e, stack: e.stack});
            return done(e);
        }
        return done(null, JSON.stringify(result));
    },
});
