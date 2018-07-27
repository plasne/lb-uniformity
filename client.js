
// includes
const cmd = require("commander");
const http = require("http");
const readline = require("readline");
const keepalive = require('agentkeepalive');

// define command line parameters
cmd
    .version("0.1.0")
    .option("-u, --url <s>", `[REQUIRED] URL. The URL to contact.`)
    .option("-i, --interval <i>", `INTERVAL. The number of milliseconds between each call. Defaults to "100" ms.`, parseInt)
    .option("-e, --ephemeral-port <i>", `EPHEMERAL_PORT. Start at this port number and increment.`, parseInt)
    .option("-z, --increment <i>", `INCREMENT. When using a specified ephemeral port, increment by this number. Defaults to "1".`, parseInt)
    .option("-g, --gap <i>", `GAP. The minimum number of milliseconds between requests to a specific node to be considered an abnormal gap. Defaults to "10 x INTERVAL" ms.`, parseInt)
    .option("-r, --random", `Picks a random port each time.`)
    .option("-s, --summary", `Shows the summary not the outbound ports.`)
    .on("--help", () => {
        console.log("");
        console.log("The client will send a request to the URL every INTERVAL ms using ephmeral ports assigned by the host operating system. Alternatively, you can specify a specific EPHEMERAL_PORT and an amount to INCREMENT it with each call, or you can specify to use RANDOM ports between 32768 and 61000.");
        console.log("");
    })
    .parse(process.argv);

// globals
const url           = cmd.url           || process.env.URL;
const interval      = cmd.interval      || process.env.INTERVAL       || 100;
const ephemeralPort = cmd.ephemeralPort || process.env.EPHEMERAL_PORT;
const increment     = (cmd.increment != null) ? cmd.increment : process.env.INCREMENT || 1;
const gap           = cmd.gap           || process.env.GAP            || 10 * interval;
const random        = (cmd.random) ? true : false;
const summary       = (cmd.summary) ? true : false;
const events = [];
let lastSummaryCount = 0;
let offset = 0;

// logs
if (!url) throw new Error("You must specify a URL.");
console.log(`URL            = "${url}".`);
console.log(`INTERVAL       = "${interval}" ms.`);
console.log(`EPHEMERAL_PORT = "${ephemeralPort || 'allow OS to select'}".`);
console.log(`INCREMENT      = "${increment}".`);
console.log(`GAP            = "${gap}" ms.`);
console.log(`RANDOM?        = "${random}".`);
console.log(`SUMMARY?       = "${summary}".`);

// use agentkeepalive
const agent = new keepalive({
    keepAlive: false
});

// extract a URL into host and port
function fromURL() {
    const hostport = url.replace("http://", "");
    const hostport_split = hostport.split(":", 2);
    if (hostport_split.length > 1) {
        return { host: hostport_split[0], port: hostport_split[1] };
    } else {
        return { host: hostport, port: 80 };
    }
}

function execute(localPort) {
    const start = new Date();

    // make the query
    const { host, port } = fromURL();
    const req = http.get({
        host: host,
        port: port,
        agent: agent,
        localPort: localPort
    }, res => {

        // record the start and end of the event
        let body = "";
        res.setEncoding("utf8");
        res.on("data", chunk => { body += chunk; });
        res.on("end", () => {
            const key = body;
            const end = new Date();
            if (!events[key]) events[key] = [];
            events[key].push({
                start: start,
                end: end
            });
        });

        // show updating data
        if (summary) {
            // show the number of connections by host
            if (lastSummaryCount > 0) readline.moveCursor(process.stdout, 0, -lastSummaryCount);
            for (const key in events) {
                process.stdout.write(`  ${key}: ${events[key].length}\n`);
            }
            lastSummaryCount = Object.keys(events).length;
        } else {
            // show the local port used
            console.log(req.socket.localPort);
        }

    }).on("error", ex => {
        console.error(ex);
    });

}

function findGaps(max) {
    const gaps = [];
    const minus1sec = new Date(new Date().valueOf() - 1000);

    // look for gaps
    for (const key in events) {

        // sort starts and ends
        const starts = events[key].map(event => event.start);
        const ends = events[key].map(event => event.end);
        starts.sort((a, b) => a - b);
        ends.sort((a, b) => a - b);

        // don't calculate gaps for the last second
        const filtered = ends.filter(end => {
            if (end < minus1sec) return end;
        });

        // gaps are between an end and a start
        for (const end of filtered) {
            for (const start of starts) {
                if (start > end) {
                    const diff = start.valueOf() - end.valueOf();
                    if (diff > max) {
                        gaps.push({
                            node: key,
                            ts: end,
                            resumed: start,
                            length_ms: diff
                        });
                    }
                    break;
                }
            }
        }

    }

    // throw out dups
    const dedupe = [];
    for (const entry of gaps) {
        const found = dedupe.find(final => final.node === entry.node && final.resumed === entry.resumed);
        if (!found) dedupe.push(entry);
    }

    // sort
    dedupe.sort((a, b) => a.ts - b.ts);

    return dedupe;
}

// query every 1 sec
setInterval(_ => {

    // select the appropriate local port
    const localPort = (() => {
        if (random) {
            return Math.floor((Math.random() * 28232) + 32768);    // 32768 - 61000
        } else if (ephemeralPort) {
            return (ephemeralPort + offset);
        } else {
            return undefined; // let the OS decide
        }
    })();

    // execute the call
    execute(localPort);

    // increment offset for ephermeral ports
    offset += increment;

}, interval);

// capture SIGINT (ctrl-c) so that I can show the summary
process.on("SIGINT", () => {
    console.log("\n");
    console.log("summary:");
    for (const key in events) {
        console.log(`  ${key}: ${events[key].length}`);
    }
    console.log("");
    console.log("searching for gaps...");
    console.log("");
    const gaps = findGaps(gap);
    console.log("gaps:")
    if (gaps.length > 0) {
        for (const gap of gaps) {
            console.log(`${gap.node} @ ${gap.ts} for ${gap.length_ms} ms`);
        }
    } else {
        console.log("  (none)");
    }
    process.exit();
});