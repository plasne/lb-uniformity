
// includes
const cmd = require("commander");
const readline = require("readline");
const express = require("express");
const os = require("os");
const lsof = require("lsof");

// define command line parameters
cmd
    .version("0.1.0")
    .option("-i, --id <s>", `HOST_ID. The name to report back to the client for aggregation.`)
    .option("-w, --web-port <i>", `WEB_PORT. The port to host the web service on. Defaults to 8080.`)
    .option("-a, --admin-port <i>", `ADMIN_PORT. The port to host the admin service on. Defaults to 8081.`)
    .parse(process.argv);

// globals
const id        = cmd.id        || process.env.HOST_ID    || os.hostname();
const webPort   = cmd.webPort   || process.env.WEB_PORT   || 8080;
const adminPort = cmd.adminPort || process.env.ADMIN_PORT || 8081;
let connections = 0;

// log
console.log(`HOST_ID    = "${id}".`);
console.log(`WEB_PORT   = "${webPort}".`);
console.log(`ADMIN_PORT = "${adminPort}".`);

// config express
const web = express();
const admin = express();

// hello
web.get("/", (req, res) => {

    // increment the number of connections
    connections++;

    // respond
    res.send(id);

});

// probe
admin.get("/", (req, res) => {
    res.send("up");
});

// start listening
web.listen(webPort, () => {
    console.log(`Web listening on port ${webPort}...`);
});
admin.listen(adminPort, () => {
    console.log(`Admin listening on port ${adminPort}...`);
});

// show status every second
setInterval(_ => {
    lsof.counters(counters => {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`connections: ${connections}, open files: ${counters.open}`);
    });
}, 1000);