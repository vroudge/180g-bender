import config from '../../config';
import _ from 'lodash';

export default class Hardwax {
    constructor(browserInstance, {variants, destinationAddress, retailerId}) {
        this.variants = variants;
        this.bro = browserInstance;
        this.retailerId = retailerId;
        this.destinationAddress = destinationAddress;
        this.page = null;
    }

    async start({checkout}) {
        const {variants, bro} = this;
        logger.nfo('Begin hardwax', this.variants);
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
        logger.nfo('before loop');

        for (const [value, index] of variants.entries()) {
            await this.page.goto(index.shopId);

            const itemIsAvailable = await this.page.evaluate(() => {
                return !document.querySelector(`div.add_order.fright`).textContent.includes(`out of stock`);
            });

            this.variants[value].available = itemIsAvailable;

            await this.page.click(`div.add_order.fright`);

            if (!itemIsAvailable) {
                const allUnavailable = _.filter(variants, 'available').length === 0;
                const endOfArray = value + 1 === variants.length;

                if (endOfArray && allUnavailable) {
                    return {type: 'all-unavailable', retailerId: this.retailerId, variants}
                }
            }
        }
        logger.nfo('after loop')
        await this.page.goto(`https://hardwax.com/basket/my-details/`);
        await this.fillShippingInfo();
        await this.page.click(`#submit`);
        await this.page.waitForSelector(`#id_send_order`);

        //wait for stripe iframe to be loaded
        await this.page.waitForSelector(`#id_card_element > div > iframe`);
        const frameName = `__privateStripeFrame3`;
        const frame = await this.waitForFrame(this.page, frameName);
        await this.page.waitForSelector(`#id_shipping_option`);

        const shippingPrice = await this.page.evaluate(() => {
            const listbox = document.querySelector('#id_shipping_option');
            const selIndex = listbox.selectedIndex;
            return listbox.options[selIndex].text.split('€ ')[1];
        });

        if (checkout) {
            await Hardwax.fillPaymentInfo(frame);
            await this.page.click(`#id_accept`);
            await this.page.click(`#id_send_order`);
            return {type: 'checkout', value: 'success'}
        } else {
            return {
                type: 'shipping',
                retailerId: this.retailerId,
                shipping: {price: shippingPrice, currency: 'eur'},
                variants
            };
        }
    }

    async fillShippingInfo() {
        await this.page.waitForSelector([
            '#id_billing_first_name',
            '#id_billing_last_name',
            '#id_billing_company',
            '#id_billing_country',
            '#id_billing_zip',
            '#id_billing_city',
            '#id_billing_address',
            '#id_email',
            '#id_phone',
        ]);

        await this.fillField(`#id_billing_first_name`, config.gram.firstName);
        await this.fillField(`#id_billing_last_name`, config.gram.lastName);
        await this.fillField(`#id_billing_company`, config.gram.companyName);
        await this.fillField(`#id_billing_country`, config.gram.countryCode);
        await this.fillField(`#id_billing_zip`, config.gram.zip);
        await this.fillField(`#id_billing_city`, config.gram.city);
        await this.fillField(`#id_billing_address`, config.gram.address);
        await this.fillField(`#id_email`, config.gram.email);
        await this.fillField(`#id_phone`, config.gram.phone);

        await this.page.click(`#id_same`);
        await this.page.waitFor(500);
        await this.page.waitForSelector([
            `#id_shipping_first_name`,
            `#id_shipping_last_name`,
            `#id_shipping_address`,
            `#id_shipping_zip`,
            `#id_shipping_city`,
            `#id_shipping_country`,
        ]);

        await this.page.type(`#id_shipping_first_name`, this.destinationAddress.first_name);
        await this.page.type(`#id_shipping_last_name`, this.destinationAddress.last_name);
        await this.page.type(`#id_shipping_address`, `${this.destinationAddress.line1} ${this.destinationAddress.line2}`);
        await this.page.type(`#id_shipping_zip`, this.destinationAddress.zip);
        await this.page.type(`#id_shipping_city`, this.destinationAddress.city);
        await this.page.select(`#id_shipping_country`, this.destinationAddress.country.toUpperCase())
    }

    static async fillPaymentInfo(frame) {
        const cbNumberSelector = `#root > form > div > div.CardField-input-wrapper.is-ready-to-slide > span.CardField-number.CardField-child > span:nth-child(2) > label > input`;
        const cbExpirySelector = `#root > form > div > div.CardField-input-wrapper.is-ready-to-slide > span.CardField-expiry.CardField-child > span > label > input`;
        const cbCvvSelector = `#root > form > div > div.CardField-input-wrapper.is-ready-to-slide > span.CardField-cvc.CardField-child > span > label > input`;

        await frame.waitForSelector([cbNumberSelector, cbExpirySelector, cbCvvSelector]);

        const ccNumber = await frame.$(cbNumberSelector);
        const ccExpiry = await frame.$(cbExpirySelector);
        const ccCvv = await frame.$(cbCvvSelector);

        await ccNumber.type(config.finance.ccNumber);
        await ccExpiry.type(config.finance.expiryMonth);
        await ccExpiry.type(config.finance.expiryYearShort);
        await ccCvv.type(config.finance.cvv);
    }

    async waitForFrame(page, frameName) {
        let fulfill;
        const promise = new Promise(x => fulfill = x);
        checkFrame();
        return promise;

        function checkFrame() {
            const frame = page.frames().find(f => f.name() === frameName);
            if (frame)
                fulfill(frame);
            else
                page.once('frameattached', checkFrame);
        }
    }

    async fillField(selector, value) {
        await this.page.$eval(selector, input => input.value = '');
        await this.page.type(selector, value);
    }
}
