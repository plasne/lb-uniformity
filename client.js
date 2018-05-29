
// includes
const cmd = require("commander");
const http = require("http");
const readline = require("readline");

// define command line parameters
cmd
    .version("0.1.0")
    .option("-u, --url <s>", `The URL to contact.`)
    .option("-i, --interval <i>", `The number of milliseconds between each call.`, parseInt)
    .option("-e, --ephemeral-port <i>", `Start at this port number and increment by 1.`, parseInt)
    .option("-r, --random", `Picks a random port each time.`)
    .option("-s, --summary", `Shows the summary not the outbound ports.`)
    .parse(process.argv);

// globals
const interval = cmd.interval || 100;
const summary = [];
const gaps = [];
let lastSummaryCount = 0;
let offset = 0;

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

// query every 1 sec
setInterval(_ => {

    // select the appropriate local port
    const localPort = (() => {
        if (cmd.random) {
            return Math.floor((Math.random() * 28232) + 32768);    // 32768 - 61000
        } else if (cmd.ephemeralPort) {
            return (cmd.ephemeralPort + offset);
        } else {
            return undefined; // let the OS decide
        }
    })();

    // make the query
    const { host, port } = fromURL(cmd.url);
    const req = http.get({
        host: host,
        port: port,
        agent: (cmd.agent) ? agent : undefined,
        localPort: localPort
    }, res => {

        // record the name of the server that fulfilled the request
        let body = "";
        res.setEncoding("utf8");
        res.on("data", chunk => { body += chunk; });
        res.on("end", () => {
            const now = new Date();
            if (summary[body]) {
                summary[body].counter += 1;
                const diff_ms = now.valueOf() - summary[body].last;
                if (diff_ms > 1000) {
                    gaps.push({
                        node: body,
                        ts: now,
                        length_ms: diff_ms
                    });
                }
                summary[body].last = now.valueOf();
            } else {
                summary[body] = {
                    counter: 1,
                    last: now.valueOf()
                };
            }
        });

        // show updating data
        if (cmd.summary) {
            // show the number of connections by host
            if (lastSummaryCount > 0) readline.moveCursor(process.stdout, 0, -lastSummaryCount);
            for (const key in summary) {
                process.stdout.write(`  ${key}: ${summary[key].counter}\n`);
            }
            lastSummaryCount = Object.keys(summary).length;
        } else {
            // show the local port used
            console.log(req.socket.localPort);
        }

    }).on("error", ex => {
        console.error(ex);
    });

    // increment offset for ephermeral ports
    offset++;

}, interval);

// capture SIGINT (ctrl-c) so that I can show the summary
process.on("SIGINT", () => {
    console.log("\n");
    console.log("summary:");
    for (const key in summary) {
        console.log(`  ${key}: ${summary[key].counter}`);
    }
    console.log("");
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