
// includes
const cmd = require("commander");
const readline = require("readline");
const http = require("http");
const keepalive = require("agentkeepalive");

// define command line parameters
cmd
    .version("0.1.0")
    .option("-u, --url <s>", `The URL (or URLs separated by comma) to contact.`)
    .option("-i, --interval <i>", `The number of milliseconds between each call.`, parseInt)
    .parse(process.argv);

// globals
const interval = cmd.interval || 100;
let success = 0, failure = 0;

// use an HTTP(s) agent with keepalive and connection pooling
const agent = new keepalive({
    maxSockets: 40,
    maxFreeSockets: 10,
    timeout: 60000,
    freeSocketKeepAliveTimeout: 30000
});

// extract a URL into host and port
function fromURL(url) {
    const hostport = url.replace("http://", "");
    const hostport_split = hostport.split(":", 2);
    if (hostport_split.length > 1) {
        return { host: hostport_split[0], port: hostport_split[1] };
    } else {
        return { host: hostport, port: 80 };
    }
}

function update() {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(`success: ${success}, failure: ${failure}`);
}

console.log(`started at ${(new Date()).toISOString()}`);

// query every 1 sec
setInterval(_ => {

    // allow for multiple URLs
    for (const single_url of cmd.url.split(",")) {

        // make the query
        const { host, port } = fromURL(single_url);
        const req = http.get({
            host: host,
            port: port,
            agent: agent
        }, res => {
            if (res.statusCode === 200) {
                success++;
                update();
            } else {
                console.log(`\n${(new Date()).toISOString()} ${single_url}`);
                console.error(new Error(`${res.statusCode}: ${res.statusMessage}`));
                failure++;
                update();
            }
        }).on("error", ex => {
            console.log(`\n${(new Date()).toISOString()} ${single_url}`);
            console.error(ex);
            failure++;
            update();
        });

    }

}, interval);