
// includes
const readline = require("readline");
const express = require("express");

// globals
let connections = 0;

// config express
const web = express();
const admin = express();

// hello
web.get("/", (req, res) => {

    // show the number of connections
    connections++;
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(`connections: ${connections}`);

    // respond
    res.send("hello");

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
