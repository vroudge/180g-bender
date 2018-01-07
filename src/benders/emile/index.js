import config from '../../config';

export default class emile {
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
                await this.page.goto(variant);
                await this.page.waitForSelector(`a.btn.btn-default.button.addToBasket`);
                await this.page.click(`a.btn.btn-default.button.addToBasket`);
                await this.page.waitFor(1000);
            }

            await this.page.goto(`https://chezemile-records.com/home`);
            await this.fillShippingInfos();

            const shippingPriceRaw = await this.page.evaluate(() => {
                return document.querySelector(`#basketView > div:nth-child(3) > div.col-xs-3.pull-right > p`).textContent;
            });

            if (checkout) {
                await this.fillPaymentInfo();
                return {type: 'checkout', value:'success'};
            } else {
                return {type: 'shipping', value: 'success'};
            }
        } catch (e) {
            throw new Error(e);
        }
    }

    async fillShippingInfos() {
        await this.page.click(`#homeRight > div > form:nth-child(2) > div > label:nth-child(2) > input`);
        await this.page.waitForSelector(`#basketView > div:nth-child(3) > div.col-xs-3.pull-right > p`);
        await this.page.select(`#checkoutForm > fieldset > div:nth-child(2) > div > div > select`, 'France');
        await this.page.waitFor(2000);

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
        await this.page.type(`#checkoutForm > fieldset > div:nth-child(5) > div:nth-child(2) > div > div > input`, this.destinationAddress.state);
        await this.page.type(`#postCode`, this.destinationAddress.zip);
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
