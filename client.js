
// includes
const cmd = require("commander");
const http = require("http");
const readline = require("readline");
const keepalive = require('agentkeepalive');

// define command line parameters
cmd
    .version("0.1.0")
    .option("-u, --url <s>", `The URL to contact.`)
    .option("-i, --interval <i>", `The number of milliseconds between each call.`, parseInt)
    .option("-e, --ephemeral-port <i>", `Start at this port number and increment.`, parseInt)
    .option("--increment <i>", `When using a specified ephemeral port, increment by this number.`, parseInt)
    .option("-r, --random", `Picks a random port each time.`)
    .option("-s, --summary", `Shows the summary not the outbound ports.`)
    .parse(process.argv);

// globals
const interval = cmd.interval || 100;
const events = [];
let lastSummaryCount = 0;
let offset = 0;
const increment = (cmd.increment != null) ? cmd.increment : 1;

// use agentkeepalive
const agent = new keepalive({
    keepAlive: false
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

function execute(localPort) {
    const start = new Date();

    // make the query
    const { host, port } = fromURL(cmd.url);
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
        if (cmd.summary) {
            // show the number of connections by host
            if (lastSummaryCount > 0) readline.moveCursor(process.stdout, 0, -lastSummaryCount);
            for (const key in summary) {
                process.stdout.write(`  ${key}: ${summary[key].length}\n`);
            }
            lastSummaryCount = Object.keys(summary).length;
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

    return dedupe;
}

// query every 1 sec
setInterval(_ => {

    // select the appropriate local port
    const localPort = (() => {
        if (cmd.random) {
            return Math.floor((Math.random() * 28232) + 32768);    // 32768 - 61000
        } else if (cmd.outboundPort) {
            return (cmd.outboundPort);
        } else if (cmd.ephemeralPort) {
            return (cmd.ephemeralPort + offset);
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
    const gaps = findGaps(10 * interval);
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