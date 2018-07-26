
// includes
const cmd = require("commander");
const readline = require("readline");
const express = require("express");
const os = require("os");
const lsof = require("lsof");

// define command line parameters
cmd
    .version("0.1.0")
    .option("-i, --id <s>", `The name to report back to the client for aggregation.`)
    .parse(process.argv);

// globals
const id = cmd.id || os.hostname();
console.log(`This server is identified as "${id}".`);
let connections = 0;

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
const port_web = process.env.PORT_WEB || 8080;
web.listen(port_web, () => {
    console.log(`Web listening on port ${port_web}...`);
});
const port_admin = process.env.PORT_ADMIN || 8081;
admin.listen(port_admin, () => {
    console.log(`Admin listening on port ${port_admin}...`);
});

// show status every second
setInterval(_ => {
    lsof.counters(counters => {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`connections: ${connections}, open files: ${counters.open}`);
    });
}, 1000);