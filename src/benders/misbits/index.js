import config from '../../config';
import _ from 'lodash';

export default class misbits {
    constructor(browserInstance, {variants, retailerId, destinationAddress}) {
        this.variants = variants;
        this.bro = browserInstance;
        this.retailerId = retailerId;
        this.destinationAddress = destinationAddress;
        this.page = null;
    }

    async start({checkout}) {
        const {variants, bro} = this;
        this.page = await bro.newPage();

        await this.page.setRequestInterceptionEnabled(true);
        this.page.on('request', request => {
            const intercepted = ['image', 'font'];

            if (intercepted.includes(request.resourceType)) {
                request.abort();
            } else {
                request.continue();
            }
        });

        for (const [value, index] of variants.entries()) {
            await this.page.goto(index.shopId);

            const itemIsAvailable = await this.page.evaluate(() => {
                return document.querySelectorAll(`p.stock.in-stock`).length > 0;
            });
            this.variants[value].available = itemIsAvailable;

            if (itemIsAvailable) {
                await this.page.click('button.single_add_to_cart_button');
                await this.page.waitForSelector(`#content > div.woo-wrapper > div > div > div.woocommerce-message`);
            } else {
                const allUnavailable = _.filter(variants, 'available').length === 0;
                const endOfArray = value + 1 === variants.length;

                if (endOfArray && allUnavailable) {
                    return {type: 'all-unavailable', retailerId: this.retailerId, variants};
                }
            }
        }

        await this.page.goto('https://www.misbits.ro/cart/');
        await this.page.waitForSelector(`a.shipping-calculator-button`);
        await this.page.click('a.shipping-calculator-button');
        await this.page.waitForSelector(`#calc_shipping_country`);
        await this.page.select(`#calc_shipping_country`, this.destinationAddress.country.toUpperCase());
        await this.page.type(`#calc_shipping_postcode`, this.destinationAddress.zip);
        await this.page.click(`#post-41 > div > div > div > table > tbody > tr.shipping > td > form > section > p:nth-child(4) > button`);
        await this.page.waitForSelector(`tr.shipping > td > span.amount`);

        const shippingPrice = await this.page.evaluate(() => {
            return document.querySelector(`tr.shipping > td > span.amount`).textContent.replace('lei', '').replace(/\s/g, '');
        });

        if (checkout) {

        } else {
            return {
                type: 'shipping',
                retailerId: this.retailerId,
                shipping: {price: shippingPrice, currency: 'ron'},
                variants
            };
        }
    }
}
