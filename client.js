
// includes
const cmd = require("commander");
const http = require("http");

// define command line parameters
cmd
    .version("0.1.0")
    .option("-u, --url <s>", `The URL to contact.`)
    .option("-i, --interval <i>", `The number of milliseconds between each call.`, parseInt)
    .option("-e, --ephemeral-port <i>", `Start at this port number and increment by 1.`, parseInt)
    .option("-r, --random", `Picks a random port each time.`)
    .parse(process.argv);

// globals
const interval = cmd.interval || 100;
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

        // show the local port used
        console.log(req.socket.localPort);

    }).on("error", ex => {
        console.error(ex);
    });

    // increment offset for ephermeral ports
    offset++;

}, interval);