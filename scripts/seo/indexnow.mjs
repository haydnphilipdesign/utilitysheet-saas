// Submit changed public pages to IndexNow after a deploy.
//
//   npm run seo:indexnow -- --since 2026-10-21   pages whose sitemap lastmod is on/after the date
//   npm run seo:indexnow -- /pricing /faq        specific pages
//   npm run seo:indexnow                         every page in the live sitemap
//
// Add --dry-run to print the URLs without sending anything.
import {
    INDEXNOW_ENDPOINT,
    INDEXNOW_KEY,
    KEY_LOCATION,
    SITE_ORIGIN,
    assertDateArg,
    buildIndexNowPayload,
    describeIndexNowResponse,
    parseSitemap,
    selectChangedUrls,
} from './indexnow-core.mjs';

function getArgValue(args, name) {
    const index = args.indexOf(name);
    if (index === -1) return null;
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
        throw new Error(`${name} requires a value`);
    }
    return value;
}

function getPositionalArgs(args) {
    const positional = [];
    for (let index = 0; index < args.length; index += 1) {
        if (args[index] === '--since') {
            index += 1;
        } else if (!args[index].startsWith('--')) {
            positional.push(args[index]);
        }
    }
    return positional;
}

async function fetchText(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`GET ${url} returned HTTP ${response.status}`);
    }
    return response.text();
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const sinceArg = getArgValue(args, '--since');
    const since = sinceArg === null ? null : assertDateArg(sinceArg);
    const explicitUrls = getPositionalArgs(args);

    if (since && explicitUrls.length > 0) {
        throw new Error('Pass either --since or a list of URLs, not both');
    }

    let urls = explicitUrls;
    if (urls.length === 0) {
        const entries = parseSitemap(await fetchText(`${SITE_ORIGIN}/sitemap.xml`));
        urls = selectChangedUrls(entries, since);
    }

    const payload = buildIndexNowPayload(urls);
    console.log(`${payload.urlList.length} URL(s):`);
    for (const url of payload.urlList) console.log(`  ${url}`);

    if (dryRun) {
        console.log('Dry run: nothing sent.');
        return;
    }

    const liveKey = (await fetchText(KEY_LOCATION).catch(() => '')).trim();
    if (liveKey !== INDEXNOW_KEY) {
        throw new Error(`The key file is not live at ${KEY_LOCATION}. Deploy first, then retry.`);
    }

    const response = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
    });
    console.log(describeIndexNowResponse(response.status));
    if (response.status !== 200 && response.status !== 202) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
