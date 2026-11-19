// The sites `/run` may fetch (plan step 3), so it can't be used to fetch anything for anyone: to
// start, void-fbtee's example, the first user (plan, "The idea").
export const ALLOWED_HOSTS = new Set(["void-fbtee-example.gedw99.workers.dev"]);
