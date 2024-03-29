import _ from 'lodash';

import config from '../../config';
import logger from "../../lib/logger";
import countryCodes from './countryCodesMap'

export default class Rushhour {
    constructor(browserInstance, {variants, retailerId, destinationAddress}) {
        this.variants = variants;
        this.bro = browserInstance;
        this.retailerId = retailerId;
        this.destinationAddress = destinationAddress;
        this.page = null;
    }

    async start({checkout}) {
        const logging = [];
        try {
            const {variants, bro} = this;
            this.page = await bro.newPage();
            logger.nfo('Begin Rushhour Bender', this.variants);

            logging.push('before login');
            await this.login();
            logging.push('after login');

            const queriedVariants = await Promise.all(
                _.map(this.variants, (variant, variantId) => this.createPageAndAddToCart(variantId, variant))
            );

            if (_.filter(this.variants, 'available').length === 0) {
                return {type: 'all-unavailable', retailerId: this.retailerId, variants};
            }
            await this.page.close();
            this.page = await this.bro.newPage();

            logging.push('before page checkout');
            await this.page.goto('http://www.rushhour.nl/rh_shoppingcart.php?action=checkout');
            logging.push('after page checkout');
            await this.fillShippingInfo();
            logging.push('after fill shipping');
            await this.page.waitForSelector(`#main-content > form:nth-child(4) > table > tbody > tr:nth-child(18) > td:nth-child(2) > input`);
            logging.push('first selector done');
            await this.page.click('#main-content > form:nth-child(4) > table > tbody > tr:nth-child(18) > td:nth-child(2) > input');
            logging.push('first click done');
            await this.page.waitForSelector(`#shipment > select`);
            logging.push('second selector done');
            const shippingPrice = await this.page.evaluate(() => {
                document.querySelector('#shipment > select').value = 4;
                document.querySelector(`#shipment > select`).onchange();
                const text = document.querySelector('#shipment > select > option:nth-child(2)').textContent;
                return text.split('€ ')[1].split(',')[0]
            });
            logging.push('done eval shipping price');

            logger.nfo('End rushhour bender', this.variants);

            if (checkout) {
                await this.page.waitFor(4000);
                await this.page.waitForSelector(`#shipment > input[type="checkbox"]:nth-child(13)`);
                await this.page.evaluate(() => {
                    document.querySelector('#shipment > input[type="checkbox"]:nth-child(13)').checked = 'checked';
                    document.querySelector('#shipment > input[type="checkbox"]:nth-child(13)').onchange();
                });
                await this.page.waitForSelector(`input.bttn`);
                await this.page.waitFor(4000);


                await this.page.evaluate(() => {
                    document.querySelectorAll(`input.bttn`)[0].click()
                });
                await this.page.waitForSelector([
                    '#Ecom_Payment_Card_Number',
                    '#Ecom_Payment_Card_ExpDate_Month',
                    '#Ecom_Payment_Card_ExpDate_Year',
                    '#Ecom_Payment_Card_Verification'
                ]);
                await this.fillCreditCardInfo();
                if (process.env.NODE_ENV === 'production') {
                    await this.page.click(`#submit3`);
                    await this.page.waitFor(8000);
                }
                await this.page.waitFor(5000);
                await this.page.close();
                return {type: 'checkout', value: 'success'}
            } else {
                logging.push('done');
                await this.page.close();
                return {
                    type: 'shipping',
                    retailerId: this.retailerId,
                    shipping: {price: shippingPrice, currency: 'eur'},
                    variants
                };
            }
        } catch (e) {
            logger.err('Error in rushhour bender', {error:e.message, stack:e.stack, data: logging});
            throw e;
        }
    }
    async createPageAndAddToCart(variantIndex, variant) {
        const page = await this.bro.newPage();

        page.setRequestInterception(true);
        page.on('request', request => {
            if (request.url().endsWith('.png') || request.url().endsWith('.jpg') || request.url().endsWith('.gif'))
                request.abort();
            else
                request.continue();
        });

        const id = variant.shopId.split('item=')[1];
        const addToCart = `http://www.rushhour.nl/store_detailed.php?action=add&item=${id}`;
        await page.goto(addToCart);
        const itemIsAvailable = await page.evaluate(() => {
            return !document.querySelector(`#message`).textContent.includes(`out of stock`);
        });

        this.variants[variantIndex].available = itemIsAvailable;
        await page.close();
        return itemIsAvailable;
    }

    async login() {
        await this.page.goto('http://www.rushhour.nl/login.php');
        await this.page.evaluate((login) => {
            document.querySelector('#main-content > form > table > tbody > tr:nth-child(1) > td:nth-child(2) > input[type="text"]').value = login;
        }, config.accounts.rushhour.login);
        await this.page.evaluate((password) => {
            document.querySelector('input[type="password"]').value = password;
        }, config.accounts.rushhour.password);
        await this.page.click('#main-content > form > table > tbody > tr:nth-child(4) > td > input');
        await this.page.waitFor(2000);
    }

    async fillShippingInfo() {
        await this.fillField(`#main-content > form:nth-child(4) > table > tbody > tr:nth-child(12) > td:nth-child(2) > input`,
            `${this.destinationAddress.last_name} ${this.destinationAddress.first_name}`);
        await this.fillField(`#main-content > form:nth-child(4) > table > tbody > tr:nth-child(13) > td:nth-child(2) > input`,
            `${this.destinationAddress.line1} ${this.destinationAddress.line2}`);
        await this.fillField(`#main-content > form:nth-child(4) > table > tbody > tr:nth-child(15) > td:nth-child(2) > input`,
            this.destinationAddress.city);
        await this.fillField(`#main-content > form:nth-child(4) > table > tbody > tr:nth-child(16) > td:nth-child(2) > input[type="text"]`,
            this.destinationAddress.state);
        await this.fillField(`#main-content > form:nth-child(4) > table > tbody > tr:nth-child(14) > td:nth-child(2) > input`,
            this.destinationAddress.zip);
        await this.page.select('#main-content > form:nth-child(4) > table > tbody > tr:nth-child(17) > td:nth-child(2) > select', countryCodes[this.destinationAddress.country]);
    }

    async fillCreditCardInfo() {
        await this.page.waitFor(2000);
        await this.fillField(`#Ecom_Payment_Card_Number`, config.finance.ccNumber);
        await this.page.select('#Ecom_Payment_Card_ExpDate_Month', config.finance.expiryMonth);
        await this.page.select('#Ecom_Payment_Card_ExpDate_Year', config.finance.expiryYear);
        await this.fillField(`#Ecom_Payment_Card_Verification`, config.finance.cvv);
    }

    async fillField(selector, value) {
        await this.page.waitFor(selector);
        await this.page.$eval(selector, input => input.value = '');
        await this.page.type(selector, value);
    }
}
