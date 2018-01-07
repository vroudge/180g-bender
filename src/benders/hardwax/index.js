import config from '../../config';

export default class Hardwax {
    constructor(browserInstance, {variants, destinationAddress}) {
        this.variants = variants;
        this.bro = browserInstance;

        this.destinationAddress = destinationAddress;
        this.page = null;
    }

    async start({checkout}) {
        const {variants, bro} = this;

        this.page = await bro.newPage();
        try {
            for (const variant of variants) {
                const variantUrl = `https://hardwax.com/basket/add/${variant.split(`/`)[3]}/`;
                console.log(`hardwax open ${variantUrl}`);

                await this.page.goto(variantUrl);
            }
            await this.page.goto(`https://hardwax.com/basket/my-details/`);
            await this.fillShippingInfo();
            await this.page.click(`#submit`);
            await this.page.waitForSelector(`#id_send_order`);

            //wait for stripe iframe to be loaded
            await this.page.waitForSelector(`#id_card_element > div > iframe`);
            const frameName = `__privateStripeFrame3`;
            const frame = await this.waitForFrame(this.page, frameName);
            await this.page.waitForSelector(`#id_shipping_option`);

            const shippingPriceRaw = await this.page.evaluate(() => {
                const listbox = document.querySelector('#id_shipping_option');
                const selIndex = listbox.selectedIndex;
                return listbox.options[selIndex].text;
            });

            if (checkout) {
                await Hardwax.fillPaymentInfo(frame);
                await this.page.click(`#id_accept`);
                await this.page.click(`#id_send_order`);
                return {type: 'checkout', value: 'success'}
            } else {
                return {type: 'shipping', value: shippingPriceRaw};
            }
        } catch (e) {
            throw new Error(e);
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
        await this.page.select(`#id_shipping_country`, `GB`)
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
        console.log('OK');
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
