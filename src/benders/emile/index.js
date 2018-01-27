import config from '../../config';
import _ from 'lodash';
import emileCountryCodes from './countryCodesMap';

export default class emile {
    constructor(browserInstance, {variants, retailerId, destinationAddress}) {
        this.variants = variants;
        this.bro = browserInstance;
        this.destinationAddress = destinationAddress;
        this.retailerId = retailerId;
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

        logger.nfo('Begin Emile bender', this.variants);

        for (const [value, index] of variants.entries()) {
            await this.page.goto(index.shopId);
            await this.page.waitForSelector(`a.btn.btn-default.button.addToBasket`);

            const itemIsAvailable = await this.page.evaluate(() => {
                return !document.querySelector('a.addToBasket').textContent.includes(`Out of stock`);
            });

            this.variants[value].available = itemIsAvailable;

            if (itemIsAvailable) {
                await this.page.click(`a.btn.btn-default.button.addToBasket`);
                await this.page.waitFor(1000);

            } else {
                const allUnavailable = _.filter(variants, 'available').length === 0;
                const endOfArray = value + 1 === variants.length;

                if (endOfArray && allUnavailable) {
                    return {type: 'all-unavailable', retailerId: this.retailerId, variants}
                }
            }
        }

        await this.page.goto(`https://chezemile-records.com/home`);
        await this.page.waitFor(4000);
        await this.page.select(`select.countrySelect`, emileCountryCodes[this.destinationAddress.country]);

        await this.fillShippingInfos();

        logger.nfo('End Emile bender', this.variants);

        if (checkout) {
            await this.fillPaymentInfo();
            return {type: 'checkout', value: 'success'};
        } else {
            const shippingPrice = await this.page.evaluate(() => {
                return document.querySelector(`#basketView > div:nth-child(3) > div.col-xs-3.pull-right > p`)
                    .textContent.replace('€', '');
            });

            return {
                type: 'shipping',
                retailerId: this.retailerId,
                shipping: {price: shippingPrice, currency: 'eur'},
                variants
            };
        }
    }

    async fillShippingInfos() {
        try {
            await this.page.waitForSelector([
                `#basicUserInfo > div:nth-child(1) > div > input`,
                `#basicUserInfo > div:nth-child(2) > div > input`,
                `#checkoutForm > fieldset > div.control-group > div:nth-child(2) > div:nth-child(2) > div > div > input`,
            ]);

            await this.page.type(`#basicUserInfo > div:nth-child(1) > div > input`, this.destinationAddress.first_name);
            await this.page.type(`#basicUserInfo > div:nth-child(2) > div > input`, this.destinationAddress.last_name);
            await this.page.type(`#checkoutForm > fieldset > div.control-group > div:nth-child(2) > div:nth-child(2) > div > div > input`, config.gram.email);
            await this.page.type(`#addressLine1`, this.destinationAddress.line1);
            await this.page.type(`#addressLine2`, this.destinationAddress.line2);
            await this.page.type(`#city`, this.destinationAddress.city);
            await this.page.type(`#postCode`, this.destinationAddress.zip);
            console.log('9');
        } catch (e) {
            console.log(e);

        }
    }

    async fillPaymentInfo() {
        await this.page.click(`#stripeButton`);

        const frameName = `stripe_checkout_app`;
        const frame = await this.waitForFrame(this.page, frameName);
        await frame.waitForSelector(`input.Fieldset-input.Textbox-control`);

        const emailSelector = `#container > section > span:nth-child(3) > div > div > main > form > div > div > div > div > div > div:nth-child(1) > div.StaggerGroup-child.is-head-0 > div > div > div > fieldset > span > div > div.Textbox-inputRow > input`;
        const cbSelector = `#container > section > span:nth-child(3) > div > div > main > form > div > div > div > div > div > div:nth-child(1) > div.Section-child--padded > fieldset > div:nth-child(1) > div.StaggerGroup-child> span > span:nth-child(1) > div > div.Textbox-inputRow > input`;
        const expirySelector = `#container > section > span:nth-child(3) > div > div > main > form > div > div > div > div > div > div:nth-child(1) > div.Section-child--padded > fieldset > div:nth-child(1) > div.StaggerGroup-child > div.Fieldset-childLeft.u-size1of2.Fieldset-childBottom.Textbox.Textbox--iconLeft.can-setfocus > div.Textbox-inputRow > input`;
        const cvvSelector = `#container > section > span:nth-child(3) > div > div > main > form > div > div > div > div > div > div:nth-child(1) > div.Section-child--padded > fieldset > div:nth-child(1) > div.StaggerGroup-child > div.Fieldset-childRight.u-size1of2.Fieldset-childBottom.Textbox.Textbox--iconLeft > div.Textbox-inputRow > input`;
        const checkoutButtonSelector = `button.Button-animationWrapper-child--primary.Button`;

        const email = await frame.$(emailSelector);
        const cbNumber = await frame.$(cbSelector);
        const expiryDate = await frame.$(expirySelector);
        const cvv = await frame.$(cvvSelector);
        const checkoutButton = await frame.$(checkoutButtonSelector);

        await email.type(config.gram.email);
        await cbNumber.type(config.finance.ccNumber);
        await expiryDate.type(`${config.finance.expiryMonth}${config.finance.expiryYearShort}`);
        await cvv.type(config.finance.cvv);
        await checkoutButton.click();
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
}
