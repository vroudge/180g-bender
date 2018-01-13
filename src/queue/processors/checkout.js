export default (job, ctx, done) => ({
    jobName: 'checkout',
    concurrency: 1,
    processor: async (job, ctx, done) => {
        try {

        } catch (e) {
            logger.err(e);
            return done(e);
        }

        return done();
    },
});
