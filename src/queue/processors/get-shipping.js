import puppeteer from 'puppeteer';
import shortUid from 'short-uid';
import _ from 'lodash';
import rimraf from 'rimraf';

import * as Benders from '../../benders'
import logger from '../../lib/logger'

export default (job, ctx, done) => ({
    jobName: 'get-shipping',
    concurrency: 1,
    processor: async (job, ctx, done) => {
        let browser, result;
        try {
            const {retailers, cart, destinationAddress, jobId} = job.data;
            const orderRaw = cart.content.vinyls;
            logger.nfo(' 1 - Querying shipping data in retailers', job.data.cart);
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

            logger.nfo('2 - Clean order', order);
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

            const idGen = new shortUid().randomUUID();
            const userDataFlag = `/tmp/pup-${idGen}`;

            if (process.env.NODE_ENV === 'production') {
                const prodArgs = [`--user-data-dir=${userDataFlag}`,
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36',
                ];
                //use proxy for sideone
                if (variants['sideone']) {
                    prodArgs.push(`--proxy-server=34.249.225.224:27631`)
                }

                browser = await puppeteer.launch({
                    headless: true,
                    ignoreHTTPSErrors: true,
                    args: prodArgs
                });
            } else {
                const devArgs = [`--user-data-dir=${userDataFlag}`,
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36',
                ];
                //use proxy for sideone
                if (variants['sideone']) {
                    devArgs.push(`--proxy-server=34.249.225.224:27631`)
                }
                browser = await puppeteer.launch({
                    headless: true,
                    ignoreHTTPSErrors: true,
                    args: devArgs
                });
            }

            logger.nfo(' 3 - Browser takeoff', !!browser);
            result = await Promise.all(
                _.map(variants, async (elem, key) => {
                    return (await new Benders[key](browser, {
                        variants: elem.arr,
                        destinationAddress,
                        retailerId: elem.retailerId
                    })).start({checkout: false});
                })
            );
            logger.nfo(' 4 - Bender done');

            await new Promise(function (resolve, reject) {
                rimraf(userDataFlag, (err, res) => {
                    if (err) reject(err);
                    return resolve();
                });
            });
            logger.nfo(` 5 - Done cleanup`);
            await browser.close();
        } catch (e) {
            if (browser) await browser.close();
            logger.err(`4 - Error in get-shipping`, {...e, stack: e.stack});
            return done(e);
        }
        return done(null, JSON.stringify(result));
    },
});
